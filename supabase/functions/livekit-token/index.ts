import { createClient } from 'npm:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { AccessToken } from 'npm:livekit-server-sdk@2.9.2';

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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sign in required.' }, 401);

    // User-scoped client verifies the caller's JWT (forwarded automatically by supabase.functions.invoke).
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Sign in required.' }, 401);

    const uid = userData.user.id;
    const displayName =
      (userData.user.user_metadata?.full_name as string | undefined) ?? userData.user.email ?? 'Guest';

    const { data: allowed } = await userClient.rpc('check_rate_limit', {
      p_bucket: 'livekit-token',
      p_max_calls: 30,
      p_window_minutes: 10,
    });
    if (!allowed) return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429);

    const { roomCode, password } = (await req.json()) as { roomCode?: string; password?: string };
    const trimmedCode = roomCode?.trim();
    if (!trimmedCode) return json({ error: 'roomCode is required.' }, 400);

    // Service-role client bypasses RLS for the meeting lookup, secret check, and participant upsert.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: meeting } = await admin
      .from('meetings')
      .select('id, title, has_password')
      .eq('room_code', trimmedCode)
      .maybeSingle();
    if (!meeting) return json({ error: 'Meeting not found.' }, 404);

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

    await admin
      .from('meeting_participants')
      .upsert({ meeting_id: meeting.id, user_id: uid, joined_at: new Date().toISOString() }, { onConflict: 'meeting_id,user_id' });

    const accessToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: uid,
      name: displayName,
      ttl: '4h',
    });
    accessToken.addGrant({ room: meeting.id, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });

    return json({
      token: await accessToken.toJwt(),
      url: LIVEKIT_URL,
      roomName: meeting.id,
      meetingTitle: meeting.title,
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Unexpected error.' }, 500);
  }
});
