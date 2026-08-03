import { create } from 'zustand';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthStore = {
  status: AuthStatus;
  email: string | null;
  setSignedIn: (email: string | null) => void;
  setSignedOut: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  status: isSupabaseConfigured ? 'loading' : 'signedOut',
  email: null,
  setSignedIn: (email) => set({ status: 'signedIn', email }),
  setSignedOut: () => set({ status: 'signedOut', email: null }),
}));

let listenerAttached = false;

/** Call once from the root layout to sync auth state with Supabase's session. */
export function initAuthListener() {
  if (listenerAttached || !supabase) return;
  listenerAttached = true;

  supabase.auth.getSession().then(({ data }) => {
    const session = data.session;
    if (session) {
      useAuthStore.getState().setSignedIn(session.user.email ?? null);
    } else {
      useAuthStore.getState().setSignedOut();
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      useAuthStore.getState().setSignedIn(session.user.email ?? null);
    } else {
      useAuthStore.getState().setSignedOut();
    }
  });
}
