-- A deletion request closes the account's write paths before Storage and Auth
-- are changed by separate services. It is retained on retries and cascades
-- with auth.users after successful deletion.
create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  hosted_room_cursor uuid,
  hosted_member_cursor uuid,
  hosted_rooms_done boolean not null default false,
  joined_room_cursor uuid,
  joined_rooms_done boolean not null default false
);
alter table public.account_deletion_requests enable row level security;
grant select, insert, update on public.account_deletion_requests to service_role;

-- The Edge Function checks the age of the *sign-in session*, not the access
-- JWT (whose iat changes on refresh). Only the service role may call this.
create or replace function public.account_deletion_session_is_fresh(
  p_user_id uuid,
  p_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions s
    where s.id = p_session_id
      and s.user_id = p_user_id
      and s.created_at between now() - interval '10 minutes' and now()
  );
$$;
revoke all on function public.account_deletion_session_is_fresh(uuid, uuid) from public, anon, authenticated;
grant execute on function public.account_deletion_session_is_fresh(uuid, uuid) to service_role;

create or replace function public.account_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and exists (select 1 from public.users u where u.id = auth.uid())
     and not exists (
       select 1 from public.account_deletion_requests d
       where d.user_id = auth.uid()
     );
$$;
revoke all on function public.account_is_active() from public, anon;
grant execute on function public.account_is_active() to authenticated;

-- DM paths belong to both participants. Neither may add new content or an
-- upload once either account has begun deletion.
create or replace function public.account_can_write_dm(p_conversation_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and auth.uid() = any(c.participant_ids)
      and not exists (
        select 1 from unnest(c.participant_ids) as p(id)
        where not exists (select 1 from public.users u where u.id = p.id)
           or exists (select 1 from public.account_deletion_requests d where d.user_id = p.id)
      )
  );
$$;
revoke all on function public.account_can_write_dm(text) from public, anon;
grant execute on function public.account_can_write_dm(text) to authenticated;

