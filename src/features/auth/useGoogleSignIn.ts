import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// expo-auth-session throws during render if the platform-relevant client id
// is missing, so we feed it a placeholder to keep the hook safe to call
// unconditionally and gate real availability ourselves via `isAvailable`.
const PLACEHOLDER_CLIENT_ID = 'not-configured';

/**
 * Google OAuth via expo-auth-session, exchanging the returned id_token with
 * Supabase Auth. Requires EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID /
 * EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID / EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
 * from a Google Cloud OAuth client (see .env.example) — until those are set
 * `isAvailable` stays false and the button should be disabled.
 */
export function useGoogleSignIn(onError: (error: Error) => void) {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const configuredClientId = Platform.select({
    ios: iosClientId,
    android: androidClientId,
    default: webClientId,
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: iosClientId ?? PLACEHOLDER_CLIENT_ID,
    androidClientId: androidClientId ?? PLACEHOLDER_CLIENT_ID,
    webClientId: webClientId ?? PLACEHOLDER_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.authentication?.idToken;
    if (!idToken || !supabase) return;

    supabase.auth.signInWithIdToken({ provider: 'google', token: idToken }).then(({ error }) => {
      if (error) onError(error);
    });
  }, [response, onError]);

  return {
    isAvailable: Boolean(request) && Boolean(configuredClientId),
    promptAsync,
  };
}
