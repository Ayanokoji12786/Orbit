alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.meetings;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_messages;
alter publication supabase_realtime add table public.meeting_messages;
alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_votes;
-- NOT added: meeting_participants, users — nothing subscribes to either live today
-- (contact profiles are one-shot reads; in-call presence comes from LiveKit's own room events).

insert into storage.buckets (id, name, public) values ('chat-uploads', 'chat-uploads', true)
  on conflict (id) do nothing;

create policy "chat_uploads_public_read" on storage.objects for select using (bucket_id = 'chat-uploads');
create policy "chat_uploads_authenticated_insert" on storage.objects for insert to authenticated with check (bucket_id = 'chat-uploads');
