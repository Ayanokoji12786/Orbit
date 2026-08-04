import { create } from 'zustand';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthStore = {
  status: AuthStatus;
  uid: string | null;
  email: string | null;
  setSignedIn: (uid: string, email: string | null) => void;
  setSignedOut: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  status: isSupabaseConfigured ? 'loading' : 'signedOut',
  uid: null,
  email: null,
  setSignedIn: (uid, email) => set({ status: 'signedIn', uid, email }),
  setSignedOut: () => set({ status: 'signedOut', uid: null, email: null }),
}));

let listenerAttached = false;

/** Call once from the root layout to sync auth state with Supabase's session. */
export function initAuthListener() {
  if (listenerAttached || !supabase) return;
  listenerAttached = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      useAuthStore.getState().setSignedIn(session.user.id, session.user.email ?? null);
    } else {
      useAuthStore.getState().setSignedOut();
    }
  });
}
