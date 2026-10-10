-- A host's password change must not leave meetings.has_password and
-- meeting_secrets out of sync if either write fails. The Edge Function sends
-- only a bcrypt hash; the transaction and host check live here.
create or replace function public.set_meeting_password_hash(
  p_meeting_id uuid,
  p_password_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;

  select host_id into v_host_id
  from public.meetings
  where id = p_meeting_id
  for update;

  if not found then
    raise exception 'Meeting not found.' using errcode = 'P0002';
  end if;
  if v_host_id <> auth.uid() then
    raise exception 'Only the host can change the meeting password.' using errcode = '42501';
  end if;
  if p_password_hash is not null and
     p_password_hash !~ '^\$2[aby]\$10\$[./A-Za-z0-9]{53}$' then
    raise exception 'Invalid password hash.' using errcode = '22023';
  end if;

  if p_password_hash is null then
    delete from public.meeting_secrets where meeting_id = p_meeting_id;
    update public.meetings set has_password = false where id = p_meeting_id;
    return false;
  end if;

  insert into public.meeting_secrets (meeting_id, password_hash)
  values (p_meeting_id, p_password_hash)
  on conflict (meeting_id) do update
    set password_hash = excluded.password_hash;
  update public.meetings set has_password = true where id = p_meeting_id;
  return true;
end;
$$;

revoke all on function public.set_meeting_password_hash(uuid, text) from public, anon;
grant execute on function public.set_meeting_password_hash(uuid, text) to authenticated;

-- Existing table-level UPDATE grants let a host change has_password directly.
-- Keep older clients compatible while rejecting flags with no matching secret.
create or replace function public.guard_meeting_password_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.has_password then
      raise exception 'Set a meeting password through the password operation.' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.has_password is distinct from old.has_password then
    if new.has_password and not exists (
      select 1 from public.meeting_secrets where meeting_id = new.id
    ) then
      raise exception 'A protected meeting needs a password hash.' using errcode = '23514';
    end if;
    if not new.has_password and exists (
      select 1 from public.meeting_secrets where meeting_id = new.id
    ) then
      raise exception 'Clear the password hash before disabling protection.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists meetings_password_flag_guard on public.meetings;
create trigger meetings_password_flag_guard
before insert or update of has_password on public.meetings
for each row execute function public.guard_meeting_password_flag();

revoke all on function public.guard_meeting_password_flag() from public, anon, authenticated;
