import * as AppleAuthentication from 'expo-apple-authentication';

import { supabase } from '@/lib/supabase';
import { requestExistingAccountCode, verifyExistingAccountCode } from './recovery';

export class AuthNotConfiguredError extends Error {
  constructor() {
    super('Connect a Supabase project to enable sign-in (see .env.example).');
    this.name = 'AuthNotConfiguredError';
  }
}

function requireAuth() {
  if (!supabase) throw new AuthNotConfiguredError();
  return supabase;
}

/** Emails a 6-digit sign-in code. */
export async function sendSignInCode(email: string) {
  const client = requireAuth();
  const { error } = await client.auth.signInWithOtp({ email });
  if (error) throw error;
}

/** Verifies the 6-digit code from the sign-in email and completes sign-in. */
export async function verifySignInCode(email: string, code: string) {
  const client = requireAuth();
  const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
}

/** Recovery never creates a new user, even when the address is unknown. */
export async function sendRecoveryCode(email: string) {
  await requestExistingAccountCode(requireAuth().auth, email);
}

/** Exchanges an existing-account email code for a new authenticated session. */
export async function verifyRecoveryCode(email: string, code: string) {
  await verifyExistingAccountCode(requireAuth().auth, email, code);
}

/** Native "Sign in with Apple" — exchanges the Apple identity token with Supabase. */
export async function signInWithApple() {
  const client = requireAuth();
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error('Apple sign-in did not return an identity token.');

  const { error } = await client.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

export async function signOut() {
  const client = requireAuth();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
