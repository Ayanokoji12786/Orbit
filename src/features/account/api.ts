import * as Notifications from 'expo-notifications';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

type DeleteResponse = { deleted?: boolean; remaining?: boolean; retryAfterMs?: number; error?: string };

const safeServerErrors = new Set([
  'Sign in required.',
  'A fresh sign-in is required before deletion.',
  'Sign out and sign back in, then retry deletion within 10 minutes.',
  'Account deletion could not finish. Please retry.',
]);

type DeleteResult = {
  verifiedDeleted: boolean;
  reminderCleanupFailed: boolean;
  signOutFailed: boolean;
};

async function clearThisDevice(client: NonNullable<typeof supabase>): Promise<Omit<DeleteResult, 'verifiedDeleted'>> {
  let reminderCleanupFailed = false;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    reminderCleanupFailed = true;
  }
  let signOutFailed = false;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    signOutFailed = Boolean(error);
  } catch {
    signOutFailed = true;
  }
  useAuthStore.getState().setSignedOut();
  return { reminderCleanupFailed, signOutFailed };
}

/** The function derives identity from the user's verified session. It removes
 * a bounded number of Storage objects per call, so repeat 202 responses. */
export async function deleteOwnAccount(): Promise<DeleteResult> {
  if (!supabase) throw new Error('Connect a Supabase project to delete your account.');
  const client = supabase;
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    if (!userError || (userError.status !== undefined && [400, 401, 403, 404].includes(userError.status))) {
      // A prior invocation may have deleted Auth but lost its HTTP response.
      // Clear local state, but do not claim deletion without server proof.
      return { verifiedDeleted: false, ...await clearThisDevice(client) };
    }
    throw new Error('Could not verify your session. Check your connection and retry.');
  }

  let deleted = false;
  let sawPending = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await client.functions.invoke<DeleteResponse>('delete-account', {
      body: { confirmation: 'DELETE' },
    });
    if (error) {
      const context = (error as { context?: unknown }).context;
      if (context instanceof Response) {
        if (sawPending && [401, 404].includes(context.status)) {
          // A scheduled worker may have removed Auth after our previous 202.
          // Clear this device, but keep the result explicitly unverified.
          return { verifiedDeleted: false, ...await clearThisDevice(client) };
        }
        const payload = await context.clone().json().catch(() => null) as DeleteResponse | null;
        if (payload?.error && safeServerErrors.has(payload.error)) throw new Error(payload.error);
        if (context.status === 403) {
          throw new Error('Sign out and sign back in, then retry deletion within 10 minutes.');
        }
      }
      throw new Error('Account deletion could not finish. Try again; completed cleanup will not be repeated.');
    }
    if (data?.deleted === true) {
      deleted = true;
      break;
    }
    if (data?.remaining !== true) throw new Error(data?.error ?? 'Unexpected account deletion response.');
    sawPending = true;
    if (attempt < 19) {
      const retryAfterMs = typeof data.retryAfterMs === 'number' && Number.isFinite(data.retryAfterMs)
        ? Math.min(5000, Math.max(250, data.retryAfterMs))
        : 500;
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
    }
  }
  if (!deleted) throw new Error('A large file library needs more cleanup. Tap Delete account again to continue.');

  // The backend hard-delete invalidates refresh sessions; clear this device
  // and its reminders too. Cleanup failure cannot undo server deletion.
  return { verifiedDeleted: true, ...await clearThisDevice(client) };
}
