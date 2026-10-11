-- Claim pending account deletions from either the user endpoint or a scheduled
-- service worker. The request row remains a tombstone until Auth deletion
-- cascades it, including after errors and process termination.
alter table public.account_deletion_requests
  add column claim_token uuid,
  add column lease_until timestamptz,
  add column next_attempt_at timestamptz not null default now(),
  add column retry_count integer not null default 0 check (retry_count >= 0),
  add column last_attempt_at timestamptz,
  add column last_failure_at timestamptz;

create index account_deletion_requests_due_idx
  on public.account_deletion_requests (next_attempt_at, lease_until, started_at);

-- Service-only RPCs: a client can never claim arbitrary users or clear a
-- tombstone through the Data API. SKIP LOCKED avoids duplicate claims when
-- cron and an explicit client retry arrive in the same transaction window.
create or replace function public.account_deletion_claim(
  p_user_id uuid default null,
  p_lease_seconds integer default 600
)
returns table (user_id uuid, claim_token uuid)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  with candidate as (
    select r.user_id
    from public.account_deletion_requests r
    where (p_user_id is null or r.user_id = p_user_id)
      and (r.lease_until is null or r.lease_until <= clock_timestamp())
      and (p_user_id is not null or r.next_attempt_at <= clock_timestamp())
    order by r.next_attempt_at, r.started_at
    limit 1
    for update of r skip locked
  )
  update public.account_deletion_requests r
  set claim_token = gen_random_uuid(),
      lease_until = clock_timestamp() + make_interval(secs => least(greatest(coalesce(p_lease_seconds, 600), 60), 900)),
      last_attempt_at = clock_timestamp()
  from candidate c
  where r.user_id = c.user_id
  returning r.user_id, r.claim_token;
end;
$$;
revoke all on function public.account_deletion_claim(uuid, integer) from public, anon, authenticated;
grant execute on function public.account_deletion_claim(uuid, integer) to service_role;

-- Every durable progress marker also renews the claim. A stale invocation
-- cannot overwrite a cursor belonging to a newer claim.
create or replace function public.account_deletion_checkpoint(
  p_user_id uuid,
  p_claim_token uuid,
  p_step text,
  p_cursor uuid default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_step is null
    or p_step not in ('renew', 'hosted_member', 'hosted_room', 'hosted_done', 'joined_room', 'joined_done')
    or (p_step in ('hosted_member', 'hosted_room', 'joined_room') and p_cursor is null)
    or (p_step in ('renew', 'hosted_done', 'joined_done') and p_cursor is not null) then
    raise exception 'Invalid deletion checkpoint.' using errcode = '22023';
  end if;

  update public.account_deletion_requests r
  set hosted_member_cursor = case
        when p_step = 'hosted_member' then p_cursor
        when p_step = 'hosted_room' then null
        else r.hosted_member_cursor end,
      hosted_room_cursor = case when p_step = 'hosted_room' then p_cursor else r.hosted_room_cursor end,
      hosted_rooms_done = case when p_step = 'hosted_done' then true else r.hosted_rooms_done end,
      joined_room_cursor = case when p_step = 'joined_room' then p_cursor else r.joined_room_cursor end,
      joined_rooms_done = case when p_step = 'joined_done' then true else r.joined_rooms_done end,
      lease_until = clock_timestamp() + interval '10 minutes'
  where r.user_id = p_user_id
    and r.claim_token = p_claim_token
    and r.lease_until > clock_timestamp();
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;
revoke all on function public.account_deletion_checkpoint(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.account_deletion_checkpoint(uuid, uuid, text, uuid) to service_role;

-- Partial work is promptly retryable; failures back off so a broken external
-- dependency cannot produce an unbounded hot loop. A user retry may still
-- claim its own request sooner, but never while another lease is live.
create or replace function public.account_deletion_finish(
  p_user_id uuid,
  p_claim_token uuid,
  p_failed boolean default false
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.account_deletion_requests r
  set claim_token = null,
      lease_until = null,
      retry_count = case when p_failed then r.retry_count + 1 else 0 end,
      last_failure_at = case when p_failed then clock_timestamp() else r.last_failure_at end,
      next_attempt_at = clock_timestamp() + case
        when p_failed then make_interval(secs => least(3600, 60 * (2 ^ least(r.retry_count, 6))::integer))
        else interval '2 seconds' end
  where r.user_id = p_user_id
    and r.claim_token = p_claim_token
    and r.lease_until > clock_timestamp();
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;
revoke all on function public.account_deletion_finish(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.account_deletion_finish(uuid, uuid, boolean) to service_role;
