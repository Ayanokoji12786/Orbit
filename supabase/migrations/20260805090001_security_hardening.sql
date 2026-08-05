-- ============================================================
-- 1. meetings — critical: was readable by any authenticated user
-- ============================================================
drop policy "meetings_select_authenticated" on public.meetings;
create policy "meetings_select_host" on public.meetings for select to authenticated using (host_id = auth.uid());

-- ============================================================
-- 2. meeting_messages, polls, meeting_participants — scope to
--    meeting participants (or host) instead of any authenticated user
-- ============================================================
drop policy "meeting_messages_select_authenticated" on public.meeting_messages;
drop policy "meeting_messages_insert_sender" on public.meeting_messages;
create policy "meeting_messages_select_participant" on public.meeting_messages for select to authenticated using (
  exists (select 1 from public.meeting_participants mp where mp.meeting_id = meeting_messages.meeting_id and mp.user_id = auth.uid())
  or exists (select 1 from public.meetings m where m.id = meeting_messages.meeting_id and m.host_id = auth.uid())
);
create policy "meeting_messages_insert_participant" on public.meeting_messages for insert to authenticated with check (
  sender_id = auth.uid() and (
    exists (select 1 from public.meeting_participants mp where mp.meeting_id = meeting_messages.meeting_id and mp.user_id = auth.uid())
    or exists (select 1 from public.meetings m where m.id = meeting_messages.meeting_id and m.host_id = auth.uid())
  )
);

drop policy "polls_select_authenticated" on public.polls;
drop policy "polls_insert_creator" on public.polls;
create policy "polls_select_participant" on public.polls for select to authenticated using (
  exists (select 1 from public.meeting_participants mp where mp.meeting_id = polls.meeting_id and mp.user_id = auth.uid())
  or exists (select 1 from public.meetings m where m.id = polls.meeting_id and m.host_id = auth.uid())
);
create policy "polls_insert_participant" on public.polls for insert to authenticated with check (
  created_by = auth.uid() and (
    exists (select 1 from public.meeting_participants mp where mp.meeting_id = polls.meeting_id and mp.user_id = auth.uid())
    or exists (select 1 from public.meetings m where m.id = polls.meeting_id and m.host_id = auth.uid())
  )
);

-- cast_vote() is SECURITY DEFINER and bypasses RLS internally, so it needs
-- its own membership check — same signature/logic as before, plus a guard.
create or replace function public.cast_vote(p_poll_id uuid, p_option_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter_id      uuid := auth.uid();
  v_options       jsonb;
  v_already_voted boolean;
begin
  if v_voter_id is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.polls p
    where p.id = p_poll_id and (
      exists (select 1 from public.meeting_participants mp where mp.meeting_id = p.meeting_id and mp.user_id = v_voter_id)
      or exists (select 1 from public.meetings m where m.id = p.meeting_id and m.host_id = v_voter_id)
    )
  ) then
    raise exception 'Not a participant of this meeting.' using errcode = '42501';
  end if;

  select options into v_options from public.polls where id = p_poll_id for update;
  if v_options is null then
    raise exception 'Poll not found.' using errcode = 'P0002';
  end if;

  if not exists (select 1 from jsonb_array_elements(v_options) o where o ->> 'id' = p_option_id) then
    raise exception 'Unknown option.' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.poll_votes where poll_id = p_poll_id and voter_id = v_voter_id
  ) into v_already_voted;

  if v_already_voted then
    return;
  end if;

  insert into public.poll_votes (poll_id, voter_id, option_id) values (p_poll_id, v_voter_id, p_option_id);

  update public.polls
  set options = (
    select jsonb_agg(
      case when o ->> 'id' = p_option_id
        then jsonb_set(o, '{votes}', to_jsonb(coalesce((o ->> 'votes')::int, 0) + 1))
        else o
      end
    )
    from jsonb_array_elements(v_options) o
  )
  where id = p_poll_id;
end;
$$;

