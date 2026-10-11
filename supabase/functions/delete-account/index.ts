import { createClient } from 'npm:@supabase/supabase-js@2';
import { RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

type StoredObject = { bucket_id: string; name: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionIdFromVerifiedToken(token: string, verifiedUserId: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as {
      sub?: unknown; session_id?: unknown;
    };
    return claims.sub === verifiedUserId && typeof claims.session_id === 'string' && UUID.test(claims.session_id)
      ? claims.session_id : null;
  } catch {
    return null;
  }
}

/** Removes a bounded amount per request. A retry resumes from Storage's
 * remaining objects, so partial network failures never skip a file. */
async function removeAccountObjects(admin: ReturnType<typeof createClient>, uid: string) {
  for (let round = 0; round < 5; round++) {
    const { data, error } = await admin.rpc('account_deletion_storage_objects', {
      p_user_id: uid,
      p_limit: 100,
    });
    if (error) throw error;
    const objects = (data ?? []) as StoredObject[];
    if (objects.length === 0) return true;

    const byBucket = new Map<string, string[]>();
    for (const object of objects) {
      const paths = byBucket.get(object.bucket_id) ?? [];
      paths.push(object.name);
      byBucket.set(object.bucket_id, paths);
    }
    for (const [bucket, paths] of byBucket) {
      // Only the Storage API removes the bytes as well as storage.objects rows.
      const { error: removeError } = await admin.storage.from(bucket).remove(paths);
      if (removeError) throw removeError;
    }
  }
  const { data, error } = await admin.rpc('account_deletion_storage_objects', {
    p_user_id: uid,
    p_limit: 1,
  });
  if (error) throw error;
  return ((data ?? []) as StoredObject[]).length === 0;
}

async function nextIds(
  admin: ReturnType<typeof createClient>,
  table: 'meetings' | 'meeting_participants',
  filterColumn: 'host_id' | 'user_id',
  resultColumn: 'id' | 'meeting_id',
  uid: string,
  cursor: string | null,
) {
  let query = admin.from(table).select(resultColumn).eq(filterColumn, uid)
    .order(resultColumn, { ascending: true }).limit(5);
  if (cursor) query = query.gt(resultColumn, cursor);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, string>[])
    .map((row) => row[resultColumn]);
}

/** Close hosted rooms and remove the user's identity from meetings they joined.
 * Auth deletion is deliberately last: if LiveKit is unavailable, the request
 * can be retried instead of leaving a connected deleted user. */
async function disconnectFromLiveKit(admin: ReturnType<typeof createClient>, uid: string) {
  const url = Deno.env.get('LIVEKIT_URL');
  const key = Deno.env.get('LIVEKIT_API_KEY');
  const secret = Deno.env.get('LIVEKIT_API_SECRET');
  if (!url && !key && !secret) return true;
  if (!url || !key || !secret) throw new Error('LiveKit room service is not fully configured.');

  const roomServiceUrl = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  const rooms = new RoomServiceClient(roomServiceUrl, key, secret);
  const revokeTokenTs = BigInt(Math.floor(Date.now() / 1000) + 30);
  const { data: state, error: stateError } = await admin.from('account_deletion_requests')
    .select('hosted_room_cursor, hosted_member_cursor, hosted_rooms_done, joined_room_cursor, joined_rooms_done')
    .eq('user_id', uid).single();
  if (stateError || !state) throw stateError ?? new Error('Deletion checkpoint is unavailable.');

  if (!state.hosted_rooms_done) {
    const hosted = await nextIds(admin, 'meetings', 'host_id', 'id', uid, state.hosted_room_cursor);
    const meetingId = hosted[0];
    if (meetingId) {
      const active = await rooms.listRooms([meetingId]);
      if (active.length > 0) {
        try {
          await rooms.removeParticipant(meetingId, uid, { revokeTokenTs });
        } catch (error) {
          if (!(error instanceof Error && /not found/i.test(error.message))) throw error;
        }
        let memberQuery = admin.from('meeting_participants').select('user_id')
          .eq('meeting_id', meetingId).order('user_id', { ascending: true }).limit(25);
        if (state.hosted_member_cursor) {
          memberQuery = memberQuery.gt('user_id', state.hosted_member_cursor);
        }
        const { data: members, error } = await memberQuery;
        if (error) throw error;
        for (const member of members ?? []) {
          const identity = member.user_id as string;
          if (identity !== uid) {
            try {
              await rooms.removeParticipant(meetingId, identity, { revokeTokenTs });
            } catch (error) {
              if (!(error instanceof Error && /not found/i.test(error.message))) throw error;
            }
          }
          const { error: memberCheckpointError } = await admin.from('account_deletion_requests')
            .update({ hosted_member_cursor: identity }).eq('user_id', uid);
          if (memberCheckpointError) throw memberCheckpointError;
        }
        if ((members ?? []).length === 25) return false;
        await rooms.deleteRoom(meetingId);
      }
      const { error: checkpointError } = await admin.from('account_deletion_requests')
        .update({ hosted_room_cursor: meetingId, hosted_member_cursor: null }).eq('user_id', uid);
      if (checkpointError) throw checkpointError;
      return false;
    }
    const { error: doneError } = await admin.from('account_deletion_requests')
      .update({ hosted_rooms_done: true }).eq('user_id', uid);
    if (doneError) throw doneError;
  }

  if (state.joined_rooms_done) return true;
  const joined = await nextIds(admin, 'meeting_participants', 'user_id', 'meeting_id', uid,
    state.joined_room_cursor);
  const meetingId = joined[0];
  if (meetingId) {
    const active = await rooms.listRooms([meetingId]);
    if (active.length > 0) {
      try {
        await rooms.removeParticipant(meetingId, uid, { revokeTokenTs });
      } catch (error) {
        if (!(error instanceof Error && /not found/i.test(error.message))) throw error;
      }
    }
    const { error: checkpointError } = await admin.from('account_deletion_requests')
      .update({ joined_room_cursor: meetingId }).eq('user_id', uid);
    if (checkpointError) throw checkpointError;
    return false;
  }
  const { error: doneError } = await admin.from('account_deletion_requests')
    .update({ joined_rooms_done: true }).eq('user_id', uid);
  if (doneError) throw doneError;
  return true;
}

