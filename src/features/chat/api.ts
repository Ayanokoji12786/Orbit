import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
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

async function uploadChatImage(localUri: string, pathPrefix: string): Promise<string> {
  if (!supabase) throw new Error('Connect a Supabase project to share images.');
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${pathPrefix}/${filename}`;

  const blob = await (await fetch(localUri)).blob();
  const { error } = await supabase.storage.from('chat-uploads').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;

  return supabase.storage.from('chat-uploads').getPublicUrl(path).data.publicUrl;
}

type ChatApi = {
  messages: ChatMessage[];
  sendText: (text: string) => Promise<void>;
  sendImage: (localUri: string) => Promise<void>;
};

/** A 1:1 DM thread, keyed deterministically so both sides resolve the same conversation. */
export function useDmMessages(otherUid: string | undefined): ChatApi {
  const uid = useAuthStore((s) => s.uid);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const conversationId = uid && otherUid ? dmConversationId(uid, otherUid) : null;

  useEffect(() => {
    if (!supabase || !uid || !otherUid || !conversationId) return;
    supabase
      .from('conversations')
      .upsert({ id: conversationId, kind: 'dm', participant_ids: [uid, otherUid].sort() }, { ignoreDuplicates: true })
      .then();
  }, [uid, otherUid, conversationId]);

  useEffect(() => {
    if (!supabase || !conversationId) {
      setMessages([]);
      return;
    }
    const client = supabase;
    let cancelled = false;

    client
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setMessages((data as MessageRow[]).map(mapMessage));
      });

    const channel = client
      .channel(`conversation_messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => [...prev, mapMessage(payload.new as MessageRow)]),
      )
      .subscribe();

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, [conversationId]);

  const sendText = async (text: string) => {
    if (!supabase || !conversationId || !uid) return;
    await supabase
      .from('conversation_messages')
      .insert({ conversation_id: conversationId, sender_id: uid, sender_name: myDisplayName(), text });
  };

  const sendImage = async (localUri: string) => {
    if (!supabase || !conversationId || !uid) return;
    const imageUrl = await uploadChatImage(localUri, conversationId);
    await supabase
      .from('conversation_messages')
      .insert({ conversation_id: conversationId, sender_id: uid, sender_name: myDisplayName(), image_url: imageUrl });
  };

  return { messages, sendText, sendImage };
}

/** A meeting's group chat, scoped to a single meeting. */
export function useMeetingMessages(meetingId: string | undefined): ChatApi {
  const uid = useAuthStore((s) => s.uid);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!supabase || !meetingId) {
      setMessages([]);
      return;
    }
    const client = supabase;
    let cancelled = false;

    client
      .from('meeting_messages')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setMessages((data as MessageRow[]).map(mapMessage));
      });

    const channel = client
      .channel(`meeting_messages:${meetingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meeting_messages', filter: `meeting_id=eq.${meetingId}` },
        (payload) => setMessages((prev) => [...prev, mapMessage(payload.new as MessageRow)]),
      )
      .subscribe();

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, [meetingId]);

  const sendText = async (text: string) => {
    if (!supabase || !meetingId || !uid) return;
    await supabase.from('meeting_messages').insert({ meeting_id: meetingId, sender_id: uid, sender_name: myDisplayName(), text });
  };

  const sendImage = async (localUri: string) => {
    if (!supabase || !meetingId || !uid) return;
    const imageUrl = await uploadChatImage(localUri, meetingId);
    await supabase
      .from('meeting_messages')
      .insert({ meeting_id: meetingId, sender_id: uid, sender_name: myDisplayName(), image_url: imageUrl });
  };

  return { messages, sendText, sendImage };
}

/** Every DM conversation this user is part of, with the other participant + last message. */
export function useRecentDms(): { otherUid: string; lastMessage: ChatMessage }[] {
  const uid = useAuthStore((s) => s.uid);
  const [threads, setThreads] = useState<{ otherUid: string; lastMessage: ChatMessage }[]>([]);

  useEffect(() => {
    if (!supabase || !uid) {
      setThreads([]);
      return;
    }
    const client = supabase;
    const messageChannels = new Map<string, ReturnType<typeof client.channel>>();
    const latestByConversation = new Map<string, ChatMessage>();

    const publish = () => {
      setThreads(
        Array.from(latestByConversation.entries())
          .map(([otherUid, lastMessage]) => ({ otherUid, lastMessage }))
          .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()),
      );
    };

    const watchConversation = (conversationId: string, otherUid: string) => {
      if (messageChannels.has(conversationId)) return;

      const loadLatest = () => {
        client
          .from('conversation_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data }) => {
            const first = (data as MessageRow[] | null)?.[0];
            if (!first) return;
            latestByConversation.set(otherUid, mapMessage(first));
            publish();
          });
      };

      loadLatest();
      const channel = client
        .channel(`conversation_messages:${conversationId}`)
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
        (data as { id: string; participant_ids: string[] }[] | null)?.forEach((row) => {
          const otherUid = row.participant_ids.find((id) => id !== uid);
          if (otherUid) watchConversation(row.id, otherUid);
        });
      });

    // Conversations are create-only (no update/delete policy), so INSERT is enough to
    // catch a new DM thread started by the other side after this hook's initial load.
    const newConversationsChannel = client
      .channel('conversations:new')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
        const row = payload.new as { id: string; participant_ids: string[] };
        if (!row.participant_ids.includes(uid)) return;
        const otherUid = row.participant_ids.find((id) => id !== uid);
        if (otherUid) watchConversation(row.id, otherUid);
      })
      .subscribe();

    return () => {
      client.removeChannel(newConversationsChannel);
      messageChannels.forEach((channel) => client.removeChannel(channel));
      messageChannels.clear();
    };
  }, [uid]);

  return threads;
}