drop policy "meeting_participants_select_authenticated" on public.meeting_participants;
create policy "meeting_participants_select_own_or_host" on public.meeting_participants for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.meetings m where m.id = meeting_participants.meeting_id and m.host_id = auth.uid())
);

-- ============================================================
-- 3. DM conversation hijack — id is client-computed and guessable;
--    route creation through a function that always uses auth.uid()
--    as one side, so no one can create a conversation "as" someone else.
-- ============================================================
create or replace function public.get_or_create_dm_conversation(p_other_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id text;
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  if v_uid = p_other_user_id then
    raise exception 'Cannot start a conversation with yourself.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.users where id = p_other_user_id) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  -- text-based least/greatest exactly mirrors the client's `[a,b].sort().join('_')`
  v_id := 'dm_' || least(v_uid::text, p_other_user_id::text) || '_' || greatest(v_uid::text, p_other_user_id::text);

  insert into public.conversations (id, kind, participant_ids)
  values (v_id, 'dm', array[v_uid, p_other_user_id])
  on conflict (id) do nothing;

  return v_id;
end;
$$;
revoke all on function public.get_or_create_dm_conversation(uuid) from public;
grant execute on function public.get_or_create_dm_conversation(uuid) to authenticated;

drop policy "conversations_insert_participant" on public.conversations;
revoke insert on public.conversations from authenticated;

-- ============================================================
-- 4. users — was readable by any authenticated user (email, bio,
--    timezone exposed platform-wide). Scope to self + contacts.
-- ============================================================
drop policy "users_select_authenticated" on public.users;
create policy "users_select_self" on public.users for select to authenticated using (id = auth.uid());
create policy "users_select_contact" on public.users for select to authenticated using (
  exists (select 1 from public.contacts c where c.owner_id = auth.uid() and c.contact_id = users.id)
);

-- addContactByEmail needs to find a user by email *before* they're a
-- contact — that's the whole point. Narrow lookup, id only, never the
-- rest of the profile.
create or replace function public.find_user_by_email(p_email text)
returns table(id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select u.id from public.users u where u.email = lower(trim(p_email));
end;
$$;
revoke all on function public.find_user_by_email(text) from public;
grant execute on function public.find_user_by_email(text) to authenticated;

-- ============================================================
-- 5. chat-uploads storage bucket — no size/type limit today
-- ============================================================
update storage.buckets
set file_size_limit = 8388608, -- 8 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'chat-uploads';

-- ============================================================
-- 6. Rate limiting for edge functions (groq-chat cost abuse,
--    livekit-token password brute-force)
-- ============================================================
create table public.function_rate_limits (
  user_id      uuid not null references public.users(id) on delete cascade,
  bucket       text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (user_id, bucket)
);
alter table public.function_rate_limits enable row level security;
-- no policies/grants — only reachable via the SECURITY DEFINER function below

create or replace function public.check_rate_limit(p_bucket text, p_max_calls integer, p_window_minutes integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.function_rate_limits%rowtype;
begin
  if v_uid is null then
    return false;
  end if;

  select * into v_row from public.function_rate_limits where user_id = v_uid and bucket = p_bucket for update;

  if v_row is null or v_row.window_start < now() - (p_window_minutes || ' minutes')::interval then
    insert into public.function_rate_limits (user_id, bucket, window_start, count)
    values (v_uid, p_bucket, now(), 1)
    on conflict (user_id, bucket) do update set window_start = excluded.window_start, count = 1;
    return true;
  end if;

  if v_row.count >= p_max_calls then
    return false;
  end if;

  update public.function_rate_limits set count = count + 1 where user_id = v_uid and bucket = p_bucket;
  return true;
end;
$$;
revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;

-- ============================================================
-- 9. Chat message length cap (no limit existed before)
-- ============================================================
alter table public.meeting_messages add constraint meeting_messages_text_length check (text is null or char_length(text) <= 4000);
alter table public.conversation_messages add constraint conversation_messages_text_length check (text is null or char_length(text) <= 4000);
