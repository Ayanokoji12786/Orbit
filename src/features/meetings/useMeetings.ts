import { useMemo } from 'react';

import { mockRecentMeetings, mockUpcomingMeeting } from '@/features/home/mock-data';
import { useMeetingsStore } from '@/stores/meetings-store';
import type { Meeting } from '@/types/domain';

export function useUpcomingMeetings(): Meeting[] {
  const scheduled = useMeetingsStore((s) => s.scheduled);
  return useMemo(() => {
    return [mockUpcomingMeeting, ...scheduled]
      .filter((m) => new Date(m.startsAt).getTime() > Date.now())
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [scheduled]);
}

export function usePastMeetings(): Meeting[] {
  const scheduled = useMeetingsStore((s) => s.scheduled);
  return useMemo(() => {
    const pastScheduled = scheduled.filter((m) => new Date(m.startsAt).getTime() <= Date.now());
    return [...mockRecentMeetings, ...pastScheduled].sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    );
  }, [scheduled]);
}
