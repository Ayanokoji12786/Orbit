import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from '@react-native-firebase/firestore';

import { firestore } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';
import type { Poll } from '@/types/domain';

function mapPoll(id: string, data: DocumentData, uid: string | null): Poll {
  const votes = (data.votes ?? {}) as Record<string, string>;
  return {
    id,
    question: data.question,
    options: (data.options ?? []) as Poll['options'],
    votedOptionId: uid ? (votes[uid] ?? null) : null,
  };
}

export function useMeetingPolls(meetingId: string | undefined) {
  const uid = useAuthStore((s) => s.uid);
  const [polls, setPolls] = useState<Poll[]>([]);

  useEffect(() => {
    if (!firestore || !meetingId) {
      setPolls([]);
      return;
    }
    const q = query(collection(firestore, 'meetings', meetingId, 'polls'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setPolls(snap.docs.map((d) => mapPoll(d.id, d.data(), uid))));
  }, [meetingId, uid]);

  const createPoll = async (question: string, optionLabels: string[]) => {
    if (!firestore || !meetingId || !uid) return;
    await addDoc(collection(firestore, 'meetings', meetingId, 'polls'), {
      question,
      createdBy: uid,
      createdAt: serverTimestamp(),
      options: optionLabels.map((label, i) => ({ id: `${i}`, label, votes: 0 })),
      votes: {},
    });
  };

  const vote = async (pollId: string, optionId: string) => {
    if (!firestore || !meetingId || !uid) return;
    const pollRef = doc(firestore, 'meetings', meetingId, 'polls', pollId);

    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(pollRef);
      const data = snap.data();
      if (!data) return;
      const existingVotes = (data.votes ?? {}) as Record<string, string>;
      if (existingVotes[uid]) return; // already voted

      const options = ((data.options ?? []) as Poll['options']).map((o) =>
        o.id === optionId ? { ...o, votes: o.votes + 1 } : o,
      );
      tx.update(pollRef, { options, [`votes.${uid}`]: optionId });
    });
  };

  return { polls, createPoll, vote };
}
