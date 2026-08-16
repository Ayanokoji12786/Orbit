import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { uniqueChannel } from '@/lib/realtime';
import { useAuthStore } from '@/stores/auth-store';
import type { Poll } from '@/types/domain';

type PollRow = {
  id: string;
  question: string;
  options: Poll['options'];
  voted_option_id: string | null;
};

function mapPoll(row: PollRow): Poll {
  return {
    id: row.id,
    question: row.question,
    options: row.options ?? [],
    votedOptionId: row.voted_option_id ?? null,
  };
}

export function useMeetingPolls(meetingId: string | undefined) {
  const uid = useAuthStore((s) => s.uid);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPolls([]);
    setError(null);
    if (!supabase || !meetingId || !uid) return;

    const client = supabase;
    let cancelled = false;

    const upsertPoll = (poll: Poll) =>
      setPolls((prev) => (prev.some((p) => p.id === poll.id) ? prev : [poll, ...prev]));

    const channel = client
      .channel(uniqueChannel(`polls:${meetingId}`))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'polls', filter: `meeting_id=eq.${meetingId}` },
        (payload) => {
          const row = payload.new as { id: string; question: string; options: Poll['options'] };
          upsertPoll({ id: row.id, question: row.question, options: row.options, votedOptionId: null });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'polls', filter: `meeting_id=eq.${meetingId}` },
        (payload) => {
          // Only options/vote-counts change server-side — never touch the locally-known votedOptionId here.
          const row = payload.new as { id: string; options: Poll['options'] };
          setPolls((prev) => prev.map((p) => (p.id === row.id ? { ...p, options: row.options } : p)));
        },
      )
      .subscribe();

    // polls_with_my_vote already joins in this user's vote, so no separate lookup is needed.
    client
      .from('polls_with_my_vote')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: false })
      .then(({ data, error: selErr }) => {
        if (cancelled) return;
        if (selErr) {
          setError(selErr.message);
          return;
        }
        // Merge by id so a poll that arrived via realtime mid-flight isn't duplicated.
        const fetched = ((data as PollRow[] | null) ?? []).map(mapPoll);
        setPolls((prev) => {
          const byId = new Map(fetched.map((p) => [p.id, p]));
          prev.forEach((p) => { if (!byId.has(p.id)) byId.set(p.id, p); });
          return Array.from(byId.values());
        });
      });

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
    // uid participates because polls_with_my_vote resolves votedOptionId from auth.uid() —
    // on an account switch the previous user's vote would otherwise stay on screen.
  }, [meetingId, uid]);

  const createPoll = useCallback(
    async (question: string, optionLabels: string[]) => {
      if (!supabase || !meetingId || !uid) return;
      setError(null);
      const { error: insErr } = await supabase.from('polls').insert({
        meeting_id: meetingId,
        question,
        created_by: uid,
        options: optionLabels.map((label, i) => ({ id: `${i}`, label, votes: 0 })),
      });
      if (insErr) setError(insErr.message);
    },
    [meetingId, uid],
  );

  const vote = useCallback(
    async (pollId: string, optionId: string) => {
      if (!supabase || !uid) return;
      setError(null);
      const { error: rpcErr } = await supabase.rpc('cast_vote', { p_poll_id: pollId, p_option_id: optionId });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      // Optimistic: the row-locked count update arrives shortly after via the UPDATE subscription above.
      setPolls((prev) => prev.map((p) => (p.id === pollId && !p.votedOptionId ? { ...p, votedOptionId: optionId } : p)));
    },
    [uid],
  );

  return { polls, error, createPoll, vote };
}
