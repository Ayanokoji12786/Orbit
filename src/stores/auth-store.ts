import { onAuthStateChanged } from '@react-native-firebase/auth';
import { create } from 'zustand';

import { auth, isFirebaseConfigured } from '@/lib/firebase';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthStore = {
  status: AuthStatus;
  uid: string | null;
  email: string | null;
  setSignedIn: (uid: string, email: string | null) => void;
  setSignedOut: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  status: isFirebaseConfigured ? 'loading' : 'signedOut',
  uid: null,
  email: null,
  setSignedIn: (uid, email) => set({ status: 'signedIn', uid, email }),
  setSignedOut: () => set({ status: 'signedOut', uid: null, email: null }),
}));

let listenerAttached = false;

/** Call once from the root layout to sync auth state with Firebase's session. */
export function initAuthListener() {
  if (listenerAttached || !auth) return;
  listenerAttached = true;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      useAuthStore.getState().setSignedIn(user.uid, user.email);
    } else {
      useAuthStore.getState().setSignedOut();
    }
  });
}
