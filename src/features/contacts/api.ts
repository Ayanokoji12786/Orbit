import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { uniqueChannel } from '@/lib/realtime';
import { useAuthStore } from '@/stores/auth-store';
import type { Contact } from '@/types/domain';

export type AddContactResult = 'added' | 'not-found' | 'self' | 'exists';

type ContactRow = {
  contact_id: string;
  is_favorite: boolean;
  users: { display_name: string | null; avatar_url: string | null; status: Contact['status'] | null } | null;
};

function mapContact(row: ContactRow): Contact {
  return {
    id: row.contact_id,
    name: row.users?.display_name ?? 'Orbit User',
    avatarUrl: row.users?.avatar_url ?? null,
    status: row.users?.status ?? 'offline',
    isFavorite: row.is_favorite,
  };
}

/** This user's contacts (their own rolodex — adding someone doesn't require their consent). */
export function useContacts(): { contacts: Contact[]; loading: boolean; error: string | null } {
  const uid = useAuthStore((s) => s.uid);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !uid) {
      setContacts([]);
      setLoading(false);
      return;
    }
    const client = supabase;
    let cancelled = false;
    // Guards against out-of-order responses: realtime can fire `load` while an earlier
    // one is still in flight, and the slower response would otherwise win.
    let latestRequest = 0;
    setLoading(true);

    const load = () => {
      const requestId = ++latestRequest;
      client
        .from('contacts')
        .select('contact_id, is_favorite, users:contact_id(display_name, avatar_url, status)')
        .eq('owner_id', uid)
        .then(({ data, error: selErr }) => {
          if (cancelled || requestId !== latestRequest) return;
          if (selErr) {
            // Keep whatever is already on screen — blanking the list on a transient
            // network error renders a misleading "No contacts yet" empty state.
            setError(selErr.message);
            setLoading(false);
            return;
          }
          setError(null);
          // supabase-js types an embedded resource as an array because it can't infer
          // FK cardinality without generated DB types; `contact_id` is a to-one FK, so
          // PostgREST actually returns a single object here.
          setContacts(((data as unknown as ContactRow[] | null) ?? []).map(mapContact));
          setLoading(false);
        });
    };

    load();
    const channel = client
      .channel(uniqueChannel(`contacts:${uid}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `owner_id=eq.${uid}` }, load)
      .subscribe();

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, [uid]);

  return { contacts, loading, error };
}

/** Looks a user up by email and adds them to the caller's contacts. */
export async function addContactByEmail(email: string): Promise<AddContactResult> {
  if (!supabase) throw new Error('Connect a Supabase project to add contacts.');
  const uid = useAuthStore.getState().uid;
  if (!uid) throw new Error('Sign in required.');

  const normalized = email.trim().toLowerCase();
  // Routed through an RPC — the users table is no longer world-readable, only self +
  // contacts, so a direct table lookup can't find someone before they're a contact.
  const { data: matches, error: rpcError } = await supabase.rpc('find_user_by_email', { p_email: normalized });
  // Distinguish "lookup failed" from "no such user" — reporting a network error as
  // "no Orbit user with that email" sends people down the wrong path entirely.
  if (rpcError) throw new Error(rpcError.message);
  const match = matches?.[0];
  if (!match) return 'not-found';
  if (match.id === uid) return 'self';

  const { error } = await supabase.from('contacts').insert({ owner_id: uid, contact_id: match.id, is_favorite: false });
  if (error) {
    if (error.code === '23505') return 'exists'; // unique_violation on the (owner_id, contact_id) PK
    throw error;
  }
  return 'added';
}

export async function setContactFavorite(contactUid: string, isFavorite: boolean) {
  if (!supabase) return;
  const uid = useAuthStore.getState().uid;
  if (!uid) return;
  const { error } = await supabase
    .from('contacts')
    .update({ is_favorite: isFavorite })
    .eq('owner_id', uid)
    .eq('contact_id', contactUid);
  if (error) throw new Error(error.message);
}