create or replace function public.account_can_write_meeting_upload(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_active_meeting_path_member(p_folder)
      and exists (
        select 1 from public.meetings m
        where m.id = p_folder::uuid
          and not exists (
            select 1 from public.account_deletion_requests d where d.user_id = m.host_id
          )
      )
    else false
  end;
$$;
revoke all on function public.account_can_write_meeting_upload(text) from public, anon;
grant execute on function public.account_can_write_meeting_upload(text) to authenticated;

-- Auth deletion must not leave shared conversations containing a deleted UUID,
-- and nullable author references must not block the auth.users -> public.users
-- cascade. This trigger runs inside the Auth deletion transaction, so a failed
-- delete rolls back every database change below.
create or replace function public.cleanup_account_content_before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A DM is shared by exactly two people. Remove it and its messages for both
  -- participants; retaining its deterministic id would disclose the old UUID.
  delete from public.conversations where old.id = any(participant_ids);

  -- Author names and message bodies are user content. Delete authored content
  -- in meetings hosted by someone else too; hosted meetings cascade below.
  delete from public.meeting_messages where sender_id = old.id;
  delete from public.polls where created_by = old.id;
  return old;
end;
$$;

revoke all on function public.cleanup_account_content_before_profile_delete() from public, anon, authenticated;
drop trigger if exists cleanup_account_content_before_profile_delete on public.users;
create trigger cleanup_account_content_before_profile_delete
  before delete on public.users
  for each row execute function public.cleanup_account_content_before_profile_delete();

-- The Edge Function uses this service-only inventory to delete files via the
-- Storage API. SQL deletion of storage.objects would orphan the file bytes.
-- Include all objects owned by the user, even abandoned uploads, plus objects
-- attached to DMs and hosted meetings that the cascade will remove.
create or replace function public.account_deletion_storage_objects(
  p_user_id uuid,
  p_limit integer default 100
)
returns table (bucket_id text, name text)
language sql
security definer
set search_path = ''
as $$
  select o.bucket_id::text, o.name::text
  from storage.objects o
  where o.owner_id = p_user_id::text
     or (o.bucket_id = 'profile-avatars'
         and o.name like p_user_id::text || '/%')
     or (o.bucket_id = 'chat-uploads'
         and split_part(o.name, '/', 1) in (
           select c.id from public.conversations c
           where p_user_id = any(c.participant_ids)
         ))
     or (o.bucket_id = 'chat-uploads'
         and split_part(o.name, '/', 1) in (
           select m.id::text from public.meetings m
           where m.host_id = p_user_id
         ))
  order by o.bucket_id, o.name
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke all on function public.account_deletion_storage_objects(uuid, integer) from public, anon, authenticated;
grant execute on function public.account_deletion_storage_objects(uuid, integer) to service_role;

-- A still-unexpired JWT cannot call this SECURITY DEFINER RPC to recreate a
-- phantom DM after its public.users row has been cascaded away.
create or replace function public.get_or_create_dm_conversation(p_other_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id text;
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  if not public.account_is_active() then
    raise exception 'Account deletion is in progress or complete.' using errcode = '42501';
  end if;
  if v_uid = p_other_user_id then
    raise exception 'Cannot start a conversation with yourself.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.users where id = p_other_user_id) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.account_deletion_requests where user_id = p_other_user_id) then
    raise exception 'This account is being deleted.' using errcode = '42501';
  end if;

  v_id := 'dm_' || least(v_uid::text, p_other_user_id::text) || '_' || greatest(v_uid::text, p_other_user_id::text);
  insert into public.conversations (id, kind, participant_ids)
  values (v_id, 'dm', array[v_uid, p_other_user_id])
  on conflict (id) do nothing;
  return v_id;
end;
$$;

revoke all on function public.get_or_create_dm_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_dm_conversation(uuid) to authenticated;

-- Storage is the only app write path without a foreign key back to our user
-- row. Reject both in-progress and stale-JWT uploads. Preserve existing
-- membership checks so another user's access is unchanged.
drop policy if exists "profile_avatars_insert_owner" on storage.objects;
create policy "profile_avatars_insert_owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and public.account_is_active()
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

drop policy if exists "chat_uploads_insert_member" on storage.objects;
create policy "chat_uploads_insert_member" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chat-uploads'
    and public.account_is_active()
    and (
      public.account_can_write_dm((storage.foldername(name))[1])
      or public.account_can_write_meeting_upload((storage.foldername(name))[1])
    )
  );

create or replace function public.reject_account_deletion_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.account_is_active() then
    raise exception 'Account deletion is in progress or complete.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_account_deletion_write() from public, anon, authenticated;

create or replace function public.reject_deleting_dm_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.account_can_write_dm(new.conversation_id) then
    raise exception 'This direct message is closing.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_deleting_dm_message() from public, anon, authenticated;

-- These triggers close durable client writes while cross-service cleanup runs.
-- Service-role maintenance has no auth.uid() and remains possible.
create trigger reject_account_deletion_write before insert or update on public.contacts
  for each row execute function public.reject_account_deletion_write();
create trigger reject_account_deletion_write before insert or update on public.meetings
  for each row execute function public.reject_account_deletion_write();
create trigger reject_account_deletion_write before insert on public.meeting_messages
  for each row execute function public.reject_account_deletion_write();
create trigger reject_account_deletion_write before insert on public.conversation_messages
  for each row execute function public.reject_account_deletion_write();
create trigger reject_deleting_dm_message before insert on public.conversation_messages
  for each row execute function public.reject_deleting_dm_message();
create trigger reject_account_deletion_write before insert on public.polls
  for each row execute function public.reject_account_deletion_write();
create trigger reject_account_deletion_write before insert on public.poll_votes
  for each row execute function public.reject_account_deletion_write();
create trigger reject_account_deletion_write before insert on public.meeting_whiteboard_events
  for each row execute function public.reject_account_deletion_write();
create trigger reject_account_deletion_write before update on public.users
  for each row execute function public.reject_account_deletion_write();

create or replace function public.reject_deleting_meeting_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Leaving revokes access and must remain possible while a host deletes their
  -- account. Joining and renewing still pass through the rejection below.
  if tg_op = 'UPDATE'
     and new.left_at is not null
     and new.access_expires_at <= now()
     and new.joined_at is not distinct from old.joined_at
     and new.user_id = old.user_id
     and new.meeting_id = old.meeting_id then
    return new;
  end if;
  if not exists (select 1 from public.users u where u.id = new.user_id)
     or exists (select 1 from public.account_deletion_requests d where d.user_id = new.user_id)
     or exists (
       select 1 from public.meetings m
       join public.account_deletion_requests d on d.user_id = m.host_id
       where m.id = new.meeting_id
     ) then
    raise exception 'Account deletion is in progress or complete.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_deleting_meeting_participant() from public, anon, authenticated;
create trigger reject_deleting_meeting_participant
  before insert or update on public.meeting_participants
  for each row execute function public.reject_deleting_meeting_participant();
