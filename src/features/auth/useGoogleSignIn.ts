import { useCallback, useState } from 'react';
import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (isSupabaseConfigured && webClientId) {
  GoogleSignin.configure({ webClientId });
}

/**
 * Google sign-in via the native Google SDK, exchanging the returned ID token
 * with Supabase. Requires EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID — a "Web application"
 * OAuth client from Google Cloud Console, also configured as this project's
 * Google provider in the Supabase dashboard — until that's set, `isAvailable`
 * stays false.
 */
export function useGoogleSignIn(onError: (error: Error) => void) {
  const [loading, setLoading] = useState(false);

  const promptAsync = useCallback(async () => {
    if (!supabase || !webClientId) return;
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response) || !response.data.idToken) return;

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.data.idToken,
      });
      if (error) throw error;
    } catch (err) {
      if (err instanceof Error && (err as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) return;
      onError(err instanceof Error ? err : new Error('Google sign-in failed.'));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  return {
    isAvailable: Boolean(supabase && webClientId),
    loading,
    promptAsync,
  };
}