async function requireLiveKitWhenMeetingsExist(admin: ReturnType<typeof createClient>, uid: string) {
  const url = Deno.env.get('LIVEKIT_URL');
  const key = Deno.env.get('LIVEKIT_API_KEY');
  const secret = Deno.env.get('LIVEKIT_API_SECRET');
  if (url && key && secret) return;
  const [hosted, joined] = await Promise.all([
    nextIds(admin, 'meetings', 'host_id', 'id', uid, null),
    nextIds(admin, 'meeting_participants', 'user_id', 'meeting_id', uid, null),
  ]);
  if (hosted.length || joined.length || url || key || secret) {
    throw new Error('LiveKit room cleanup is unavailable.');
  }
}

/** Caller identity is obtained solely from the verified access token. The
 * request body cannot choose a user ID or access the service key. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Sign in required.' }, 401);
  const body = await req.json().catch(() => null) as { confirmation?: unknown } | null;
  if (body?.confirmation !== 'DELETE') return json({ error: 'Explicit deletion confirmation required.' }, 400);

  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Sign in required.' }, 401);
    const uid = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: existingRequest, error: existingError } = await admin
      .from('account_deletion_requests').select('user_id').eq('user_id', uid).maybeSingle();
    if (existingError) throw existingError;
    if (!existingRequest) {
      const sessionId = sessionIdFromVerifiedToken(authHeader.slice('Bearer '.length), uid);
      if (!sessionId) return json({ error: 'A fresh sign-in is required before deletion.' }, 403);
      const { data: fresh, error: freshError } = await admin.rpc('account_deletion_session_is_fresh', {
        p_user_id: uid,
        p_session_id: sessionId,
      });
      if (freshError) throw freshError;
      if (!fresh) return json({ error: 'Sign out and sign back in, then retry deletion within 10 minutes.' }, 403);
    }

    // Do not lock the account into deletion if its active media service cannot
    // be reached by this function.
    await requireLiveKitWhenMeetingsExist(admin, uid);

    // Persist the intent before cross-service cleanup. Storage INSERT policies
    // and DM creation now reject this account, including on every retry.
    const { error: requestError } = await admin.from('account_deletion_requests')
      .upsert({ user_id: uid }, { onConflict: 'user_id' });
    if (requestError) throw requestError;

    // Close DB-side meeting admission immediately, even if file cleanup takes
    // many invocations. Media disconnection below is still required.
    const { error: closeError } = await admin.from('meetings')
      .update({ ended_at: new Date().toISOString() })
      .eq('host_id', uid).is('ended_at', null).is('cancelled_at', null);
    if (closeError) throw closeError;

    const liveKitDone = await disconnectFromLiveKit(admin, uid);
    if (!liveKitDone) return json({ remaining: true }, 202);

    const storageDone = await removeAccountObjects(admin, uid);
    if (!storageDone) return json({ remaining: true }, 202);

    // The public.users BEFORE DELETE trigger removes shared DMs, authored
    // messages and polls in the same Postgres transaction as the Auth delete.
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) throw deleteError;
    return json({ deleted: true });
  } catch (error) {
    console.error('delete-account failed', error);
    return json({ error: 'Account deletion could not finish. Please retry.', retryable: true }, 503);
  }
});
