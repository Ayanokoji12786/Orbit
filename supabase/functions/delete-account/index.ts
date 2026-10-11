import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  claimDeletion,
  createDeletionAdmin,
  processDeletion,
  requireLiveKitWhenMeetingsExist,
} from '../_shared/account-deletion.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

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

/** The verified caller can create only their own deletion request. A pending
 * request can be resumed by this endpoint or the scheduled service worker. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Sign in required.' }, 401);
  const body = await req.json().catch(() => null) as { confirmation?: unknown } | null;
  if (body?.confirmation !== 'DELETE') return json({ error: 'Explicit deletion confirmation required.' }, 400);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !anonKey) throw new Error('Auth service is not configured.');
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Sign in required.' }, 401);
    const uid = userData.user.id;
    const admin = createDeletionAdmin();

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
      // Before creating a tombstone, fail closed when active meetings cannot
      // be disconnected because LiveKit credentials are absent.
      await requireLiveKitWhenMeetingsExist(admin, uid);
    }

    const { error: requestError } = await admin.from('account_deletion_requests')
      .upsert({ user_id: uid }, { onConflict: 'user_id' });
    if (requestError) throw requestError;

    const claim = await claimDeletion(admin, uid);
    if (!claim) return json({ remaining: true, retryAfterMs: 2000 }, 202);
    const deleted = await processDeletion(admin, claim);
    return deleted ? json({ deleted: true }) : json({ remaining: true, retryAfterMs: 2000 }, 202);
  } catch (error) {
    console.error('delete-account failed', error);
    return json({ error: 'Account deletion could not finish. Please retry.', retryable: true }, 503);
  }
});
