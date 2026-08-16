import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Chat images live in a private bucket (they're private conversation content), so there
 * is no permanent public URL. Messages store the object path and each viewer mints their
 * own short-lived signed URL — which also means access is re-checked against RLS on every
 * view rather than being permanently readable by anyone who once saw the link.
 *
 * Tolerates legacy rows that still hold a full public URL from before the bucket was
 * made private.
 */
export function useSignedImageUrl(pathOrUrl: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() =>
    pathOrUrl?.startsWith('http') ? pathOrUrl : undefined,
  );

  useEffect(() => {
    if (!pathOrUrl) {
      setUrl(undefined);
      return;
    }
    if (pathOrUrl.startsWith('http')) {
      setUrl(pathOrUrl);
      return;
    }
    if (!supabase) return;

    let cancelled = false;
    supabase.storage
      .from('chat-uploads')
      .createSignedUrl(pathOrUrl, SIGNED_URL_TTL_SECONDS)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [pathOrUrl]);

  return url;
}
