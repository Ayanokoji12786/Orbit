import { isAuthApiError, type SupabaseClient } from '@supabase/supabase-js';

type RecoveryAuth = Pick<SupabaseClient['auth'], 'signInWithOtp' | 'verifyOtp'>;

function verificationFailure(error: unknown) {
  const authError = isAuthApiError(error) ? error : null;
  return new Error(
    authError && authError.status < 500 && authError.status !== 429
      ? 'That code is invalid or has expired. Request a new code and try again.'
      : 'Could not verify the code right now. Check your connection and try again later.',
  );
}

/**
 * Request a code for an existing account only. GoTrue can distinguish an unknown
 * address in its response; the app must not expose that distinction to callers.
 */
export async function requestExistingAccountCode(auth: RecoveryAuth, email: string) {
  try {
    const { error } = await auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    if (!error) return;
    // Unknown accounts can produce a 4xx response. Keep that response generic,
    // but do not pretend an email was sent when Auth is rate-limited or down.
    if (isAuthApiError(error) && error.status < 500 && error.status !== 429) return;
  } catch (error) {
    if (isAuthApiError(error) && error.status < 500 && error.status !== 429) return;
  }
  throw new Error('Could not request a code right now. Check your connection and try again later.');
}

/** A valid email OTP creates a fresh session even when local session storage was lost. */
export async function verifyExistingAccountCode(auth: RecoveryAuth, email: string, code: string) {
  let response: Awaited<ReturnType<RecoveryAuth['verifyOtp']>>;
  try {
    response = await auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
  } catch (error) {
    throw verificationFailure(error);
  }

  if (response.error) throw verificationFailure(response.error);
  if (!response.data.session?.user) {
    throw new Error('Could not complete sign-in. Request a new code and try again.');
  }
}
