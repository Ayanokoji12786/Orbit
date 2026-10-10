import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// A participant can leave or be removed while an already-issued URL still exists.
// Supabase signed URLs cannot be revoked individually, so keep this exposure short.
const SIGNED_URL_TTL_SECONDS = 5 * 60;
const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

/**
 * Chat images live in a private bucket (they're private conversation content), so there
 * is no permanent public URL. Messages store the object path and each viewer mints their
 * own short-lived signed URL. RLS is checked when issuing it; an already-issued URL can
 * remain readable until expiry, even after meeting access is revoked.
 *
 * Tolerates legacy rows that still hold a full public URL from before the bucket was
 * made private.
 */
export function useSignedImageUrl(pathOrUrl: string | undefined): string | undefined {
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (!pathOrUrl || pathOrUrl.startsWith('http') || !supabase) return;
    const client = supabase;

    let cancelled = false;
    const refresh = async () => {
      try {
        const { data, error } = await client.storage
          .from('chat-uploads')
          .createSignedUrl(pathOrUrl, SIGNED_URL_TTL_SECONDS);
        if (!cancelled) setSigned(error || !data?.signedUrl ? null : { path: pathOrUrl, url: data.signedUrl });
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
  }, [pathOrUrl]);

  if (pathOrUrl?.startsWith('http')) return pathOrUrl;
  return signed && signed.path === pathOrUrl ? signed.url : undefined;
}
