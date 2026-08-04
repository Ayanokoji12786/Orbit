import { useEffect, useState } from 'react';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from '@react-native-firebase/firestore';
import { getDownloadURL, putFile, ref } from '@react-native-firebase/storage';

import { firestore, storage } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';
import type { ChatMessage } from '@/types/domain';

function mapMessage(id: string, data: DocumentData): ChatMessage {
  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
  return {
    id,
    senderId: data.senderId,
    senderName: data.senderName ?? 'Orbit User',
    text: data.text ?? undefined,
    imageUri: data.imageUrl ?? undefined,
    createdAt: createdAt.toISOString(),
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
  if (!storage) throw new Error('Connect a Firebase project to share images.');
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const storageRef = ref(storage, `chat-uploads/${pathPrefix}/${filename}`);
  await putFile(storageRef, localUri);
  return getDownloadURL(storageRef);
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
    if (!firestore || !uid || !otherUid || !conversationId) return;
    const convRef = doc(firestore, 'conversations', conversationId);
    getDoc(convRef).then((snap) => {
      if (!snap.exists()) {
        setDoc(convRef, { kind: 'dm', participantIds: [uid, otherUid].sort(), createdAt: serverTimestamp() });
      }
    });
  }, [uid, otherUid, conversationId]);

  useEffect(() => {
    if (!firestore || !conversationId) {
      setMessages([]);
      return;
    }
    const q = query(collection(firestore, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => setMessages(snap.docs.map((d) => mapMessage(d.id, d.data()))));
  }, [conversationId]);

  const sendText = async (text: string) => {
    if (!firestore || !conversationId || !uid) return;
    await addDoc(collection(firestore, 'conversations', conversationId, 'messages'), {
      senderId: uid,
      senderName: myDisplayName(),
      text,
      createdAt: serverTimestamp(),
    });
  };

  const sendImage = async (localUri: string) => {
    if (!firestore || !conversationId || !uid) return;
    const imageUrl = await uploadChatImage(localUri, conversationId);
    await addDoc(collection(firestore, 'conversations', conversationId, 'messages'), {
      senderId: uid,
      senderName: myDisplayName(),
      imageUrl,
      createdAt: serverTimestamp(),
    });
  };

  return { messages, sendText, sendImage };
}

/** A meeting's group chat, scoped as a subcollection of the meeting doc. */
export function useMeetingMessages(meetingId: string | undefined): ChatApi {
  const uid = useAuthStore((s) => s.uid);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!firestore || !meetingId) {
      setMessages([]);
      return;
    }
    const q = query(collection(firestore, 'meetings', meetingId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => setMessages(snap.docs.map((d) => mapMessage(d.id, d.data()))));
  }, [meetingId]);

  const sendText = async (text: string) => {
    if (!firestore || !meetingId || !uid) return;
    await addDoc(collection(firestore, 'meetings', meetingId, 'messages'), {
      senderId: uid,
      senderName: myDisplayName(),
      text,
      createdAt: serverTimestamp(),
    });
  };

  const sendImage = async (localUri: string) => {
    if (!firestore || !meetingId || !uid) return;
    const imageUrl = await uploadChatImage(localUri, meetingId);
    await addDoc(collection(firestore, 'meetings', meetingId, 'messages'), {
      senderId: uid,
      senderName: myDisplayName(),
      imageUrl,
      createdAt: serverTimestamp(),
    });
  };

  return { messages, sendText, sendImage };
}

/** Every DM conversation this user is part of, with the other participant + last message. */
export function useRecentDms(): { otherUid: string; lastMessage: ChatMessage }[] {
  const uid = useAuthStore((s) => s.uid);
  const [threads, setThreads] = useState<{ otherUid: string; lastMessage: ChatMessage }[]>([]);

  useEffect(() => {
    if (!firestore || !uid) {
      setThreads([]);
      return;
    }
    const unsubscribes: Array<() => void> = [];

    const convosQuery = query(collection(firestore, 'conversations'), where('participantIds', 'array-contains', uid));
    const unsubscribeConvos = onSnapshot(convosQuery, (snap) => {
      unsubscribes.forEach((u) => u());
      unsubscribes.length = 0;

      const dmDocs = snap.docs.filter((d) => d.data().kind === 'dm');

      if (dmDocs.length === 0) {
        setThreads([]);
        return;
      }

      const latestByConversation = new Map<string, ChatMessage>();
      dmDocs.forEach((convoDoc) => {
        const otherUid = (convoDoc.data().participantIds as string[]).find((id) => id !== uid);
        if (!otherUid) return;

        const lastMessageQuery = query(
          collection(firestore!, 'conversations', convoDoc.id, 'messages'),
          orderBy('createdAt', 'desc'),
        );
        const unsub = onSnapshot(lastMessageQuery, (msgSnap) => {
          const first = msgSnap.docs[0];
          if (!first) return;
          latestByConversation.set(otherUid, mapMessage(first.id, first.data()));
          setThreads(
            Array.from(latestByConversation.entries())
              .map(([id, lastMessage]) => ({ otherUid: id, lastMessage }))
              .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()),
          );
        });
        unsubscribes.push(unsub);
      });
    });

    return () => {
      unsubscribeConvos();
      unsubscribes.forEach((u) => u());
    };
  }, [uid]);

  return threads;
}
