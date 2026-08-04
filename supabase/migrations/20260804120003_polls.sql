-- options shape: [{"id":"0","label":"...","votes":0}, ...] — identical to the client's
-- Poll['options'] type, so no client type changes are needed.
create table public.polls (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references public.meetings(id) on delete cascade,
  question    text not null,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  options     jsonb not null check (jsonb_typeof(options) = 'array')
);
create index polls_meeting_idx on public.polls (meeting_id, created_at desc);

-- Exists only for the per-voter uniqueness constraint. Never written to directly by
-- clients — only through cast_vote() below.
create table public.poll_votes (
  poll_id    uuid not null references public.polls(id) on delete cascade,
  voter_id   uuid not null references public.users(id) on delete cascade,
  option_id  text not null,
  voted_at   timestamptz not null default now(),
  primary key (poll_id, voter_id)
);

-- Atomic check-then-increment, mirroring the old Firestore runTransaction: lock the poll
-- row, check poll_votes for an existing vote, insert + bump the jsonb counter together.
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

  -- FOR UPDATE serializes concurrent cast_vote() calls for this poll — a Postgres row
  -- lock, more predictable under contention than Firestore's optimistic-retry transaction.
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
    return; -- silent no-op, matches the old `if (existingVotes[uid]) return;`
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

revoke all on function public.cast_vote(uuid, text) from public;
grant execute on function public.cast_vote(uuid, text) to authenticated;

-- Serves the client's exact Poll shape (options + this user's votedOptionId) in one query.
-- security_invoker=true is required (Postgres 15 defaults views to the owner's privileges)
-- so RLS of the CALLING user applies to the poll_votes join, not the view owner's.
create view public.polls_with_my_vote
with (security_invoker = true) as
select
  p.id, p.meeting_id, p.question, p.created_by, p.created_at, p.options,
  pv.option_id as voted_option_id
from public.polls p
left join public.poll_votes pv on pv.poll_id = p.id and pv.voter_id = auth.uid();

grant select on public.polls_with_my_vote to authenticated;

alter table public.polls enable row level security;
grant select, insert on public.polls to authenticated;
create policy "polls_select_authenticated" on public.polls for select to authenticated using (true);
create policy "polls_insert_creator" on public.polls for insert to authenticated with check (created_by = auth.uid());
-- No update/delete policy or grant — all mutation goes through cast_vote() (security definer).

alter table public.poll_votes enable row level security;
grant select on public.poll_votes to authenticated;
create policy "poll_votes_select_own" on public.poll_votes for select to authenticated using (voter_id = auth.uid());
