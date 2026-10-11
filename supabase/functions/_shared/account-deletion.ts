import { createClient } from 'npm:@supabase/supabase-js@2';
import { RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';

type StoredObject = { bucket_id: string; name: string };
type Admin = ReturnType<typeof createClient>;
export type DeletionClaim = { user_id: string; claim_token: string };

export function createDeletionAdmin() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Deletion service is not configured.');
  return createClient(url, key);
}

async function checkpoint(admin: Admin, claim: DeletionClaim, step: string, cursor?: string) {
  const { data, error } = await admin.rpc('account_deletion_checkpoint', {
    p_user_id: claim.user_id,
    p_claim_token: claim.claim_token,
    p_step: step,
    p_cursor: cursor ?? null,
  });
  if (error) throw error;
  if (data !== true) throw new Error('Deletion claim expired or was superseded.');
}

/** Removes a bounded amount per request. A retry resumes from Storage's
 * remaining objects, so partial network failures never skip a file. */
async function removeAccountObjects(admin: Admin, claim: DeletionClaim) {
  const uid = claim.user_id;
  for (let round = 0; round < 1; round++) {
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
      await checkpoint(admin, claim, 'renew');
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
async function disconnectFromLiveKit(admin: Admin, claim: DeletionClaim) {
  const uid = claim.user_id;
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
      await checkpoint(admin, claim, 'renew');
      const active = await rooms.listRooms([meetingId]);
      if (active.length > 0) {
        try {
          await checkpoint(admin, claim, 'renew');
          await rooms.removeParticipant(meetingId, uid, { revokeTokenTs });
        } catch (error) {
          if (!(error instanceof Error && /not found/i.test(error.message))) throw error;
        }
        let memberQuery = admin.from('meeting_participants').select('user_id')
          .eq('meeting_id', meetingId).order('user_id', { ascending: true }).limit(10);
        if (state.hosted_member_cursor) {
          memberQuery = memberQuery.gt('user_id', state.hosted_member_cursor);
        }
        const { data: members, error } = await memberQuery;
        if (error) throw error;
        for (const member of members ?? []) {
          const identity = member.user_id as string;
          if (identity !== uid) {
            try {
              await checkpoint(admin, claim, 'renew');
              await rooms.removeParticipant(meetingId, identity, { revokeTokenTs });
            } catch (error) {
              if (!(error instanceof Error && /not found/i.test(error.message))) throw error;
            }
          }
          await checkpoint(admin, claim, 'hosted_member', identity);
        }
        if ((members ?? []).length === 10) return false;
        await checkpoint(admin, claim, 'renew');
        await rooms.deleteRoom(meetingId);
      }
      await checkpoint(admin, claim, 'hosted_room', meetingId);
      return false;
    }
    await checkpoint(admin, claim, 'hosted_done');
  }

  if (state.joined_rooms_done) return true;
  const joined = await nextIds(admin, 'meeting_participants', 'user_id', 'meeting_id', uid,
    state.joined_room_cursor);
  const meetingId = joined[0];
  if (meetingId) {
    await checkpoint(admin, claim, 'renew');
    const active = await rooms.listRooms([meetingId]);
    if (active.length > 0) {
      try {
        await checkpoint(admin, claim, 'renew');
        await rooms.removeParticipant(meetingId, uid, { revokeTokenTs });
      } catch (error) {
        if (!(error instanceof Error && /not found/i.test(error.message))) throw error;
      }
    }
    await checkpoint(admin, claim, 'joined_room', meetingId);
    return false;
  }
  await checkpoint(admin, claim, 'joined_done');
  return true;
}

export async function requireLiveKitWhenMeetingsExist(admin: Admin, uid: string) {
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

export async function claimDeletion(admin: Admin, uid: string | null): Promise<DeletionClaim | null> {
  const { data, error } = await admin.rpc('account_deletion_claim', {
    p_user_id: uid,
    p_lease_seconds: 600,
  });
  if (error) throw error;
  return ((data ?? []) as DeletionClaim[])[0] ?? null;
}

async function finishClaim(admin: Admin, claim: DeletionClaim, failed: boolean) {
  const { data, error } = await admin.rpc('account_deletion_finish', {
    p_user_id: claim.user_id,
    p_claim_token: claim.claim_token,
    p_failed: failed,
  });
  if (error) throw error;
  if (data !== true) throw new Error('Deletion claim expired or was superseded.');
}

/** One bounded, idempotent cleanup slice. Both the user endpoint and the
 * scheduled worker must hold the same database claim before entering here. */
export async function processDeletion(admin: Admin, claim: DeletionClaim): Promise<boolean> {
  const uid = claim.user_id;
  try {
    await checkpoint(admin, claim, 'renew');
    await requireLiveKitWhenMeetingsExist(admin, uid);

    // Close admission before external cleanup. The tombstone rejects new
    // writes even when a retry is needed after a process interruption.
    await checkpoint(admin, claim, 'renew');
    const { error: closeError } = await admin.from('meetings')
      .update({ ended_at: new Date().toISOString() })
      .eq('host_id', uid).is('ended_at', null).is('cancelled_at', null);
    if (closeError) throw closeError;

    if (!await disconnectFromLiveKit(admin, claim)) {
      await finishClaim(admin, claim, false);
      return false;
    }
    if (!await removeAccountObjects(admin, claim)) {
      await finishClaim(admin, claim, false);
      return false;
    }

    // This is the final destructive step. A hosted Edge invocation is shorter
    // than the ten-minute lease; renew immediately before calling Auth.
    await checkpoint(admin, claim, 'renew');
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) throw deleteError;
    // Auth deletion cascades the pending request and its lease.
    return true;
  } catch (error) {
    try {
      await finishClaim(admin, claim, true);
    } catch (finishError) {
      console.error('account deletion claim could not be released', finishError);
    }
    throw error;
  }
}
