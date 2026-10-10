-- The signup trigger owns row creation and the auth email sync trigger owns email.
-- Direct client INSERT or table-wide UPDATE let a user forge their lookup email,
-- presence, or other profile fields even though RLS limited them to their own row.
revoke insert, update on table public.users from authenticated;
grant update (display_name, bio, avatar_url, updated_at) on table public.users to authenticated;
drop policy if exists "users_insert_self" on public.users;

-- Existing OAuth profile URLs remain readable. A client changing its avatar,
-- however, must point to an object under its own directory in the private
-- bucket (or clear it). Service-role maintenance is unaffected.
create or replace function public.enforce_owned_profile_avatar_path()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_prefix text := 'profile-avatars/' || new.id::text || '/';
  filename text;
begin
  if current_user = 'authenticated'
     and new.avatar_url is distinct from old.avatar_url
     and new.avatar_url is not null then
    filename := substring(new.avatar_url from length(owner_prefix) + 1);
    if left(new.avatar_url, length(owner_prefix)) <> owner_prefix
       or filename = ''
       or position('/' in filename) > 0 then
      raise exception 'Avatar must be an image in your own profile-avatars folder';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_owned_profile_avatar_path
  before update of avatar_url on public.users
  for each row execute function public.enforce_owned_profile_avatar_path();

-- Avatar objects are private. The stable path, not a signed URL, is stored in
-- public.users.avatar_url as profile-avatars/<owner uid>/<unique filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars', 'profile-avatars', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Owners may read their own unreferenced uploads (including during cleanup).
-- Contacts may sign only the image currently referenced by their contact's
-- profile. Other authenticated users cannot list or sign it.
create policy "profile_avatars_select_owner_or_contact" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.users u
        join public.contacts c on c.contact_id = u.id
        where u.id::text = (storage.foldername(name))[1]
          and u.avatar_url = 'profile-avatars/' || name
          and c.owner_id = (select auth.uid())
      )
    )
  );

create policy "profile_avatars_insert_owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

create policy "profile_avatars_delete_owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
