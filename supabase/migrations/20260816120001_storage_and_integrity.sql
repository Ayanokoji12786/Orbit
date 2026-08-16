-- Follow-up hardening + integrity fixes found by a full-stack audit after the
-- Phase 4 work. Each section states the concrete failure it prevents.

-- ============================================================
-- 1. chat-uploads was world-readable AND world-listable
-- ============================================================
-- The bucket was created with `public = true` and a SELECT policy with no `to`
-- clause, which defaults to PUBLIC (including `anon`). Since the anon key ships
-- inside the app bundle, anyone could list every object in the bucket and then
-- fetch each one — i.e. harvest every private DM image ever sent.
--
-- Fix: private bucket (no unauthenticated object serving), and both policies
-- scoped to members of the conversation/meeting the path belongs to. Uploads are
-- written as `<conversationId | meetingId>/<filename>`, so the first path segment
-- is the membership key.

update storage.buckets set public = false where id = 'chat-uploads';

drop policy if exists "chat_uploads_public_read" on storage.objects;
drop policy if exists "chat_uploads_authenticated_insert" on storage.objects;

create policy "chat_uploads_select_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-uploads'
    and (
      exists (
        select 1 from public.conversations c
        where c.id = (storage.foldername(name))[1]
          and auth.uid() = any(c.participant_ids)
      )
      or exists (
        select 1 from public.meetings m
        where m.id::text = (storage.foldername(name))[1]
          and (
            m.host_id = auth.uid()
            or exists (
              select 1 from public.meeting_participants mp
              where mp.meeting_id = m.id and mp.user_id = auth.uid()
            )
          )
      )
    )
  );

create policy "chat_uploads_insert_member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-uploads'
    and (
      exists (
        select 1 from public.conversations c
        where c.id = (storage.foldername(name))[1]
          and auth.uid() = any(c.participant_ids)
      )
      or exists (
        select 1 from public.meetings m
        where m.id::text = (storage.foldername(name))[1]
          and (
            m.host_id = auth.uid()
            or exists (
              select 1 from public.meeting_participants mp
              where mp.meeting_id = m.id and mp.user_id = auth.uid()
            )
          )
      )
    )
  );

-- ============================================================
-- 2. meeting_participants was client-writable
-- ============================================================
-- Every participant-scoped policy added in the previous hardening migration
-- (meeting_messages, polls, cast_vote) answers "is there a row here for me?" —
-- but clients could insert that row themselves, granting access to any meeting
-- whose UUID they'd seen and bypassing the room-code + bcrypt password check in
-- livekit-token entirely. Only that edge function (service role) should write it.
revoke insert, update on public.meeting_participants from authenticated;

drop policy if exists "meeting_participants_insert_self" on public.meeting_participants;
drop policy if exists "meeting_participants_update_self" on public.meeting_participants;

-- ============================================================
-- 3. Signup trigger could hard-fail; email could go stale
-- ============================================================
-- A pre-existing public.users row (identity linking, replayed migration, manual
-- seed) raised a unique violation inside the auth transaction and failed signup
-- outright. And because the profile was only written on INSERT, changing your
-- auth email left public.users.email stale — which silently breaks
-- find_user_by_email, now the only way to find a user to add as a contact.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name, email, avatar_url, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'New user'),
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    'offline'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users
    set email = lower(new.email), updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_user_email();

-- ============================================================
-- 4. find_user_by_email was an unthrottled account-existence oracle
-- ============================================================
-- SECURITY DEFINER, granted to `authenticated`, no limit — and signup is open,
-- so anyone could enumerate which email addresses have an Orbit account at speed.
-- Reuses the same DB-backed limiter the edge functions use.
create or replace function public.find_user_by_email(p_email text)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;

  if not public.check_rate_limit('find_user_by_email', 30, 5) then
    raise exception 'Too many lookups. Try again shortly.' using errcode = '54000';
  end if;

  return query
    select u.id from public.users u where u.email = lower(trim(p_email)) limit 1;
end;
$$;

revoke all on function public.find_user_by_email(text) from public;
grant execute on function public.find_user_by_email(text) to authenticated;

-- ============================================================
-- 5. sender_name was unbounded
-- ============================================================
-- Client-supplied and never length-checked, unlike `text` which got a cap in the
-- previous migration.
alter table public.meeting_messages drop constraint if exists meeting_messages_sender_name_len;
alter table public.meeting_messages
  add constraint meeting_messages_sender_name_len check (char_length(sender_name) <= 120);

alter table public.conversation_messages drop constraint if exists conversation_messages_sender_name_len;
alter table public.conversation_messages
  add constraint conversation_messages_sender_name_len check (char_length(sender_name) <= 120);
