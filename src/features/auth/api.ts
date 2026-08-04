import {
  OAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailLink,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';

import { auth } from '@/lib/firebase';

export class AuthNotConfiguredError extends Error {
  constructor() {
    super('Connect a Firebase project to enable sign-in (see .env.example).');
    this.name = 'AuthNotConfiguredError';
  }
}

function requireAuth() {
  if (!auth) throw new AuthNotConfiguredError();
  return auth;
}

/**
 * Firebase's action-handler page for magic links must live on a domain
 * listed in Authentication > Settings > Authorized domains, e.g. your
 * project's default `<project-id>.firebaseapp.com`.
 */
const continueUrl = process.env.EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL;

/** Emails a passwordless sign-in link. Throws if EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL isn't set. */
export async function sendSignInLink(email: string) {
  const client = requireAuth();
  if (!continueUrl) {
    throw new AuthNotConfiguredError();
  }

  await sendSignInLinkToEmail(client, email, {
    url: continueUrl,
    handleCodeInApp: true,
    iOS: { bundleId: 'app.orbit.mobile' },
    android: { packageName: 'app.orbit.mobile', installApp: true },
  });
}

export function isSignInLink(link: string): boolean {
  if (!auth) return false;
  return isSignInWithEmailLink(auth, link);
}

/** Completes sign-in from a tapped (or pasted) magic link. */
export async function completeSignInWithLink(email: string, link: string) {
  const client = requireAuth();
  await signInWithEmailLink(client, email, link);
}

/** Native "Sign in with Apple" — exchanges the Apple identity token with Firebase. */
export async function signInWithApple() {
  const client = requireAuth();
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error('Apple sign-in did not return an identity token.');

  const provider = new OAuthProvider('apple.com');
  const authCredential = provider.credential({ idToken: credential.identityToken });
  await signInWithCredential(client, authCredential);
}

export async function signOut() {
  const client = requireAuth();
  await firebaseSignOut(client);
}
