import { useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { FunctionsHttpError } from '@supabase/supabase-js';

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
  cancelled_at: string | null;
  ended_at: string | null;
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
    cancelledAt: row.cancelled_at ?? null,
    endedAt: row.ended_at ?? null,
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

/** Host-only password change. Pass null to remove protection. */
export async function setMeetingPassword(meetingId: string, password: string | null): Promise<boolean> {
  if (!supabase) throw new Error('Connect a Supabase project to manage meeting passwords.');
  const { data, error } = await supabase.functions.invoke<{ hasPassword: boolean }>('set-meeting-password', {
    body: { meetingId, password },
  });
  if (error) {
    const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(typeof body?.error === 'string' ? body.error : 'Could not update the meeting password.');
  }
  if (typeof data?.hasPassword !== 'boolean') throw new Error('Could not confirm the meeting password change.');
  return data.hasPassword;
}

/** Moves a host's future meeting. The database restricts writes to scheduling fields. */
export async function rescheduleMeeting(meetingId: string, startsAt: Date): Promise<Meeting> {
  if (!supabase) throw new Error('Connect a Supabase project to reschedule meetings.');
  const uid = useAuthStore.getState().uid;
  if (!uid) throw new Error('Sign in required.');
  if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
    throw new Error('Choose a future start time.');
  }
  const { data, error } = await supabase
    .from('meetings')
    .update({ starts_at: startsAt.toISOString() })
    .eq('id', meetingId)
    .eq('host_id', uid)
    .is('cancelled_at', null)
    .is('ended_at', null)
    .gt('starts_at', new Date().toISOString())
    .select()
    .single();
  if (error) throw error;
  return mapMeeting(data as MeetingRow);
}

/** Cancels the meeting in Postgres and removes any active LiveKit room. */
export async function cancelMeeting(meetingId: string): Promise<void> {
  if (!supabase) throw new Error('Connect a Supabase project to cancel meetings.');
  const { data, error } = await supabase.functions.invoke<{ cancelled: boolean }>('meeting-lifecycle', {
    body: { action: 'cancel', meetingId },
  });
  if (error) {
    const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(typeof body?.error === 'string' ? body.error : 'Could not cancel the meeting.');
  }
  if (data?.cancelled !== true) throw new Error('Could not confirm meeting cancellation.');
}

/** Fetches one host-owned meeting, including older or cancelled rows outside list limits. */
export function useHostMeeting(meetingId: string): { meeting: Meeting | null; loading: boolean; error: string | null } {
  const uid = useAuthStore((state) => state.uid);
  const [result, setResult] = useState<{ ownerId: string | null; meetingId: string; meeting: Meeting | null; loading: boolean; error: string | null }>({
    ownerId: null,
    meetingId,
    meeting: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!supabase || !uid || !meetingId) return;
    const client = supabase;
    let disposed = false;
    let latestRequest = 0;
    const load = async () => {
      const request = ++latestRequest;
      const { data, error } = await client.from('meetings')
        .select('*')
        .eq('id', meetingId)
        .eq('host_id', uid)
        .maybeSingle();
      if (disposed || request !== latestRequest) return;
      setResult({
        ownerId: uid,
        meetingId,
        meeting: data ? mapMeeting(data as MeetingRow) : null,
        loading: false,
        error: error ? 'Could not load this meeting.' : null,
      });
    };

    void load();
    const channel = client.channel(uniqueChannel(`meeting:${meetingId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `id=eq.${meetingId}` }, load)
      .subscribe();
    return () => {
      disposed = true;
      void client.removeChannel(channel);
    };
  }, [meetingId, uid]);

  if (!supabase) return { meeting: null, loading: false, error: 'Connect a Supabase project to view meetings.' };
  if (!uid) return { meeting: null, loading: false, error: 'Sign in required.' };
  if (result.ownerId !== uid || result.meetingId !== meetingId) {
    return { meeting: null, loading: true, error: null };
  }
  return result;
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
