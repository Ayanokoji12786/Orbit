import { useCallback, useState } from 'react';
import { GoogleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

import { auth, isFirebaseConfigured } from '@/lib/firebase';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (isFirebaseConfigured && webClientId) {
  GoogleSignin.configure({ webClientId });
}

/**
 * Google sign-in via the native Google SDK, exchanging the returned ID
 * token with Firebase. Requires EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (the "Web
 * client" OAuth client Firebase creates automatically once Google sign-in
 * is enabled) — until that's set, `isAvailable` stays false.
 */
export function useGoogleSignIn(onError: (error: Error) => void) {
  const [loading, setLoading] = useState(false);

  const promptAsync = useCallback(async () => {
    if (!auth || !webClientId) return;
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response) || !response.data.idToken) return;

      const credential = GoogleAuthProvider.credential(response.data.idToken);
      await signInWithCredential(auth, credential);
    } catch (err) {
      if (err instanceof Error && (err as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) return;
      onError(err instanceof Error ? err : new Error('Google sign-in failed.'));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  return {
    isAvailable: Boolean(auth && webClientId),
    loading,
    promptAsync,
  };
}
