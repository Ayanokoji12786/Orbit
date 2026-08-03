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
