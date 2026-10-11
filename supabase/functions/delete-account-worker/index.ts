import { claimDeletion, createDeletionAdmin, processDeletion } from '../_shared/account-deletion.ts';
import { verifyDeletionWorkerTrigger } from '../_shared/deletion-worker-trigger.ts';

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/** pg_net must never queue a Supabase service key or a reusable worker secret.
 * Cron signs the current Unix timestamp with a dedicated secret in Vault; the
 * queued request carries only the timestamp and its short-lived MAC. */
async function validTrigger(req: Request): Promise<boolean> {
  return verifyDeletionWorkerTrigger(
    Deno.env.get('ORBIT_ACCOUNT_DELETION_WORKER_SECRET'),
    req.headers.get('x-orbit-worker-ts'),
    req.headers.get('x-orbit-worker-signature'),
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!await validTrigger(req)) return json({ error: 'Unauthorized.' }, 401);

  try {
    const admin = createDeletionAdmin();
    // No user ID is accepted from the caller. The worker only advances an
    // existing tombstone and processes one bounded slice per invocation.
    const claim = await claimDeletion(admin, null);
    if (!claim) return json({ claimed: false });
    const deleted = await processDeletion(admin, claim);
    return json({ claimed: true, deleted, remaining: !deleted });
  } catch (error) {
    console.error('delete-account-worker failed', error);
    // pg_net stores responses; never include account identifiers or secrets.
    return json({ error: 'Worker retry scheduled.' }, 503);
  }
});
