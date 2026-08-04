create table public.meeting_messages (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.meetings(id) on delete cascade,
  sender_id    uuid references public.users(id),
  sender_name  text not null,
  text         text,
  image_url    text,
  created_at   timestamptz not null default now(),
  check (text is not null or image_url is not null)
);
create index meeting_messages_meeting_idx on public.meeting_messages (meeting_id, created_at asc);

alter table public.meeting_messages enable row level security;
grant select, insert on public.meeting_messages to authenticated;
create policy "meeting_messages_select_authenticated" on public.meeting_messages for select to authenticated using (true);
create policy "meeting_messages_insert_sender" on public.meeting_messages for insert to authenticated with check (sender_id = auth.uid());

create table public.conversations (
  id              text primary key,  -- deterministic `dm_${sortedUids}`, computed client-side — not a uuid
  kind            text not null default 'dm' check (kind = 'dm'),
  participant_ids uuid[] not null,
  created_at      timestamptz not null default now(),
  check (array_length(participant_ids, 1) = 2)
);
create index conversations_participant_ids_idx on public.conversations using gin (participant_ids);

alter table public.conversations enable row level security;
grant select, insert on public.conversations to authenticated;
create policy "conversations_select_participant" on public.conversations for select to authenticated using (auth.uid() = any(participant_ids));
create policy "conversations_insert_participant" on public.conversations for insert to authenticated with check (auth.uid() = any(participant_ids));

create table public.conversation_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  text not null references public.conversations(id) on delete cascade,
  sender_id        uuid references public.users(id),
  sender_name      text not null,
  text             text,
  image_url        text,
  created_at       timestamptz not null default now(),
  check (text is not null or image_url is not null)
);
create index conversation_messages_conv_idx on public.conversation_messages (conversation_id, created_at asc);

alter table public.conversation_messages enable row level security;
grant select, insert on public.conversation_messages to authenticated;
create policy "conversation_messages_select_participant" on public.conversation_messages
  for select to authenticated using (
    exists (select 1 from public.conversations c where c.id = conversation_messages.conversation_id and auth.uid() = any(c.participant_ids))
  );
create policy "conversation_messages_insert_participant" on public.conversation_messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c where c.id = conversation_messages.conversation_id and auth.uid() = any(c.participant_ids))
  );
