import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;
const GROQ_MODEL = 'openai/gpt-oss-120b';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

type InMessage = { role: 'user' | 'assistant'; content: string };
const MAX_MESSAGES = 30;
const MAX_CONTENT_LENGTH = 4000;

/**
 * Proxies one chat turn to Groq's OpenAI-compatible API. Stateless — the
 * client sends the full running conversation each call. GROQ_API_KEY never
 * leaves this environment.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sign in required.' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Sign in required.' }, 401);

    const { data: allowed } = await userClient.rpc('check_rate_limit', {
      p_bucket: 'groq-chat',
      p_max_calls: 20,
      p_window_minutes: 10,
    });
    if (!allowed) return json({ error: 'Too many requests. Try again in a few minutes.' }, 429);

    const { messages, meetingTitle } = (await req.json()) as { messages?: InMessage[]; meetingTitle?: string };

    if (!Array.isArray(messages) || messages.length === 0) return json({ error: 'messages is required.' }, 400);
    if (messages.length > MAX_MESSAGES) return json({ error: 'Conversation is too long.' }, 400);
    for (const m of messages) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) {
        return json({ error: 'Malformed message.' }, 400);
      }
      if (m.content.length > MAX_CONTENT_LENGTH) return json({ error: 'Message is too long.' }, 400);
    }

    const systemMessage = {
      role: 'system' as const,
      content: `You are Orbit's in-meeting AI assistant. Be concise and helpful.${meetingTitle ? ` The meeting is titled "${meetingTitle}".` : ''} Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [systemMessage, ...messages], stream: false }),
    });

    if (!groqRes.ok) {
      console.error('Groq error', groqRes.status, await groqRes.text());
      return json({ error: 'The AI assistant is unavailable right now.' }, 502);
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') return json({ error: 'The AI assistant is unavailable right now.' }, 502);

    return json({ reply });
  } catch (err) {
    console.error(err);
    return json({ error: 'Unexpected error.' }, 500);
  }
});
