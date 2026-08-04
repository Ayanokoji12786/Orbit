import { useEffect, useState } from 'react';
import {
  Timestamp,
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type DocumentData,
} from '@react-native-firebase/firestore';

import { firestore } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';
import type { Meeting } from '@/types/domain';

function randomRoomCode() {
  return Math.random().toString(36).slice(2, 8);
}

function mapMeeting(id: string, data: DocumentData): Meeting {
  const startsAt = data.startsAt instanceof Timestamp ? data.startsAt.toDate() : new Date(data.startsAt);
  return {
    id,
    hostId: data.hostId,
    roomCode: data.roomCode,
    title: data.title,
    startsAt: startsAt.toISOString(),
    durationMinutes: data.durationMinutes ?? 30,
    participants: [],
    hasPassword: Boolean(data.hasPassword),
  };
}

type NewMeetingInput = { title: string; startsAt: Date; durationMinutes?: number };

/** Creates a meeting doc (used for both "start instant" and "schedule for later"). */
export async function createMeeting({ title, startsAt, durationMinutes = 30 }: NewMeetingInput): Promise<Meeting> {
  if (!firestore) throw new Error('Connect a Firebase project to create meetings.');
  const uid = useAuthStore.getState().uid;
  if (!uid) throw new Error('Sign in required.');

  const roomCode = randomRoomCode();
  const ref = await addDoc(collection(firestore, 'meetings'), {
    hostId: uid,
    title,
    startsAt: Timestamp.fromDate(startsAt),
    durationMinutes,
    roomCode,
    hasPassword: false,
    participantIds: [uid],
    createdAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    hostId: uid,
    roomCode,
    title,
    startsAt: startsAt.toISOString(),
    durationMinutes,
    participants: [],
    hasPassword: false,
  };
}

/** Meetings this user is hosting that haven't started yet, soonest first, live-updating. */
export function useUpcomingMeetings(): Meeting[] {
  const uid = useAuthStore((s) => s.uid);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    if (!firestore || !uid) {
      setMeetings([]);
      return;
    }
    const q = query(
      collection(firestore, 'meetings'),
      where('hostId', '==', uid),
      where('startsAt', '>=', Timestamp.fromDate(new Date())),
      orderBy('startsAt', 'asc'),
    );
    return onSnapshot(q, (snap) => setMeetings(snap.docs.map((d) => mapMeeting(d.id, d.data()))));
  }, [uid]);

  return meetings;
}

/** This user's most recent past meetings, live-updating. */
export function usePastMeetings(): Meeting[] {
  const uid = useAuthStore((s) => s.uid);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    if (!firestore || !uid) {
      setMeetings([]);
      return;
    }
    const q = query(
      collection(firestore, 'meetings'),
      where('hostId', '==', uid),
      where('startsAt', '<', Timestamp.fromDate(new Date())),
      orderBy('startsAt', 'desc'),
      limit(20),
    );
    return onSnapshot(q, (snap) => setMeetings(snap.docs.map((d) => mapMeeting(d.id, d.data()))));
  }, [uid]);

  return meetings;
}
