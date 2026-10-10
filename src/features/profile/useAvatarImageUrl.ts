import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

export const AVATAR_STORAGE_PREFIX = 'profile-avatars/';
const SIGNED_URL_TTL_SECONDS = 5 * 60;
const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

/** Resolves private avatar paths for the current viewer; errors show initials. */
export function useAvatarImageUrl(uri: string | null | undefined): string | null {
  const uid = useAuthStore((state) => state.uid);
  const path = uri?.startsWith(AVATAR_STORAGE_PREFIX) ? uri.slice(AVATAR_STORAGE_PREFIX.length) : null;
  const [signed, setSigned] = useState<{ uid: string; path: string; url: string } | null>(null);

  useEffect(() => {
    if (!path || !uid || !supabase) return;
    const client = supabase;
    let cancelled = false;

    const refresh = async () => {
      try {
        const { data, error } = await client.storage.from('profile-avatars').createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        if (!cancelled) setSigned(error || !data?.signedUrl ? null : { uid, path, url: data.signedUrl });
      } catch {
        if (!cancelled) setSigned(null);
      }
    };

    void refresh();
    const timer = setInterval(() => { void refresh(); }, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [path, uid]);

  if (path) return signed?.uid === uid && signed.path === path ? signed.url : null;
  return uri ?? null;
}
