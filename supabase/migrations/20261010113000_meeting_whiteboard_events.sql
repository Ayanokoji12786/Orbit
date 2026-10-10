-- Completed strokes are durable so a late joiner can reconstruct the board.
-- Only a meeting participant (or host) can read/write events; only the host
-- can clear the board. All writes pass through the validating RPC below.
create table public.meeting_whiteboard_events (
  seq bigint generated always as identity primary key,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  client_id text not null,
  kind text not null check (kind in ('stroke', 'clear')),
  color text,
  points jsonb,
  created_at timestamptz not null default now(),
  unique (meeting_id, client_id),
  check ((kind = 'clear' and color is null and points is null)
      or (kind = 'stroke' and color is not null and points is not null))
);
create index meeting_whiteboard_events_meeting_seq_idx
  on public.meeting_whiteboard_events (meeting_id, seq desc);
alter table public.meeting_whiteboard_events enable row level security;
grant select on public.meeting_whiteboard_events to authenticated;
create policy meeting_whiteboard_events_select_participant
on public.meeting_whiteboard_events for select to authenticated using (
  exists (
    select 1 from public.meeting_participants mp
    where mp.meeting_id = meeting_whiteboard_events.meeting_id and mp.user_id = auth.uid()
  ) or exists (
    select 1 from public.meetings m
    where m.id = meeting_whiteboard_events.meeting_id and m.host_id = auth.uid()
  )
);

create table public.meeting_whiteboard_quotas (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  window_start timestamptz not null,
  count integer not null,
  primary key (meeting_id, actor_id)
);
alter table public.meeting_whiteboard_quotas enable row level security;
-- No client grants or policies; only the validating SECURITY DEFINER RPC uses it.

create or replace function public.append_meeting_whiteboard_event(
  p_meeting_id uuid,
  p_client_id text,
  p_kind text,
  p_color text,
  p_points jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_host boolean;
  v_is_participant boolean;
  v_point jsonb;
  v_seq bigint;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  if p_client_id is null or p_client_id !~ '^[A-Za-z0-9-]{8,64}$' then
    raise exception 'Invalid whiteboard event ID.' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.meetings m where m.id = p_meeting_id and m.host_id = v_uid
  ) into v_is_host;
  select exists (
    select 1 from public.meeting_participants mp
    where mp.meeting_id = p_meeting_id and mp.user_id = v_uid
  ) into v_is_participant;
  if not (v_is_host or v_is_participant) then
    raise exception 'Not a participant of this meeting.' using errcode = '42501';
  end if;
  -- Serialize completed strokes and clears so seq reflects board order.
  perform 1 from public.meetings where id = p_meeting_id for update;
  insert into public.meeting_whiteboard_quotas as quota
    (meeting_id, actor_id, window_start, count)
  values (p_meeting_id, v_uid, now(), 1)
  on conflict (meeting_id, actor_id) do update
    set window_start = case
          when quota.window_start <= now() - interval '1 minute' then now()
          else quota.window_start
        end,
        count = case
          when quota.window_start <= now() - interval '1 minute' then 1
          else least(quota.count + 1, 121)
        end
  returning count into v_count;
  if v_count > 120 then
    raise exception 'Too many whiteboard changes. Try again shortly.' using errcode = '54000';
  end if;

  if p_kind = 'clear' then
    if not v_is_host then
      raise exception 'Only the host can clear the whiteboard.' using errcode = '42501';
    end if;
    if p_color is not null or p_points is not null then
      raise exception 'A clear event has no stroke data.' using errcode = '22023';
    end if;
  elsif p_kind = 'stroke' then
    if p_color is null or p_color not in ('#F5F5F7', '#5B5FFF', '#7C5CFC', '#20C997', '#F59F00', '#FF4D6D') then
      raise exception 'Invalid stroke color.' using errcode = '22023';
    end if;
    if p_points is null or jsonb_typeof(p_points) <> 'array' then
      raise exception 'Invalid stroke points.' using errcode = '22023';
    end if;
    if jsonb_array_length(p_points) not between 2 and 512 or pg_column_size(p_points) > 65536 then
      raise exception 'Stroke is too large.' using errcode = '22023';
    end if;
    for v_point in select value from jsonb_array_elements(p_points) loop
      if jsonb_typeof(v_point) <> 'object' or
         jsonb_typeof(v_point -> 'x') <> 'number' or
         jsonb_typeof(v_point -> 'y') <> 'number' then
        raise exception 'Invalid stroke point.' using errcode = '22023';
      end if;
      if (v_point ->> 'x')::numeric not between 0 and 1 or
         (v_point ->> 'y')::numeric not between 0 and 1 then
        raise exception 'Stroke point is outside the canvas.' using errcode = '22023';
      end if;
    end loop;
  else
    raise exception 'Invalid whiteboard event kind.' using errcode = '22023';
  end if;

  insert into public.meeting_whiteboard_events
    (meeting_id, actor_id, client_id, kind, color, points)
  values (p_meeting_id, v_uid, p_client_id, p_kind, p_color, p_points)
  on conflict (meeting_id, client_id) do nothing
  returning seq into v_seq;

  if v_seq is null then
    select seq into v_seq from public.meeting_whiteboard_events
    where meeting_id = p_meeting_id and client_id = p_client_id and actor_id = v_uid
      and kind = p_kind and color is not distinct from p_color and points is not distinct from p_points;
    if v_seq is null then
      raise exception 'Whiteboard event ID already exists.' using errcode = '23505';
    end if;
  end if;
  -- All clients, including late joiners, see the same bounded 500-event board.
  delete from public.meeting_whiteboard_events
  where meeting_id = p_meeting_id and seq < (
    select seq from public.meeting_whiteboard_events
    where meeting_id = p_meeting_id
    order by seq desc offset 499 limit 1
  );
  return v_seq;
end;
$$;

revoke all on function public.append_meeting_whiteboard_event(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.append_meeting_whiteboard_event(uuid, text, text, text, jsonb) to authenticated;

alter publication supabase_realtime add table public.meeting_whiteboard_events;
