create extension if not exists pgcrypto;

create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  email         text,
  avatar_url    text,
  bio           text,
  status        text not null default 'offline' check (status in ('online','away','offline')),
  timezone      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index users_email_idx on public.users (email);

alter table public.users enable row level security;
grant select, insert, update on public.users to authenticated;
create policy "users_select_authenticated" on public.users for select to authenticated using (true);
create policy "users_insert_self" on public.users for insert to authenticated with check (id = auth.uid());
create policy "users_update_self" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Creates the profile row the instant a Supabase Auth user is created (mirrors the old
-- Firebase onUserCreate Cloud Function, but as a DB trigger since Auth and app data now
-- share one Postgres instance — no function-call hop needed).
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
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
