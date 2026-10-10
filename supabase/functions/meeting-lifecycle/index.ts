import { createClient } from 'npm:@supabase/supabase-js@2';
import { RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL')!;
const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')!;
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type Action = 'leave' | 'end' | 'cancel' | 'renew';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * DB authorization is the source of truth. The LiveKit room service then
 * removes an individual leaver or disconnects everyone in an ended/cancelled
 * room. End/cancel RPCs are idempotent so a failed room-service call can be
 * retried without reopening access.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sign in required.' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Sign in required.' }, 401);

    const body = await req.json().catch(() => null) as { action?: Action; meetingId?: string } | null;
    if (!body || !['leave', 'end', 'cancel', 'renew'].includes(body.action ?? '') ||
        typeof body.meetingId !== 'string' || !UUID.test(body.meetingId)) {
      return json({ error: 'A valid meeting and action are required.' }, 400);
    }
    const action = body.action!;
    const meetingId = body.meetingId;
    const roomServiceUrl = LIVEKIT_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    const rooms = new RoomServiceClient(roomServiceUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    if (action === 'renew') {
      const { data: allowed, error: rateError } = await userClient.rpc('check_rate_limit', {
        p_bucket: 'livekit-token',
        p_max_calls: 30,
        p_window_minutes: 10,
      });
      if (rateError) {
        console.error('check_rate_limit failed', rateError);
        return json({ error: 'Meeting access could not be renewed right now.' }, 503);
      }
      if (!allowed) return json({ error: 'Too many meeting requests. Try again shortly.' }, 429);
      // A signed-in user who kept an old meeting UUID cannot prolong their
      // lease: only an actually connected LiveKit identity can renew it.
      let connected = false;
      try {
        const participants = await rooms.listParticipants(meetingId);
        connected = participants.some((participant) => participant.identity === userData.user.id);
      } catch (roomError) {
        console.error('LiveKit presence lookup failed', roomError);
        return json({ error: 'Could not verify meeting presence. Try again.' }, 503);
      }
      if (!connected) return json({ error: 'You are no longer connected to this meeting.' }, 403);
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { error: renewError } = await admin.rpc('renew_meeting_presence', {
        p_meeting_id: meetingId,
        p_user_id: userData.user.id,
      });
      if (renewError) {
        console.error('renew_meeting_presence failed', renewError);
        return json({ error: 'Meeting access could not be renewed. Rejoin the meeting.' }, 403);
      }
      return json({ renewed: true });
    }

    // These are caller-scoped RPCs. A caller cannot end/cancel another host's
    // room even if they know its UUID or room code.
    const operation = action === 'leave' ? 'leave_meeting'
      : action === 'end' ? 'end_meeting' : 'cancel_meeting';
    const { error: dbError } = await userClient.rpc(operation, { p_meeting_id: meetingId });
    if (dbError) {
      console.error(`${operation} failed`, dbError);
      if (dbError.code === '42501') return json({ error: dbError.message }, 403);
      if (dbError.code === 'P0002') return json({ error: 'Meeting not found.' }, 404);
      if (dbError.code === '22023') return json({ error: dbError.message }, 409);
      return json({ error: 'Could not update this meeting. Try again.' }, 503);
    }

    try {
      // Cloud revokes tokens even for identities no longer connected when an
      // explicit cutoff is supplied. It also disconnects any active identity.
      // The short token TTL bounds stale-token reuse on self-hosted LiveKit,
      // where server-side revocation is not available.
      const revokeTokenTs = BigInt(Math.floor(Date.now() / 1000) + 30);
      if (action === 'leave') {
        await rooms.removeParticipant(meetingId, userData.user.id, { revokeTokenTs });
      } else {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        const [participantResult, meetingResult] = await Promise.all([
          admin.from('meeting_participants').select('user_id').eq('meeting_id', meetingId),
          admin.from('meetings').select('host_id').eq('id', meetingId).single(),
        ]);
        if (participantResult.error || meetingResult.error) {
          throw new Error('Could not load room participants for token revocation.');
        }
        const identities = new Set<string>([
          meetingResult.data.host_id,
          ...(participantResult.data ?? []).map((participant) => participant.user_id),
        ]);
        let revocationFailed = false;
        for (const identity of identities) {
          try {
            await rooms.removeParticipant(meetingId, identity, { revokeTokenTs });
          } catch (error) {
            revocationFailed = true;
            console.error('LiveKit token revocation failed', error);
          }
        }
        const active = await rooms.listRooms([meetingId]);
        if (active.length > 0) await rooms.deleteRoom(meetingId);
        if (revocationFailed) throw new Error('One or more participant tokens were not revoked.');
      }
    } catch (roomError) {
      console.error('LiveKit room cleanup failed', roomError);
      return json({
        error: 'Meeting access was updated, but room cleanup failed. Try again.',
        retryable: true,
      }, 503);
    }

    return json(action === 'cancel' ? { cancelled: true }
      : action === 'end' ? { ended: true } : { left: true });
  } catch (error) {
    console.error('meeting-lifecycle failed', error);
    return json({ error: 'Unexpected meeting error.' }, 500);
  }
});
