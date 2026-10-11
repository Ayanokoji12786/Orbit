import { useCallback, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Browser OAuth redirects through Supabase; native Google SDKs cannot run here. */
export function useGoogleSignIn(onError: (error: Error) => void) {
  const [loading, setLoading] = useState(false);
  const promptAsync = useCallback(async () => {
    if (!supabase || loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Google sign-in failed.'));
    } finally {
      setLoading(false);
    }
  }, [loading, onError]);

  return { isAvailable: Boolean(supabase), loading, promptAsync };
}
