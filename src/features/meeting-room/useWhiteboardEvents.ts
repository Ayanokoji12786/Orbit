import { useCallback, useEffect, useMemo, useState } from 'react';

import { uniqueChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import {
  MAX_WHITEBOARD_EVENTS,
  mergeWhiteboardEvents,
  parseWhiteboardEvent,
  visibleWhiteboardStrokes,
  type WhiteboardEvent,
  type WhiteboardStroke,
} from '@/utils/whiteboard-events';

function eventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useWhiteboardEvents(meetingId?: string) {
  const [events, setEvents] = useState<WhiteboardEvent[]>([]);
  const [pending, setPending] = useState<WhiteboardStroke[]>([]);
  const [loading, setLoading] = useState(Boolean(meetingId && supabase));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meetingId || !supabase) return;
    const client = supabase;
    let cancelled = false;
    let subscribed = false;
    const load = async () => {
      try {
        const { data, error: loadError } = await client
          .from('meeting_whiteboard_events')
          .select('seq,client_id,kind,color,points')
          .eq('meeting_id', meetingId)
          .order('seq', { ascending: false })
          .limit(MAX_WHITEBOARD_EVENTS);
        if (cancelled) return;
        setLoading(false);
        if (loadError) {
          setError('Could not load the whiteboard. Try reopening it.');
          return;
        }
        const fetched = (data ?? []).map(parseWhiteboardEvent).filter((event): event is WhiteboardEvent => event !== null);
        setEvents((current) => mergeWhiteboardEvents(current, fetched));
        if (subscribed) setError(null);
      } catch {
        if (cancelled) return;
        setLoading(false);
        setError('Could not load the whiteboard. Try reopening it.');
      }
    };

    const channel = client
      .channel(uniqueChannel(`meeting_whiteboard:${meetingId}`))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meeting_whiteboard_events', filter: `meeting_id=eq.${meetingId}` },
        (payload) => {
          const incoming = parseWhiteboardEvent(payload.new);
          if (incoming) setEvents((current) => mergeWhiteboardEvents(current, [incoming]));
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribed = true;
          void load();
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          subscribed = false;
          setLoading(false);
          setError('Live whiteboard updates are unavailable. Try reopening it.');
        }
      });
    // Fetch even when the live channel cannot connect; replay again after
    // subscription to close the gap between initial fetch and live delivery.
    void load();

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [meetingId]);

  const addStroke = useCallback(async (stroke: WhiteboardStroke) => {
    if (!meetingId) {
      setPending((current) => [...current, stroke].slice(-MAX_WHITEBOARD_EVENTS));
      return;
    }
    if (!supabase) {
      setError('Whiteboard collaboration is unavailable without a Supabase connection.');
      return;
    }
    setPending((current) => [...current, stroke]);
    try {
      const { data: seq, error: saveError } = await supabase.rpc('append_meeting_whiteboard_event', {
        p_meeting_id: meetingId,
        p_client_id: stroke.id,
        p_kind: 'stroke',
        p_color: stroke.color,
        p_points: stroke.points,
      });
      if (saveError || !Number.isSafeInteger(seq)) throw new Error('Stroke not saved');
      setEvents((current) => mergeWhiteboardEvents(current, [{ seq, clientId: stroke.id, kind: 'stroke', stroke }]));
      setError(null);
    } catch {
      setError('Could not save this stroke. Check your connection and try again.');
    } finally {
      setPending((current) => current.filter((item) => item.id !== stroke.id));
    }
  }, [meetingId]);

  const clearBoard = useCallback(async () => {
    if (!meetingId) {
      setEvents([]);
      setPending([]);
      return;
    }
    if (!supabase) {
      setError('Whiteboard collaboration is unavailable without a Supabase connection.');
      return;
    }
    const clientId = eventId('clear');
    try {
      const { data: seq, error: clearError } = await supabase.rpc('append_meeting_whiteboard_event', {
        p_meeting_id: meetingId,
        p_client_id: clientId,
        p_kind: 'clear',
        p_color: null,
        p_points: null,
      });
      if (clearError || !Number.isSafeInteger(seq)) throw new Error('Board not cleared');
      setEvents((current) => mergeWhiteboardEvents(current, [{ seq, clientId, kind: 'clear' }]));
      setPending([]);
      setError(null);
    } catch {
      setError('Could not clear the whiteboard. Try again.');
    }
  }, [meetingId]);

  const strokes = useMemo(() => {
    const committed = visibleWhiteboardStrokes(events);
    const committedIds = new Set(committed.map((stroke) => stroke.id));
    return [...committed, ...pending.filter((stroke) => !committedIds.has(stroke.id))];
  }, [events, pending]);

  return {
    strokes,
    loading,
    error: meetingId && !supabase ? 'Whiteboard collaboration is unavailable without a Supabase connection.' : error,
    addStroke,
    clearBoard,
  };
}
