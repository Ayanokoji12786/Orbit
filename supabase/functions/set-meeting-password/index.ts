import { createClient } from 'npm:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/**
 * Host-only. Sets or clears a meeting's password (stored hashed, never
 * readable by clients).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sign in required.' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Sign in required.' }, 401);
    const uid = userData.user.id;

    const { meetingId, password } = (await req.json()) as { meetingId?: string; password?: string | null };
    if (!meetingId) return json({ error: 'meetingId is required.' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: meeting } = await admin.from('meetings').select('id, host_id').eq('id', meetingId).maybeSingle();
    if (!meeting) return json({ error: 'Meeting not found.' }, 404);
    if (meeting.host_id !== uid) return json({ error: 'Only the host can set a meeting password.' }, 403);

    const trimmed = password?.trim();

    if (!trimmed) {
      await admin.from('meetings').update({ has_password: false }).eq('id', meetingId);
      await admin.from('meeting_secrets').delete().eq('meeting_id', meetingId);
      return json({ hasPassword: false });
    }

    const passwordHash = bcrypt.hashSync(trimmed, 10);
    await admin.from('meetings').update({ has_password: true }).eq('id', meetingId);
    await admin.from('meeting_secrets').upsert({ meeting_id: meetingId, password_hash: passwordHash });
    return json({ hasPassword: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Unexpected error.' }, 500);
  }
});
