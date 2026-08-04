import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ChatMessage } from '@/types/domain';

type ChatStore = {
  threads: Record<string, ChatMessage[]>;
  seedThread: (threadId: string, messages: ChatMessage[]) => void;
  sendMessage: (threadId: string, message: Omit<ChatMessage, 'id' | 'createdAt' | 'senderId' | 'senderName'>) => void;
};

const ME = { senderId: 'me', senderName: 'You' };

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      threads: {},
      seedThread: (threadId, messages) => {
        if (get().threads[threadId]) return;
        set((state) => ({ threads: { ...state.threads, [threadId]: messages } }));
      },
      sendMessage: (threadId, message) => {
        const newMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date().toISOString(),
          ...ME,
          ...message,
        };
        set((state) => ({
          threads: {
            ...state.threads,
            [threadId]: [...(state.threads[threadId] ?? []), newMessage],
          },
        }));
      },
    }),
    {
      name: 'orbit.chat',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function dmThreadId(contactId: string) {
  return `dm:${contactId}`;
}

export function meetingThreadId(roomId: string) {
  return `meeting:${roomId}`;
}
