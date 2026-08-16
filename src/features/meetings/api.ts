import { useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';
import { uniqueChannel } from '@/lib/realtime';
import { useAuthStore } from '@/stores/auth-store';
import type { Meeting } from '@/types/domain';

const ROOM_CODE_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomRoomCode() {
  const bytes = Crypto.getRandomBytes(6);
  return Array.from(bytes, (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('');
}

type MeetingRow = {
  id: string;
  host_id: string;
  room_code: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  has_password: boolean;
};

function mapMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    hostId: row.host_id,
    roomCode: row.room_code,
    title: row.title,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes ?? 30,
    participants: [],
    hasPassword: Boolean(row.has_password),
  };
}

type NewMeetingInput = { title: string; startsAt: Date; durationMinutes?: number };

/** Creates a meeting row (used for both "start instant" and "schedule for later"). */
export async function createMeeting({ title, startsAt, durationMinutes = 30 }: NewMeetingInput): Promise<Meeting> {
  if (!supabase) throw new Error('Connect a Supabase project to create meetings.');
  const uid = useAuthStore.getState().uid;
  if (!uid) throw new Error('Sign in required.');

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      host_id: uid,
      title,
      starts_at: startsAt.toISOString(),
      duration_minutes: durationMinutes,
      room_code: randomRoomCode(),
      has_password: false,
    })
    .select()
    .single();

  if (error) throw error;
  return mapMeeting(data as MeetingRow);
}

/**
 * Shared machinery for the two host-scoped meeting lists. The `starts_at` cutoff is
 * evaluated per fetch, and a timer re-fetches periodically so a meeting whose start time
 * passes while the app is open actually moves from Upcoming to Past instead of being
 * stranded in neither list (realtime only fires on row changes, and time passing isn't one).
 */
const MEETING_LIST_REFRESH_MS = 60_000;

function useHostMeetings(bucket: 'upcoming' | 'past'): Meeting[] {
  const uid = useAuthStore((s) => s.uid);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    if (!supabase || !uid) {
      setMeetings([]);
      return;
    }
    const client = supabase;
    let cancelled = false;
    let latestRequest = 0;

    const load = () => {
      const requestId = ++latestRequest;
      const now = new Date().toISOString();
      const query =
        bucket === 'upcoming'
          ? client.from('meetings').select('*').eq('host_id', uid).gte('starts_at', now).order('starts_at', { ascending: true })
          : client.from('meetings').select('*').eq('host_id', uid).lt('starts_at', now).order('starts_at', { ascending: false }).limit(20);

      query.then(({ data, error }) => {
        // Ignore stale responses and keep the current list on error rather than
        // blanking it into a misleading empty state.
        if (cancelled || requestId !== latestRequest || error) return;
        setMeetings(((data as MeetingRow[] | null) ?? []).map(mapMeeting));
      });
    };

    load();
    const channel = client
      .channel(uniqueChannel(`meetings:${bucket}:${uid}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `host_id=eq.${uid}` }, load)
      .subscribe();
    const timer = setInterval(load, MEETING_LIST_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      client.removeChannel(channel);
    };
  }, [uid, bucket]);

  return meetings;
}

/** Meetings this user is hosting that haven't started yet, soonest first, live-updating. */
export function useUpcomingMeetings(): Meeting[] {
  return useHostMeetings('upcoming');
}

/** This user's most recent past meetings, live-updating. */
export function usePastMeetings(): Meeting[] {
  return useHostMeetings('past');
}
