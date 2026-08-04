import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Meeting } from '@/types/domain';

type MeetingsStore = {
  scheduled: Meeting[];
  addMeeting: (meeting: Meeting) => void;
};

export const useMeetingsStore = create<MeetingsStore>()(
  persist(
    (set) => ({
      scheduled: [],
      addMeeting: (meeting) => set((state) => ({ scheduled: [...state.scheduled, meeting] })),
    }),
    {
      name: 'orbit.meetings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
