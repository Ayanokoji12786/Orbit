import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';
import { uniqueChannel } from '@/lib/realtime';
import { useAuthStore } from '@/stores/auth-store';
import type { ChatMessage } from '@/types/domain';

type MessageRow = {
  id: string;
  sender_id: string;
  sender_name: string;
  text: string | null;
  image_url: string | null;
  created_at: string;
};

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name ?? 'Orbit User',
    text: row.text ?? undefined,
    imageUri: row.image_url ?? undefined,
    createdAt: row.created_at,
  };
}

function myDisplayName(): string {
  const email = useAuthStore.getState().email;
  return email ? email.split('@')[0] : 'Orbit User';
}

function dmConversationId(uidA: string, uidB: string) {
  return `dm_${[uidA, uidB].sort().join('_')}`;
}

/** Merges rows into state by id, so a realtime event and the initial fetch can't double-insert. */
function mergeById(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  incoming.forEach((m) => byId.set(m.id, m));
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

async function uploadChatImage(localUri: string, pathPrefix: string): Promise<string> {
  if (!supabase) throw new Error('Connect a Supabase project to share images.');
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${pathPrefix}/${filename}`;

  // React Native's Blob is a handle into the native blob registry rather than real
  // binary data — passing it to storage-js uploads an empty file. Read the bytes
  // ourselves on native; on web the standard Blob path is correct.
  const body =
    Platform.OS === 'web'
      ? await (await fetch(localUri)).blob()
      : await new File(localUri).arrayBuffer();

  const { error } = await supabase.storage
    .from('chat-uploads')
    .upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw error;

  // The bucket is private, so there is no durable public URL — store the object path
  // and mint a short-lived signed URL at render time instead.
  return path;
}

type ChatApi = {
  messages: ChatMessage[];
  error: string | null;
  sendText: (text: string) => Promise<void>;
  sendImage: (localUri: string) => Promise<void>;
};

/** A 1:1 DM thread, keyed deterministically so both sides resolve the same conversation. */
export function useDmMessages(otherUid: string | undefined): ChatApi {
  const uid = useAuthStore((s) => s.uid);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const conversationId = uid && otherUid ? dmConversationId(uid, otherUid) : null;
  // Sends must wait for the conversation row to exist — the FK and the insert RLS
  // policy both require it, so a send racing this RPC is rejected outright.
  const conversationReady = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!supabase || !uid || !otherUid) {
      conversationReady.current = null;
      return;
    }
    const client = supabase;
    const ready = (async () => {
      const { error: rpcError } = await client.rpc('get_or_create_dm_conversation', {
        p_other_user_id: otherUid,
      });
      if (rpcError) throw new Error(rpcError.message);
    })();
    conversationReady.current = ready;
    // Surface it rather than letting it become an unhandled rejection; sends re-await
    // the same promise and report it against the specific message.
    ready.catch((err) => setError(err instanceof Error ? err.message : 'Could not open this conversation.'));
  }, [uid, otherUid]);

  useEffect(() => {
    setMessages([]);
    setError(null);
    if (!supabase || !conversationId) return;

    const client = supabase;
    let cancelled = false;

    const channel = client
      .channel(uniqueChannel(`conversation_messages:${conversationId}`))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => mergeById(prev, [mapMessage(payload.new as MessageRow)])),
      )
      .subscribe();

    client
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data, error: selErr }) => {
        if (cancelled) return;
        if (selErr) {
          setError(selErr.message);
          return;
        }
        // Merge rather than replace: an event may already have arrived while this was in flight.
        setMessages((prev) => mergeById(prev, ((data as MessageRow[] | null) ?? []).map(mapMessage)));
      });

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, [conversationId]);

  const sendText = useCallback(
    async (text: string) => {
      if (!supabase || !conversationId || !uid) return;
      setError(null);
      try {
        await conversationReady.current;
        const { error: insErr } = await supabase
          .from('conversation_messages')
          .insert({ conversation_id: conversationId, sender_id: uid, sender_name: myDisplayName(), text });
        if (insErr) throw new Error(insErr.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Message failed to send.');
      }
    },
    [conversationId, uid],
  );

  const sendImage = useCallback(
    async (localUri: string) => {
      if (!supabase || !conversationId || !uid) return;
      setError(null);
      try {
        await conversationReady.current;
        const imageUrl = await uploadChatImage(localUri, conversationId);
        const { error: insErr } = await supabase
          .from('conversation_messages')
          .insert({ conversation_id: conversationId, sender_id: uid, sender_name: myDisplayName(), image_url: imageUrl });
        if (insErr) throw new Error(insErr.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Image failed to send.');
      }
    },
    [conversationId, uid],
  );

  return { messages, error, sendText, sendImage };
}

/** A meeting's group chat, scoped to a single meeting. */
export function useMeetingMessages(meetingId: string | undefined): ChatApi {
  const uid = useAuthStore((s) => s.uid);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clear on every change, not just when the id goes falsy — otherwise the previous
    // meeting's chat stays on screen when switching rooms.
    setMessages([]);
    setError(null);
    if (!supabase || !meetingId) return;

    const client = supabase;
    let cancelled = false;

    const channel = client
      .channel(uniqueChannel(`meeting_messages:${meetingId}`))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meeting_messages', filter: `meeting_id=eq.${meetingId}` },
        (payload) => setMessages((prev) => mergeById(prev, [mapMessage(payload.new as MessageRow)])),
      )
      .subscribe();

    client
      .from('meeting_messages')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true })
      .then(({ data, error: selErr }) => {
        if (cancelled) return;
        if (selErr) {
          setError(selErr.message);
          return;
        }
        setMessages((prev) => mergeById(prev, ((data as MessageRow[] | null) ?? []).map(mapMessage)));
      });

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, [meetingId]);

  const sendText = useCallback(
    async (text: string) => {
      if (!supabase || !meetingId || !uid) return;
      setError(null);
      const { error: insErr } = await supabase
        .from('meeting_messages')
        .insert({ meeting_id: meetingId, sender_id: uid, sender_name: myDisplayName(), text });
      if (insErr) setError(insErr.message);
    },
    [meetingId, uid],
  );

  const sendImage = useCallback(
    async (localUri: string) => {
      if (!supabase || !meetingId || !uid) return;
      setError(null);
      try {
        const imageUrl = await uploadChatImage(localUri, meetingId);
        const { error: insErr } = await supabase
          .from('meeting_messages')
          .insert({ meeting_id: meetingId, sender_id: uid, sender_name: myDisplayName(), image_url: imageUrl });
        if (insErr) throw new Error(insErr.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Image failed to send.');
      }
    },
    [meetingId, uid],
  );

  return { messages, error, sendText, sendImage };
}

/** Every DM conversation this user is part of, with the other participant + last message. */
export function useRecentDms(): { otherUid: string; lastMessage: ChatMessage }[] {
  const uid = useAuthStore((s) => s.uid);
  const [threads, setThreads] = useState<{ otherUid: string; lastMessage: ChatMessage }[]>([]);

  useEffect(() => {
    setThreads([]);
    if (!supabase || !uid) return;

    const client = supabase;
    const messageChannels = new Map<string, ReturnType<typeof client.channel>>();
    const latestByConversation = new Map<string, ChatMessage>();
    let cancelled = false;

    const publish = () => {
      setThreads(
        Array.from(latestByConversation.entries())
          .map(([otherUid, lastMessage]) => ({ otherUid, lastMessage }))
          .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()),
      );
    };

    const watchConversation = (conversationId: string, otherUid: string) => {
      // The cancelled check matters as much as the Map guard: without it a late-resolving
      // initial query can create channels after cleanup already ran, leaking them forever.
      if (cancelled || messageChannels.has(conversationId)) return;

      const loadLatest = () => {
        client
          .from('conversation_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data }) => {
            if (cancelled) return;
            const first = (data as MessageRow[] | null)?.[0];
            if (!first) return;
            latestByConversation.set(otherUid, mapMessage(first));
            publish();
          });
      };

      loadLatest();
      const channel = client
        .channel(uniqueChannel(`recent_dms:${conversationId}`))
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: `conversation_id=eq.${conversationId}` },
          loadLatest,
        )
        .subscribe();
      messageChannels.set(conversationId, channel);
    };

    client
      .from('conversations')
      .select('id, participant_ids')
      .contains('participant_ids', [uid])
      .then(({ data }) => {
        if (cancelled) return;
        (data as { id: string; participant_ids: string[] }[] | null)?.forEach((row) => {
          const otherUid = row.participant_ids.find((id) => id !== uid);
          if (otherUid) watchConversation(row.id, otherUid);
        });
      });

    // Conversations are create-only (no update/delete policy), so INSERT is enough to
    // catch a new DM thread started by the other side after this hook's initial load.
    const newConversationsChannel = client
      .channel(uniqueChannel('conversations:new'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
        const row = payload.new as { id: string; participant_ids: string[] };
        if (!row.participant_ids.includes(uid)) return;
        const otherUid = row.participant_ids.find((id) => id !== uid);
        if (otherUid) watchConversation(row.id, otherUid);
      })
      .subscribe();

    return () => {
      cancelled = true;
      client.removeChannel(newConversationsChannel);
      messageChannels.forEach((channel) => client.removeChannel(channel));
      messageChannels.clear();
    };
  }, [uid]);

  return threads;
}
