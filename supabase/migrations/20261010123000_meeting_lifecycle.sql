-- A token-issued participant row used to grant permanent access to a meeting's
-- chat, polls, uploads and whiteboard. Leaving now revokes that access; joining
-- again through the password-checked Edge Function restores it. Ending or
-- cancelling a meeting is terminal and revokes everyone's meeting content.
alter table public.meetings
  add column ended_at timestamptz,
  add column cancelled_at timestamptz,
  add constraint meetings_one_terminal_state check (ended_at is null or cancelled_at is null);

alter table public.meeting_participants
  add column left_at timestamptz,
  add column access_expires_at timestamptz;

-- Edge functions query these tables with the service role; explicit grants
-- keep them available when Data API auto-exposure is disabled by default.
grant select on public.meetings, public.meeting_secrets, public.meeting_participants to service_role;

-- Client UPDATE was previously table-wide, including lifecycle flags. Only
-- SECURITY DEFINER operations below may change terminal state. The host can
-- still edit the ordinary scheduling fields through its existing RLS policy.
revoke update on public.meetings from authenticated;
grant update (title, starts_at, duration_minutes) on public.meetings to authenticated;

drop policy if exists "meetings_update_host" on public.meetings;
create policy "meetings_update_host" on public.meetings for update to authenticated
  using (host_id = auth.uid() and ended_at is null and cancelled_at is null)
  with check (host_id = auth.uid() and ended_at is null and cancelled_at is null);

-- SECURITY DEFINER password changes bypass RLS; this trigger rejects changes
-- to ordinary meeting settings after an end/cancel regardless of call path.
create or replace function public.guard_terminal_meeting_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.ended_at is not null or old.cancelled_at is not null then
    if new.title is distinct from old.title
      or new.starts_at is distinct from old.starts_at
      or new.duration_minutes is distinct from old.duration_minutes
      or new.room_code is distinct from old.room_code
      or new.has_password is distinct from old.has_password then
      raise exception 'A closed meeting cannot be edited.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_terminal_meeting_mutation() from public, anon, authenticated;
create trigger meetings_terminal_mutation_guard before update on public.meetings
  for each row execute function public.guard_terminal_meeting_mutation();

