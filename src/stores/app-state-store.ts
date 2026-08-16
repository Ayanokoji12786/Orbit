import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AppStateStore = {
  hasOnboarded: boolean;
  completeOnboarding: () => void;
};

export const useAppStateStore = create<AppStateStore>()(
  persist(
    (set) => ({
      hasOnboarded: false,
      completeOnboarding: () => set({ hasOnboarded: true }),
    }),
    {
      name: 'orbit.app-state',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * AsyncStorage rehydration is asynchronous, so on the first render `hasOnboarded` is
 * still its default `false`. Anything that routes off that value must wait for this,
 * or every returning user gets sent back through onboarding on each cold start.
 */
export function useAppStateHydrated(): boolean {
  // useSyncExternalStore rather than state+effect: it re-reads the snapshot on subscribe,
  // so hydration finishing between render and subscribe can't be missed, and there's no
  // setState-in-effect round trip.
  return useSyncExternalStore(
    (onChange) => useAppStateStore.persist.onFinishHydration(onChange),
    () => useAppStateStore.persist.hasHydrated(),
    () => false,
  );
}
