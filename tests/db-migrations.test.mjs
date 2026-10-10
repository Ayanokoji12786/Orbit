import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
const ids = {
  host: '11111111-1111-4111-8111-111111111111',
  guest: '22222222-2222-4222-8222-222222222222',
  outsider: '33333333-3333-4333-8333-333333333333',
  meeting: '44444444-4444-4444-8444-444444444444',
};

// PGlite executes the actual migrations and PostgreSQL RLS/grants. These
// minimal schemas stand in for Supabase-owned objects; this does not exercise
// hosted Auth, Storage, Realtime, Edge Functions, or concurrent connections.
const supabaseSchema = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean not null,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text, name text
  );
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select case when strpos(name, '/') = 0 then '{}'::text[]
      else (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
    end
  $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert, delete on storage.objects to authenticated;
  create publication supabase_realtime;
  grant usage on schema public to anon, authenticated;
`;

async function as(db, role, userId, sql, params = []) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

async function rejectsSqlState(operation, code) {
  await assert.rejects(operation, (error) => error.code === code);
}

async function assertTerminalSettingsImmutable(db, meetingId) {
  const query = `select title, starts_at, duration_minutes, room_code
    from public.meetings where id = $1`;
  const before = (await db.query(query, [meetingId])).rows[0];
  for (const update of [
    "title = 'Too late'",
    "starts_at = now() + interval '3 hours'",
    'duration_minutes = 90',
    "room_code = 'NEW123'",
  ]) {
    try {
      await as(db, 'authenticated', ids.host,
        `update public.meetings set ${update} where id = $1`, [meetingId]);
    } catch (error) {
      assert.equal(error.code, '42501');
    }
    const after = (await db.query(query, [meetingId])).rows[0];
    assert.deepEqual(after, before, `${update} must not change a terminal meeting`);
  }
}

const pollOptions = JSON.stringify([
  { id: 'yes', label: 'Yes', votes: 0 },
  { id: 'no', label: 'No', votes: 0 },
]);

async function seedMeetingContent(db, meetingId, pollId) {
  await as(db, 'authenticated', ids.host,
    `insert into public.polls (id, meeting_id, question, created_by, options)
      values ($1, $2, 'Question?', $3, $4::jsonb)`,
    [pollId, meetingId, ids.host, pollOptions]);
  await as(db, 'authenticated', ids.guest,
    `insert into public.meeting_messages
      (meeting_id, sender_id, sender_name, text)
      values ($1, $2, 'Guest', 'Hello')`, [meetingId, ids.guest]);
  await as(db, 'authenticated', ids.guest,
    `insert into storage.objects (bucket_id, name)
      values ('chat-uploads', $1)`, [`${meetingId}/meeting-image.jpg`]);
}

async function meetingContentCounts(db, userId, meetingId) {
  const messages = await as(db, 'authenticated', userId,
    'select id from public.meeting_messages where meeting_id = $1', [meetingId]);
  const polls = await as(db, 'authenticated', userId,
    'select id from public.polls where meeting_id = $1', [meetingId]);
  const uploads = await as(db, 'authenticated', userId,
    `select id from storage.objects
      where bucket_id = 'chat-uploads' and name like $1`, [`${meetingId}/%`]);
  return [messages.rows.length, polls.rows.length, uploads.rows.length];
}

async function assertMeetingWritesDenied(db, userId, meetingId, pollId) {
  await rejectsSqlState(as(db, 'authenticated', userId,
    `insert into public.meeting_messages
      (meeting_id, sender_id, sender_name, text)
      values ($1, $2, 'Late', 'Denied')`, [meetingId, userId]), '42501');
  await rejectsSqlState(as(db, 'authenticated', userId,
    `insert into public.polls (meeting_id, question, created_by, options)
      values ($1, 'Late?', $2, $3::jsonb)`, [meetingId, userId, pollOptions]), '42501');
  await rejectsSqlState(as(db, 'authenticated', userId,
    `insert into storage.objects (bucket_id, name)
      values ('chat-uploads', $1)`, [`${meetingId}/late.jpg`]), '42501');
  await rejectsSqlState(as(db, 'authenticated', userId,
    `select public.cast_vote($1::uuid, 'yes')`, [pollId]), '42501');
}

test('Supabase migrations apply and enforce meeting authorization', async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await t.test('every migration applies in order', async () => {
      await db.exec(supabaseSchema);
      const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
      assert.ok(files.length >= 10);
      for (const file of files) {
        try {
          await db.exec(readFileSync(new URL(file, migrationsDir), 'utf8'));
        } catch (error) {
          throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
        }
      }
      const tables = await db.query(`
        select tablename, rowsecurity from pg_tables
        where schemaname = 'public' and tablename like 'meeting_whiteboard%'
      `);
      assert.equal(tables.rows.length, 2);
      assert.ok(tables.rows.every((row) => row.rowsecurity));
      const folders = await db.query(
        "select storage.foldername('owner/subfolder/avatar.png') as folders"
      );
      assert.deepEqual(folders.rows[0].folders, ['owner', 'subfolder']);
    });

    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values
      ($1, 'host@orbit.test', '{}'::jsonb),
      ($2, 'guest@orbit.test', '{}'::jsonb),
      ($3, 'outsider@orbit.test', '{}'::jsonb)`,
      [ids.host, ids.guest, ids.outsider]);
    await db.query(`insert into public.meetings
      (id, host_id, title, starts_at, room_code)
      values ($1, $2, 'Test', now(), 'TST123')`, [ids.meeting, ids.host]);
    await as(db, 'service_role', ids.guest,
      'select public.join_meeting_for_token($1::uuid, $2::uuid)', [ids.meeting, ids.guest]);

    await t.test('password change is host-only and keeps flag and secret together', async () => {
      const hash = `$2b$10$${'A'.repeat(53)}`;
      const enabled = await as(db, 'authenticated', ids.host,
        'select public.set_meeting_password_hash($1::uuid, $2::text) as enabled',
        [ids.meeting, hash]);
      assert.equal(enabled.rows[0].enabled, true);
      const stored = await db.query(`select m.has_password, s.password_hash
        from public.meetings m join public.meeting_secrets s on s.meeting_id = m.id
        where m.id = $1`, [ids.meeting]);
      assert.equal(stored.rows[0].has_password, true);
      assert.equal(stored.rows[0].password_hash, hash);
      await rejectsSqlState(as(db, 'authenticated', ids.guest,
        'select public.set_meeting_password_hash($1::uuid, null)', [ids.meeting]), '42501');
      await rejectsSqlState(as(db, 'anon', ids.host,
        'select public.set_meeting_password_hash($1::uuid, null)', [ids.meeting]), '42501');
      await rejectsSqlState(as(db, 'authenticated', ids.host,
        'select public.set_meeting_password_hash($1::uuid, $2::text)',
        [ids.meeting, 'invalid']), '22023');
      const disabled = await as(db, 'authenticated', ids.host,
        'select public.set_meeting_password_hash($1::uuid, null) as enabled', [ids.meeting]);
      assert.equal(disabled.rows[0].enabled, false);
      const cleared = await db.query(`select m.has_password, s.password_hash
        from public.meetings m left join public.meeting_secrets s on s.meeting_id = m.id
        where m.id = $1`, [ids.meeting]);
      assert.equal(cleared.rows[0].has_password, false);
      assert.equal(cleared.rows[0].password_hash, null);
      await rejectsSqlState(db.query(
        'update public.meetings set has_password = true where id = $1', [ids.meeting]
      ), '23514');
      await rejectsSqlState(as(db, 'authenticated', ids.host,
        'update public.meetings set has_password = true where id = $1', [ids.meeting]), '42501');
    });

    await t.test('profile grants and private avatar paths prevent impersonation', async () => {
      const signupId = '66666666-6666-4666-8666-666666666666';
      await db.query(`insert into auth.users (id, email, raw_user_meta_data)
        values ($1, 'signup@orbit.test', '{}'::jsonb)`, [signupId]);
      await db.query('delete from public.users where id = $1', [signupId]);
      await rejectsSqlState(as(db, 'authenticated', signupId,
        `insert into public.users (id, display_name, email)
          values ($1, 'Forged', 'forged@orbit.test')`, [signupId]), '42501');
      await rejectsSqlState(as(db, 'authenticated', ids.host,
        `update public.users set email = 'forged@orbit.test' where id = $1`,
        [ids.host]), '42501');
      await rejectsSqlState(as(db, 'authenticated', ids.host,
        `update public.users set status = 'online' where id = $1`,
        [ids.host]), '42501');
      const avatarPath = `${ids.host}/avatar.jpg`;
      const otherPath = `${ids.host}/unused.jpg`;
      const bucket = await db.query(`select public, file_size_limit, allowed_mime_types
        from storage.buckets where id = 'profile-avatars'`);
      assert.equal(bucket.rows.length, 1);
      assert.equal(bucket.rows[0].public, false);
      assert.equal(Number(bucket.rows[0].file_size_limit), 5242880);
      await db.query(`update public.users
        set avatar_url = 'https://legacy.example/avatar.jpg' where id = $1`, [ids.host]);
      await as(db, 'authenticated', ids.host,
        `update public.users set display_name = 'Updated host', bio = 'Updated bio'
          where id = $1`, [ids.host]);
      const legacyProfile = await as(db, 'authenticated', ids.host,
        'select avatar_url from public.users where id = $1', [ids.host]);
      assert.equal(legacyProfile.rows[0].avatar_url, 'https://legacy.example/avatar.jpg');
      await rejectsSqlState(as(db, 'authenticated', ids.host,
        'update public.users set avatar_url = $1 where id = $2',
        [`profile-avatars/${ids.guest}/forged.jpg`, ids.host]), 'P0001');
      await rejectsSqlState(as(db, 'authenticated', ids.host,
        'update public.users set avatar_url = $1 where id = $2',
        ['https://legacy.example/new.jpg', ids.host]), 'P0001');
      await as(db, 'authenticated', ids.host,
        'update public.users set avatar_url = null where id = $1', [ids.host]);
      await as(db, 'authenticated', ids.host,
        `update public.users
          set display_name = 'Updated host', bio = 'Updated bio', avatar_url = $1
          where id = $2`, [`profile-avatars/${avatarPath}`, ids.host]);
      const profile = await as(db, 'authenticated', ids.host,
        'select display_name, bio, avatar_url from public.users where id = $1',
        [ids.host]);
      assert.deepEqual(profile.rows[0], {
        display_name: 'Updated host', bio: 'Updated bio',
        avatar_url: `profile-avatars/${avatarPath}`,
      });
      for (const name of [avatarPath, otherPath]) {
        await as(db, 'authenticated', ids.host,
          `insert into storage.objects (bucket_id, name)
            values ('profile-avatars', $1)`, [name]);
      }
      await rejectsSqlState(as(db, 'authenticated', ids.guest,
        `insert into storage.objects (bucket_id, name)
          values ('profile-avatars', $1)`, [`${ids.host}/forged.jpg`]), '42501');
      await rejectsSqlState(as(db, 'authenticated', ids.host,
        `insert into storage.objects (bucket_id, name)
          values ('profile-avatars', $1)`, [`${ids.host}/nested/forged.jpg`]), '42501');
      const ownObjects = await as(db, 'authenticated', ids.host,
        `select name from storage.objects where bucket_id = 'profile-avatars'`);
      assert.equal(ownObjects.rows.length, 2);
      const beforeContact = await as(db, 'authenticated', ids.guest,
        `select name from storage.objects where bucket_id = 'profile-avatars'`);
      assert.equal(beforeContact.rows.length, 0);
      await as(db, 'authenticated', ids.guest,
        'insert into public.contacts (owner_id, contact_id) values ($1, $2)',
        [ids.guest, ids.host]);
      const contactObjects = await as(db, 'authenticated', ids.guest,
        `select name from storage.objects where bucket_id = 'profile-avatars'`);
      assert.deepEqual(contactObjects.rows.map((row) => row.name), [avatarPath]);
    });

    await t.test('rate limit policy cannot be weakened by the caller', async () => {
      await rejectsSqlState(as(db, 'authenticated', ids.host,
        "select public.check_rate_limit('livekit-token', 100000, 0)"), '22023');
      await rejectsSqlState(as(db, 'anon', ids.host,
        "select public.check_rate_limit('livekit-token', 30, 10)"), '42501');
      let allowed = 0;
      for (let i = 0; i < 31; i++) {
        const result = await as(db, 'authenticated', ids.host,
          "select public.check_rate_limit('livekit-token', 30, 10) as allowed");
        if (result.rows[0].allowed) allowed++;
      }
      assert.equal(allowed, 30);
    });

    await t.test('whiteboard RPC and RLS enforce membership and payload rules', async () => {
      const points = JSON.stringify([{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }]);
      const strokeSql = `select public.append_meeting_whiteboard_event(
        $1::uuid, $2::text, 'stroke', $3::text, $4::jsonb) as seq`;
      const first = await as(db, 'authenticated', ids.guest, strokeSql,
        [ids.meeting, 'stroke-001', '#5B5FFF', points]);
      const duplicate = await as(db, 'authenticated', ids.guest, strokeSql,
        [ids.meeting, 'stroke-001', '#5B5FFF', points]);
      assert.equal(duplicate.rows[0].seq, first.rows[0].seq);
      await rejectsSqlState(as(db, 'authenticated', ids.guest, strokeSql,
        [ids.meeting, 'stroke-001', '#FF4D6D', points]), '23505');
      await rejectsSqlState(as(db, 'authenticated', ids.guest, strokeSql,
        [ids.meeting, 'stroke-002', '#5B5FFF',
          JSON.stringify([{ x: 2, y: 0.2 }, { x: 0.3, y: 0.4 }])]), '22023');
      const replay = await as(db, 'authenticated', ids.guest,
        'select actor_id from public.meeting_whiteboard_events where meeting_id = $1',
        [ids.meeting]);
      assert.deepEqual(replay.rows.map((row) => row.actor_id), [ids.guest]);
      const outsiderReplay = await as(db, 'authenticated', ids.outsider,
        'select seq from public.meeting_whiteboard_events where meeting_id = $1',
        [ids.meeting]);
      assert.equal(outsiderReplay.rows.length, 0);
      await rejectsSqlState(as(db, 'authenticated', ids.outsider, strokeSql,
        [ids.meeting, 'stroke-003', '#5B5FFF', points]), '42501');
      await rejectsSqlState(as(db, 'authenticated', ids.guest,
        "select public.append_meeting_whiteboard_event($1::uuid, 'clear-001', 'clear', null, null)",
        [ids.meeting]), '42501');
      const clear = await as(db, 'authenticated', ids.host,
        "select public.append_meeting_whiteboard_event($1::uuid, 'clear-001', 'clear', null, null) as seq",
        [ids.meeting]);
      assert.ok(Number(clear.rows[0].seq) > Number(first.rows[0].seq));
      await rejectsSqlState(as(db, 'authenticated', ids.guest,
        `insert into public.meeting_whiteboard_events
          (meeting_id, actor_id, client_id, kind, color, points)
          values ($1, $2, 'direct-001', 'stroke', '#5B5FFF', $3::jsonb)`,
        [ids.meeting, ids.guest, points]), '42501');
      await rejectsSqlState(as(db, 'authenticated', ids.guest,
        'select * from public.meeting_whiteboard_quotas'), '42501');
    });

    await t.test('leave, rejoin, and end revoke or restore access', async () => {
      const originalStart = (await db.query(
        'select starts_at from public.meetings where id = $1', [ids.meeting]
      )).rows[0].starts_at;
      const rescheduled = await as(db, 'authenticated', ids.host,
        `update public.meetings
          set starts_at = now() + interval '2 hours'
          where id = $1 returning starts_at`, [ids.meeting]);
      assert.equal(rescheduled.rows.length, 1);
      assert.notEqual(rescheduled.rows[0].starts_at, originalStart);
      const pollId = '77777777-7777-4777-8777-777777777777';
      await seedMeetingContent(db, ids.meeting, pollId);
      assert.deepEqual(await meetingContentCounts(db, ids.guest, ids.meeting), [1, 1, 1]);
      await rejectsSqlState(as(db, 'authenticated', ids.guest,
        `insert into storage.objects (bucket_id, name)
          values ('chat-uploads', 'not-a-uuid/image.jpg')`), '42501');
      await as(db, 'authenticated', ids.guest,
        `select public.cast_vote($1::uuid, 'yes')`, [pollId]);
      await rejectsSqlState(as(db, 'authenticated', ids.guest,
        'select public.join_meeting_for_token($1::uuid, $2::uuid)',
        [ids.meeting, ids.guest]), '42501');
      await rejectsSqlState(as(db, 'authenticated', ids.guest,
        'select public.renew_meeting_presence($1::uuid, $2::uuid)',
        [ids.meeting, ids.guest]), '42501');
      await db.query(`update public.meeting_participants
        set access_expires_at = now() - interval '1 second'
        where meeting_id = $1 and user_id = $2`, [ids.meeting, ids.guest]);
      const afterExpiry = await as(db, 'authenticated', ids.guest,
        'select seq from public.meeting_whiteboard_events where meeting_id = $1',
        [ids.meeting]);
      assert.equal(afterExpiry.rows.length, 0);
      assert.deepEqual(await meetingContentCounts(db, ids.guest, ids.meeting), [0, 0, 0]);
      await as(db, 'service_role', ids.guest,
        'select public.renew_meeting_presence($1::uuid, $2::uuid)',
        [ids.meeting, ids.guest]);
      const afterRenewal = await as(db, 'authenticated', ids.guest,
        'select seq from public.meeting_whiteboard_events where meeting_id = $1',
        [ids.meeting]);
      assert.equal(afterRenewal.rows.length, 2);
      assert.deepEqual(await meetingContentCounts(db, ids.guest, ids.meeting), [1, 1, 1]);
      await as(db, 'authenticated', ids.guest,
        'select public.leave_meeting($1::uuid)', [ids.meeting]);
      const afterLeave = await as(db, 'authenticated', ids.guest,
        'select seq from public.meeting_whiteboard_events where meeting_id = $1',
        [ids.meeting]);
      assert.equal(afterLeave.rows.length, 0);
      assert.deepEqual(await meetingContentCounts(db, ids.guest, ids.meeting), [0, 0, 0]);
      await assertMeetingWritesDenied(db, ids.guest, ids.meeting, pollId);
      await rejectsSqlState(as(db, 'authenticated', ids.guest,
        `select public.append_meeting_whiteboard_event(
          $1::uuid, 'stroke-004', 'stroke', '#5B5FFF', $2::jsonb)`,
        [ids.meeting, JSON.stringify([{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }])]), '42501');
      await as(db, 'service_role', ids.guest,
        'select public.join_meeting_for_token($1::uuid, $2::uuid)',
        [ids.meeting, ids.guest]);
      const afterRejoin = await as(db, 'authenticated', ids.guest,
        'select seq from public.meeting_whiteboard_events where meeting_id = $1',
        [ids.meeting]);
      assert.equal(afterRejoin.rows.length, 2);
      assert.deepEqual(await meetingContentCounts(db, ids.guest, ids.meeting), [1, 1, 1]);
      await rejectsSqlState(as(db, 'authenticated', ids.guest,
        'select public.end_meeting($1::uuid)', [ids.meeting]), '42501');
      await as(db, 'authenticated', ids.host,
        'select public.end_meeting($1::uuid)', [ids.meeting]);
      await assertTerminalSettingsImmutable(db, ids.meeting);
      await rejectsSqlState(as(db, 'authenticated', ids.host,
        'select public.set_meeting_password_hash($1::uuid, $2::text)',
        [ids.meeting, `$2b$10$${'A'.repeat(53)}`]), '42501');
      for (const userId of [ids.host, ids.guest]) {
        const afterEnd = await as(db, 'authenticated', userId,
          'select seq from public.meeting_whiteboard_events where meeting_id = $1',
          [ids.meeting]);
        assert.equal(afterEnd.rows.length, 0);
        assert.deepEqual(await meetingContentCounts(db, userId, ids.meeting), [0, 0, 0]);
        await assertMeetingWritesDenied(db, userId, ids.meeting, pollId);
      }
      await rejectsSqlState(as(db, 'service_role', ids.guest,
        'select public.join_meeting_for_token($1::uuid, $2::uuid)',
        [ids.meeting, ids.guest]), '42501');
      const cancelledId = '55555555-5555-4555-8555-555555555555';
      await db.query(`insert into public.meetings
        (id, host_id, title, starts_at, room_code)
        values ($1, $2, 'Cancelled', now(), 'CAN123')`,
      [cancelledId, ids.host]);
      await as(db, 'service_role', ids.guest,
        'select public.join_meeting_for_token($1::uuid, $2::uuid)',
        [cancelledId, ids.guest]);
      const cancelledPollId = '88888888-8888-4888-8888-888888888888';
      await seedMeetingContent(db, cancelledId, cancelledPollId);
      assert.deepEqual(await meetingContentCounts(db, ids.guest, cancelledId), [1, 1, 1]);
      await as(db, 'authenticated', ids.host,
        'select public.cancel_meeting($1::uuid)', [cancelledId]);
      await assertTerminalSettingsImmutable(db, cancelledId);
      for (const userId of [ids.host, ids.guest]) {
        assert.deepEqual(await meetingContentCounts(db, userId, cancelledId), [0, 0, 0]);
        await assertMeetingWritesDenied(db, userId, cancelledId, cancelledPollId);
      }
      await rejectsSqlState(as(db, 'service_role', ids.guest,
        'select public.join_meeting_for_token($1::uuid, $2::uuid)',
        [cancelledId, ids.guest]), '42501');
    });
  } finally {
    await db.close();
  }
});
