import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Browser OAuth redirects through Supabase; native Google SDKs cannot run here. */
export function useGoogleSignIn(onError: (error: Error) => void) {
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    if (!supabase || !supabaseUrl || !publishableKey) return;
    const controller = new AbortController();
    // Browser OAuth credentials live in Supabase. A native client-ID flag is not
    // required; follow the project's public provider configuration instead.
    fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load sign-in options.');
        const settings = await response.json();
        if (!controller.signal.aborted) setGoogleEnabled(settings.external?.google === true);
      })
      .catch(() => { /* Email sign-in remains available if provider settings cannot load. */ });
    return () => controller.abort();
  }, []);

  const promptAsync = useCallback(async () => {
    if (!supabase || !googleEnabled || loading) return;
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
  }, [googleEnabled, loading, onError]);

  return { isAvailable: Boolean(supabase && googleEnabled), loading, promptAsync };
}
