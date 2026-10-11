-- Run only in the isolated Orbit Supabase project, after the worker function,
-- migration, and two named Vault secrets described in the runbook exist.
-- The Cron job stores SQL and secret names, never a decrypted secret or key.
do $installer$
declare
  hmac_schema text;
  worker_url text;
  worker_secret text;
  job_sql text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
    or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'Enable pg_cron and pg_net before installing the deletion worker.';
  end if;

  select n.nspname into hmac_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';
  if hmac_schema is null then
    raise exception 'Enable pgcrypto before installing the deletion worker.';
  end if;

  select decrypted_secret into worker_url
  from vault.decrypted_secrets
  where name = 'orbit_account_deletion_worker_url';
  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'orbit_account_deletion_worker_secret';
  if worker_url is null or left(worker_url, 8) <> 'https://'
    or right(worker_url, length('/functions/v1/delete-account-worker'))
      <> '/functions/v1/delete-account-worker' then
    raise exception 'The Orbit worker URL Vault secret is missing or invalid.';
  end if;
  if worker_secret is null or length(worker_secret) < 32 then
    raise exception 'The Orbit worker signing secret is missing or too short.';
  end if;

  job_sql := format($job$
    do $worker_tick$
    declare
      endpoint text;
      signing_secret text;
      timestamp_text text;
    begin
      select decrypted_secret into endpoint
      from vault.decrypted_secrets
      where name = 'orbit_account_deletion_worker_url';
      select decrypted_secret into signing_secret
      from vault.decrypted_secrets
      where name = 'orbit_account_deletion_worker_secret';
      if endpoint is null or signing_secret is null or length(signing_secret) < 32 then
        raise exception 'Orbit deletion worker Vault configuration is missing.';
      end if;
      timestamp_text := (extract(epoch from clock_timestamp())::bigint)::text;
      perform net.http_post(
        url := endpoint,
        body := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-orbit-worker-ts', timestamp_text,
          'x-orbit-worker-signature', encode(
            %I.hmac(
              convert_to('orbit-account-deletion-worker:v1:' || timestamp_text, 'UTF8'),
              convert_to(signing_secret, 'UTF8'),
              'sha256'
            ), 'hex'
          )
        ),
        timeout_milliseconds := 120000
      );
    end
    $worker_tick$;
  $job$, hmac_schema);

  -- Supabase Cron updates an existing job with the same case-sensitive name.
  perform cron.schedule('orbit-account-deletion-worker', '* * * * *', job_sql);
end
$installer$;
