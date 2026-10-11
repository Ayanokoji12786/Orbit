import { createClient } from 'npm:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { AccessToken } from 'npm:livekit-server-sdk@2.19.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')!;
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')!;
const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/**
 * Validates a meeting join (room code + optional password), records the
 * participant, and mints a LiveKit access token. The LiveKit API secret
 * only ever lives in this function's environment.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sign in required.' }, 401);

    // User-scoped client verifies the caller's JWT (forwarded automatically by supabase.functions.invoke).
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Sign in required.' }, 401);

    const { data: accountActive, error: accountError } = await userClient.rpc('account_is_active');
    if (accountError) return json({ error: 'Meeting join is temporarily unavailable.' }, 503);
    if (!accountActive) return json({ error: 'This account is being deleted.' }, 410);

    const uid = userData.user.id;
    const { data: profile } = await userClient.from('users')
      .select('display_name').eq('id', uid).maybeSingle();
    const displayName = (
      (typeof profile?.display_name === 'string' && profile.display_name.trim()) ||
      (typeof userData.user.user_metadata?.full_name === 'string' && userData.user.user_metadata.full_name.trim()) ||
      userData.user.email || 'Guest'
    ).slice(0, 80);

    // Destructure the error: without it any RPC failure yields data === null, which
    // reads as "not allowed" and 429s every request with a misleading message.
    const { data: allowed, error: rateErr } = await userClient.rpc('check_rate_limit', {
      p_bucket: 'livekit-token',
      p_max_calls: 30,
      p_window_minutes: 10,
    });
    if (rateErr) {
      // A limiter outage must not turn password-protected rooms into an
      // unlimited online guessing endpoint.
      console.error('check_rate_limit failed', rateErr);
      return json({ error: 'Meeting join is temporarily unavailable. Try again shortly.' }, 503);
    }
    if (!allowed) {
      return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429);
    }

    const body = await req.json().catch(() => null) as { roomCode?: unknown; password?: unknown } | null;
    const trimmedCode = typeof body?.roomCode === 'string' ? body.roomCode.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : undefined;
    if (!/^[a-z0-9]{6}$/.test(trimmedCode)) return json({ error: 'A valid six-character room code is required.' }, 400);

    // Service-role client bypasses RLS for meeting and secret lookup. The join
    // RPC is the only privileged writer of participant membership.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: meeting, error: meetingError } = await admin
      .from('meetings')
      .select('id, title, has_password, host_id, ended_at, cancelled_at')
      .eq('room_code', trimmedCode)
      .maybeSingle();
    if (meetingError) {
      console.error('meeting lookup failed', meetingError);
      return json({ error: 'Meeting join is temporarily unavailable. Try again shortly.' }, 503);
    }
    if (!meeting) return json({ error: 'Meeting not found.' }, 404);
    if (meeting.cancelled_at) return json({ error: 'This meeting was cancelled.' }, 410);
    if (meeting.ended_at) return json({ error: 'This meeting has ended.' }, 410);
    const { data: hostDeletion, error: hostDeletionError } = await admin
      .from('account_deletion_requests').select('user_id')
      .eq('user_id', meeting.host_id).maybeSingle();
    if (hostDeletionError) return json({ error: 'Meeting join is temporarily unavailable.' }, 503);
    if (hostDeletion) return json({ error: 'This meeting is closing.' }, 410);

    if (meeting.has_password) {
      const { data: secret } = await admin
        .from('meeting_secrets')
        .select('password_hash')
        .eq('meeting_id', meeting.id)
        .maybeSingle();

      if (!password) return json({ error: 'Password required.' }, 401);
      if (!secret || !bcrypt.compareSync(password, secret.password_hash)) {
        return json({ error: 'Incorrect password.' }, 403);
      }
    }

    // Only this service-role caller may activate a participant row. The RPC
    // locks the meeting against end/cancel so a late request cannot reopen it.
    const { error: participantErr } = await admin.rpc('join_meeting_for_token', {
      p_meeting_id: meeting.id,
      p_user_id: uid,
    });
    if (participantErr) {
      console.error('join_meeting_for_token failed', participantErr);
      if (participantErr.code === '42501') return json({ error: 'This meeting is no longer open.' }, 410);
      return json({ error: 'Could not join this meeting. Try again.' }, 500);
    }

    // The deletion request can be created while password verification and
    // participant admission run. Check once more immediately before minting.
    const [finalAccount, finalHost] = await Promise.all([
      userClient.rpc('account_is_active'),
      admin.from('account_deletion_requests').select('user_id')
        .eq('user_id', meeting.host_id).maybeSingle(),
    ]);
    if (finalAccount.error || finalHost.error) {
      return json({ error: 'Meeting join is temporarily unavailable.' }, 503);
    }
    if (!finalAccount.data || finalHost.data) {
      return json({ error: 'This meeting is closing.' }, 410);
    }

    const accessToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: uid,
      name: displayName,
      // Existing tokens can otherwise reconnect after a host ends the room.
      // Connected media sessions are unaffected by token expiry; the lifecycle
      // endpoint also deletes the room or removes an individual participant.
      ttl: '60s',
    });
    accessToken.addGrant({
      room: meeting.id,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    });

    return json({
      token: await accessToken.toJwt(),
      url: LIVEKIT_URL,
      roomName: meeting.id,
      meetingTitle: meeting.title,
      isHost: meeting.host_id === uid,
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Unexpected error.' }, 500);
  }
});
