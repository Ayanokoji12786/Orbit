import { createClient } from 'npm:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sign in required.' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Sign in required.' }, 401);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request body.' }, 400);
    const { meetingId, password } = body as Record<string, unknown>;
    if (typeof meetingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meetingId)) {
      return json({ error: 'A valid meeting ID is required.' }, 400);
    }
    if (!Object.prototype.hasOwnProperty.call(body, 'password') || (password !== null && typeof password !== 'string')) {
      return json({ error: 'Provide a password or null to remove it.' }, 400);
    }

    let passwordHash: string | null = null;
    if (typeof password === 'string') {
      const trimmed = password.trim();
      const bytes = new TextEncoder().encode(trimmed).length;
      if (trimmed.length < 8 || bytes > 72) {
        return json({ error: 'Use a password of at least 8 characters and at most 72 bytes.' }, 400);
      }
      passwordHash = bcrypt.hashSync(trimmed, 10);
    }

    // The host check, secret write, and flag update run in one database transaction.
    const { data: hasPassword, error: saveError } = await userClient.rpc('set_meeting_password_hash', {
      p_meeting_id: meetingId,
      p_password_hash: passwordHash,
    });
    if (saveError) {
      if (saveError.code === 'P0002') return json({ error: 'Meeting not found.' }, 404);
      if (saveError.code === '42501') return json({ error: 'Only the host can change the meeting password.' }, 403);
      console.error('set_meeting_password_hash failed', saveError);
      return json({ error: 'Could not update the meeting password. Try again.' }, 500);
    }
    if (typeof hasPassword !== 'boolean') return json({ error: 'Could not confirm the meeting password change.' }, 500);
    return json({ hasPassword });
  } catch (err) {
    console.error(err);
    return json({ error: 'Unexpected error.' }, 500);
  }
});
