import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
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

  useEffect(() => {
    if (!supabase || !meetingId) {
      setPolls([]);
      return;
    }
    const client = supabase;

    // polls_with_my_vote already joins in this user's vote, so no separate lookup is needed.
    client
      .from('polls_with_my_vote')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPolls(((data as PollRow[] | null) ?? []).map(mapPoll)));

    const channel = client
      .channel(`polls:${meetingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'polls', filter: `meeting_id=eq.${meetingId}` },
        (payload) => {
          const row = payload.new as { id: string; question: string; options: Poll['options'] };
          setPolls((prev) => [{ id: row.id, question: row.question, options: row.options, votedOptionId: null }, ...prev]);
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

    return () => {
      client.removeChannel(channel);
    };
  }, [meetingId]);

  const createPoll = async (question: string, optionLabels: string[]) => {
    if (!supabase || !meetingId || !uid) return;
    await supabase.from('polls').insert({
      meeting_id: meetingId,
      question,
      created_by: uid,
      options: optionLabels.map((label, i) => ({ id: `${i}`, label, votes: 0 })),
    });
  };

  const vote = async (pollId: string, optionId: string) => {
    if (!supabase || !uid) return;
    const { error } = await supabase.rpc('cast_vote', { p_poll_id: pollId, p_option_id: optionId });
    if (error) return;
    // Optimistic: the row-locked count update arrives shortly after via the UPDATE subscription above.
    setPolls((prev) => prev.map((p) => (p.id === pollId && !p.votedOptionId ? { ...p, votedOptionId: optionId } : p)));
  };

  return { polls, createPoll, vote };
}