create or replace function public.set_meeting_password_hash(
  p_meeting_id uuid,
  p_password_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host_id uuid;
  v_ended_at timestamptz;
  v_cancelled_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  select host_id, ended_at, cancelled_at
  into v_host_id, v_ended_at, v_cancelled_at
  from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'Meeting not found.' using errcode = 'P0002';
  end if;
  if v_host_id <> auth.uid() then
    raise exception 'Only the host can change the meeting password.' using errcode = '42501';
  end if;
  if v_ended_at is not null or v_cancelled_at is not null then
    raise exception 'A closed meeting password cannot be edited.' using errcode = '42501';
  end if;
  if p_password_hash is not null and
     p_password_hash !~ '^\$2[aby]\$10\$[./A-Za-z0-9]{53}$' then
    raise exception 'Invalid password hash.' using errcode = '22023';
  end if;
  if p_password_hash is null then
    delete from public.meeting_secrets where meeting_id = p_meeting_id;
    update public.meetings set has_password = false where id = p_meeting_id;
    return false;
  end if;
  insert into public.meeting_secrets (meeting_id, password_hash)
  values (p_meeting_id, p_password_hash)
  on conflict (meeting_id) do update set password_hash = excluded.password_hash;
  update public.meetings set has_password = true where id = p_meeting_id;
  return true;
end;
$$;

create or replace function public.is_active_meeting_member(p_meeting_id uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.meetings m
    where m.id = p_meeting_id
      and m.ended_at is null
      and m.cancelled_at is null
      and (
        m.host_id = auth.uid()
        or exists (
          select 1 from public.meeting_participants mp
          where mp.meeting_id = m.id
            and mp.user_id = auth.uid()
            and mp.left_at is null
            and mp.access_expires_at > now()
        )
      )
  );
$$;
revoke all on function public.is_active_meeting_member(uuid) from public, anon;
grant execute on function public.is_active_meeting_member(uuid) to authenticated;

-- Storage object paths are text, while the membership helper takes a UUID.
-- Validate before casting: arbitrary file names must return false, not raise
-- a UUID parse error. This also avoids querying meetings under guest RLS.
create or replace function public.is_active_meeting_path_member(p_folder text)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select case
    when p_folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_active_meeting_member(p_folder::uuid)
    else false
  end;
$$;
revoke all on function public.is_active_meeting_path_member(text) from public, anon;
grant execute on function public.is_active_meeting_path_member(text) to authenticated;

-- The Edge Function alone may call this after it has verified the room code,
-- optional password and caller identity. The meeting lock serializes joins
-- with leave/end/cancel and prevents a late token request from reopening a
-- terminal meeting. No client can call this function with a chosen user ID.
create or replace function public.join_meeting_for_token(p_meeting_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ended_at timestamptz;
  v_cancelled_at timestamptz;
begin
  if p_user_id is null then
    raise exception 'A participant is required.' using errcode = '22023';
  end if;
  select ended_at, cancelled_at into v_ended_at, v_cancelled_at
  from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'Meeting not found.' using errcode = 'P0002';
  end if;
  if v_ended_at is not null or v_cancelled_at is not null then
    raise exception 'This meeting is no longer open.' using errcode = '42501';
  end if;

  insert into public.meeting_participants as mp
    (meeting_id, user_id, joined_at, left_at, access_expires_at)
  values (p_meeting_id, p_user_id, now(), null, now() + interval '5 minutes')
  on conflict (meeting_id, user_id) do update
    set joined_at = excluded.joined_at,
        left_at = null,
        access_expires_at = excluded.access_expires_at;
end;
$$;
revoke all on function public.join_meeting_for_token(uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_meeting_for_token(uuid, uuid) to service_role;

-- Called only after the Edge Function confirms the caller's identity is
-- present in LiveKit. Clients cannot renew their own lease from SQL alone.
create or replace function public.renew_meeting_presence(p_meeting_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'A participant is required.' using errcode = '22023';
  end if;
  perform 1 from public.meetings
  where id = p_meeting_id and ended_at is null and cancelled_at is null
  for update;
  if not found then
    raise exception 'This meeting is no longer open.' using errcode = '42501';
  end if;
  update public.meeting_participants
  set access_expires_at = now() + interval '5 minutes'
  where meeting_id = p_meeting_id and user_id = p_user_id and left_at is null;
  if not found then
    raise exception 'Participant has left this meeting.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.renew_meeting_presence(uuid, uuid) from public, anon, authenticated;
grant execute on function public.renew_meeting_presence(uuid, uuid) to service_role;

create or replace function public.leave_meeting(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  perform 1 from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'Meeting not found.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.meetings m where m.id = p_meeting_id and m.host_id = v_uid
  ) and not exists (
    select 1 from public.meeting_participants mp
    where mp.meeting_id = p_meeting_id and mp.user_id = v_uid
  ) then
    raise exception 'Not a participant of this meeting.' using errcode = '42501';
  end if;
  update public.meeting_participants
  set left_at = coalesce(left_at, now()), access_expires_at = now()
  where meeting_id = p_meeting_id and user_id = v_uid;
  -- A host retains access to their own open meeting's content. A guest must
  -- join again with its current password to restore access.
end;
$$;
revoke all on function public.leave_meeting(uuid) from public, anon;
grant execute on function public.leave_meeting(uuid) to authenticated;

create or replace function public.end_meeting(p_meeting_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host_id uuid;
  v_ended_at timestamptz;
  v_cancelled_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  select host_id, ended_at, cancelled_at
  into v_host_id, v_ended_at, v_cancelled_at
  from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'Meeting not found.' using errcode = 'P0002';
  end if;
  if v_host_id <> auth.uid() then
    raise exception 'Only the host can end a meeting.' using errcode = '42501';
  end if;
  if v_cancelled_at is not null then
    raise exception 'This meeting was cancelled.' using errcode = '22023';
  end if;
  if v_ended_at is null then
    update public.meetings set ended_at = now() where id = p_meeting_id;
  end if;
  return true;
end;
$$;
revoke all on function public.end_meeting(uuid) from public, anon;
grant execute on function public.end_meeting(uuid) to authenticated;

create or replace function public.cancel_meeting(p_meeting_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host_id uuid;
  v_ended_at timestamptz;
  v_cancelled_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  select host_id, ended_at, cancelled_at
  into v_host_id, v_ended_at, v_cancelled_at
  from public.meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'Meeting not found.' using errcode = 'P0002';
  end if;
  if v_host_id <> auth.uid() then
    raise exception 'Only the host can cancel a meeting.' using errcode = '42501';
  end if;
  if v_ended_at is not null then
    raise exception 'This meeting has already ended.' using errcode = '22023';
  end if;
  if v_cancelled_at is null then
    update public.meetings set cancelled_at = now() where id = p_meeting_id;
  end if;
  return true;
end;
$$;
revoke all on function public.cancel_meeting(uuid) from public, anon;
grant execute on function public.cancel_meeting(uuid) to authenticated;

-- Rebuild every read/write policy that depended on the mere existence of a
-- participant row. Other meetings and conversations keep their own policies.
drop policy if exists "meeting_messages_select_participant" on public.meeting_messages;
create policy "meeting_messages_select_participant" on public.meeting_messages
  for select to authenticated using (public.is_active_meeting_member(meeting_id));
drop policy if exists "meeting_messages_insert_participant" on public.meeting_messages;
create policy "meeting_messages_insert_participant" on public.meeting_messages
  for insert to authenticated with check (
    sender_id = auth.uid() and public.is_active_meeting_member(meeting_id)
  );

drop policy if exists "polls_select_participant" on public.polls;
create policy "polls_select_participant" on public.polls
  for select to authenticated using (public.is_active_meeting_member(meeting_id));
drop policy if exists "polls_insert_participant" on public.polls;
create policy "polls_insert_participant" on public.polls
  for insert to authenticated with check (
    created_by = auth.uid() and public.is_active_meeting_member(meeting_id)
  );
drop policy if exists "poll_votes_select_own" on public.poll_votes;
create policy "poll_votes_select_own" on public.poll_votes
  for select to authenticated using (
    voter_id = auth.uid() and exists (
      select 1 from public.polls p
      where p.id = poll_votes.poll_id
        and public.is_active_meeting_member(p.meeting_id)
    )
  );

drop policy if exists meeting_whiteboard_events_select_participant on public.meeting_whiteboard_events;
create policy meeting_whiteboard_events_select_participant on public.meeting_whiteboard_events
  for select to authenticated using (public.is_active_meeting_member(meeting_id));

drop policy if exists "chat_uploads_select_member" on storage.objects;
create policy "chat_uploads_select_member" on storage.objects
  for select to authenticated using (
    bucket_id = 'chat-uploads' and (
      exists (
        select 1 from public.conversations c
        where c.id = (storage.foldername(name))[1]
          and auth.uid() = any(c.participant_ids)
      )
      or public.is_active_meeting_path_member((storage.foldername(name))[1])
    )
  );

drop policy if exists "chat_uploads_insert_member" on storage.objects;
create policy "chat_uploads_insert_member" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chat-uploads' and (
      exists (
        select 1 from public.conversations c
        where c.id = (storage.foldername(name))[1]
          and auth.uid() = any(c.participant_ids)
      )
      or public.is_active_meeting_path_member((storage.foldername(name))[1])
    )
  );

-- Direct poll/message inserts and the whiteboard RPC acquire a shared lock on
-- the meeting before writing. This serializes their final access check with
-- end/cancel/leave instead of accepting a stale membership snapshot.
create or replace function public.require_active_meeting_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.meetings where id = new.meeting_id for share;
  if not public.is_active_meeting_member(new.meeting_id) then
    raise exception 'This meeting is not open to you.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.require_active_meeting_write() from public, anon, authenticated;
create trigger meeting_messages_active_insert before insert on public.meeting_messages
  for each row execute function public.require_active_meeting_write();
create trigger polls_active_insert before insert on public.polls
  for each row execute function public.require_active_meeting_write();
create trigger meeting_whiteboard_events_active_insert before insert on public.meeting_whiteboard_events
  for each row execute function public.require_active_meeting_write();

-- SECURITY DEFINER voting bypasses poll RLS; recheck active membership while
-- holding a meeting lock, then preserve the original idempotent vote semantics.
create or replace function public.cast_vote(p_poll_id uuid, p_option_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voter_id uuid := auth.uid();
  v_meeting_id uuid;
  v_options jsonb;
begin
  if v_voter_id is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  select meeting_id into v_meeting_id from public.polls where id = p_poll_id;
  if v_meeting_id is null then
    raise exception 'Poll not found.' using errcode = 'P0002';
  end if;
  perform 1 from public.meetings where id = v_meeting_id for share;
  if not public.is_active_meeting_member(v_meeting_id) then
    raise exception 'Not an active participant of this meeting.' using errcode = '42501';
  end if;
  select options into v_options from public.polls where id = p_poll_id for update;
  if v_options is null then
    raise exception 'Poll not found.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_options) o where o ->> 'id' = p_option_id) then
    raise exception 'Unknown option.' using errcode = '22023';
  end if;
  if exists (select 1 from public.poll_votes where poll_id = p_poll_id and voter_id = v_voter_id) then
    return;
  end if;
  insert into public.poll_votes (poll_id, voter_id, option_id)
  values (p_poll_id, v_voter_id, p_option_id);
  update public.polls
  set options = (
    select jsonb_agg(
      case when o ->> 'id' = p_option_id
        then jsonb_set(o, '{votes}', to_jsonb(coalesce((o ->> 'votes')::int, 0) + 1))
        else o end
    ) from jsonb_array_elements(v_options) o
  ) where id = p_poll_id;
end;
$$;
