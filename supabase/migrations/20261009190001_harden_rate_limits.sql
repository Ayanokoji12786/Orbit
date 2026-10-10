-- The original SECURITY DEFINER RPC accepted its quota and window from any
-- authenticated caller. A client could call it with a zero-minute window to
-- reset the same bucket used by livekit-token or groq-chat. Bind every public
-- bucket to a server-owned policy, and count concurrent first calls atomically.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_max_calls integer,
  p_window_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max_calls integer;
  v_window interval;
  v_count integer;
begin
  if v_uid is null then
    return false;
  end if;

  if p_bucket = 'livekit-token' and p_max_calls = 30 and p_window_minutes = 10 then
    v_max_calls := 30;
    v_window := interval '10 minutes';
  elsif p_bucket = 'groq-chat' and p_max_calls = 20 and p_window_minutes = 10 then
    v_max_calls := 20;
    v_window := interval '10 minutes';
  elsif p_bucket = 'find_user_by_email' and p_max_calls = 30 and p_window_minutes = 5 then
    v_max_calls := 30;
    v_window := interval '5 minutes';
  else
    raise exception 'Unsupported rate limit policy.' using errcode = '22023';
  end if;

  insert into public.function_rate_limits as limits (user_id, bucket, window_start, count)
  values (v_uid, p_bucket, now(), 1)
  on conflict (user_id, bucket) do update
    set window_start = case
          when limits.window_start <= now() - v_window then now()
          else limits.window_start
        end,
        count = case
          when limits.window_start <= now() - v_window then 1
          else least(limits.count + 1, v_max_calls + 1)
        end
  returning count into v_count;

  return v_count <= v_max_calls;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;
