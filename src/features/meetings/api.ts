import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import type { Meeting } from '@/types/domain';

function randomRoomCode() {
  return Math.random().toString(36).slice(2, 8);
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

/** Meetings this user is hosting that haven't started yet, soonest first, live-updating. */
export function useUpcomingMeetings(): Meeting[] {
  const uid = useAuthStore((s) => s.uid);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    if (!supabase || !uid) {
      setMeetings([]);
      return;
    }
    const client = supabase;

    const load = () => {
      client
        .from('meetings')
        .select('*')
        .eq('host_id', uid)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .then(({ data }) => setMeetings(((data as MeetingRow[] | null) ?? []).map(mapMeeting)));
    };

    load();
    const channel = client
      .channel(`meetings:upcoming:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `host_id=eq.${uid}` }, load)
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [uid]);

  return meetings;
}

/** This user's most recent past meetings, live-updating. */
export function usePastMeetings(): Meeting[] {
  const uid = useAuthStore((s) => s.uid);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    if (!supabase || !uid) {
      setMeetings([]);
      return;
    }
    const client = supabase;

    const load = () => {
      client
        .from('meetings')
        .select('*')
        .eq('host_id', uid)
        .lt('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: false })
        .limit(20)
        .then(({ data }) => setMeetings(((data as MeetingRow[] | null) ?? []).map(mapMeeting)));
    };

    load();
    const channel = client
      .channel(`meetings:past:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `host_id=eq.${uid}` }, load)
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [uid]);

  return meetings;
}
