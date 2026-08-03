import * as AppleAuthentication from 'expo-apple-authentication';

import { supabase } from '@/lib/supabase';

export class AuthNotConfiguredError extends Error {
  constructor() {
    super('Connect a Supabase project (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY) to enable sign-in.');
    this.name = 'AuthNotConfiguredError';
  }
}

function requireSupabase() {
  if (!supabase) throw new AuthNotConfiguredError();
  return supabase;
}

/** Sends a 6-digit OTP code to the given email via Supabase Auth. */
export async function sendEmailOtp(email: string) {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

/** Verifies the OTP code the user received by email. */
export async function verifyEmailOtp(email: string, token: string) {
  const client = requireSupabase();
  const { error } = await client.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

/** Native "Sign in with Apple" — exchanges the Apple identity token with Supabase. */
export async function signInWithApple() {
  const client = requireSupabase();
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
  const client = requireSupabase();
  await client.auth.signOut();
}
