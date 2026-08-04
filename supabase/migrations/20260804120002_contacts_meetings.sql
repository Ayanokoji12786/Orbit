create table public.contacts (
  owner_id    uuid not null references public.users(id) on delete cascade,
  contact_id  uuid not null references public.users(id) on delete cascade,
  is_favorite boolean not null default false,
  added_at    timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);
create index contacts_owner_idx on public.contacts (owner_id);

alter table public.contacts enable row level security;
grant select, insert, update, delete on public.contacts to authenticated;
create policy "contacts_select_owner" on public.contacts for select to authenticated using (owner_id = auth.uid());
create policy "contacts_insert_owner" on public.contacts for insert to authenticated with check (owner_id = auth.uid());
create policy "contacts_update_owner" on public.contacts for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "contacts_delete_owner" on public.contacts for delete to authenticated using (owner_id = auth.uid());

create table public.meetings (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid not null references public.users(id) on delete cascade,
  title             text not null,
  starts_at         timestamptz not null,
  duration_minutes  integer not null default 30,
  room_code         text not null unique,
  has_password      boolean not null default false,
  created_at        timestamptz not null default now()
);
-- One btree serves both the >=/asc (upcoming) and </desc (past) queries — Postgres can scan
-- a btree backwards for free, so this collapses Firestore's two composite indexes into one.
create index meetings_host_starts_idx on public.meetings (host_id, starts_at);

alter table public.meetings enable row level security;
grant select, insert, update, delete on public.meetings to authenticated;
create policy "meetings_select_authenticated" on public.meetings for select to authenticated using (true);
create policy "meetings_insert_host" on public.meetings for insert to authenticated with check (host_id = auth.uid());
create policy "meetings_update_host" on public.meetings for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "meetings_delete_host" on public.meetings for delete to authenticated using (host_id = auth.uid());

create table public.meeting_participants (
  meeting_id  uuid not null references public.meetings(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

alter table public.meeting_participants enable row level security;
grant select, insert, update on public.meeting_participants to authenticated;
create policy "meeting_participants_select_authenticated" on public.meeting_participants for select to authenticated using (true);
create policy "meeting_participants_insert_self" on public.meeting_participants for insert to authenticated with check (user_id = auth.uid());
create policy "meeting_participants_update_self" on public.meeting_participants for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.meeting_secrets (
  meeting_id     uuid primary key references public.meetings(id) on delete cascade,
  password_hash  text not null
);
alter table public.meeting_secrets enable row level security;
-- Deliberately: no policies, no grants to anon/authenticated at all. Equivalent of
-- firestore.rules' `allow read, write: if false` — only the service_role key (edge
-- functions) can touch this table.
