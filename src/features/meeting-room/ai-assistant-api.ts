import { useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type AiMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };

const HISTORY_SENT_TO_MODEL = 20;
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useAiAssistant(meetingTitle: string) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;
    if (!supabase) {
      setError('Connect a Supabase project to enable the AI assistant.');
      return;
    }

    const userMessage: AiMessage = { id: newId(), role: 'user', content: trimmed, createdAt: new Date().toISOString() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setError(null);
    setIsThinking(true);

    try {
      const payload = nextMessages.slice(-HISTORY_SENT_TO_MODEL).map(({ role, content }) => ({ role, content }));
      const { data, error: fnError } = await supabase.functions.invoke<{ reply: string }>('groq-chat', {
        body: { messages: payload, meetingTitle },
      });

      if (fnError) {
        const body = fnError instanceof FunctionsHttpError ? await fnError.context.json().catch(() => null) : null;
        throw new Error(body?.error ?? 'Could not reach the AI assistant.');
      }
      if (!data?.reply) throw new Error('Could not reach the AI assistant.');

      setMessages((prev) => [...prev, { id: newId(), role: 'assistant', content: data.reply, createdAt: new Date().toISOString() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the AI assistant.');
    } finally {
      setIsThinking(false);
    }
  };

  return { messages, isThinking, error, sendMessage };
}
