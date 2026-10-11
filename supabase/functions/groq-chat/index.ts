import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const GROQ_MODEL = 'openai/gpt-oss-120b';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

type InMessage = { role: 'user' | 'assistant'; content: string };
const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;
const MAX_TOTAL_CONTENT_LENGTH = 24000;

/**
 * Proxies one chat turn to Groq's OpenAI-compatible API. Stateless — the
 * client sends the full running conversation each call. GROQ_API_KEY never
 * leaves this environment.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sign in required.' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Sign in required.' }, 401);

    const { data: accountActive, error: accountError } = await userClient.rpc('account_is_active');
    if (accountError) {
      console.error('account_is_active failed', accountError);
      return json({ error: 'The AI assistant is unavailable right now.' }, 503);
    }
    if (!accountActive) return json({ error: 'This account is no longer active.' }, 403);

    // Destructure the error: without it any RPC failure yields data === null, which
    // reads as "not allowed" and 429s every request with a misleading message.
    const { data: allowed, error: rateErr } = await userClient.rpc('check_rate_limit', {
      p_bucket: 'groq-chat',
      p_max_calls: 20,
      p_window_minutes: 10,
    });
    if (rateErr) {
      // Fail closed here — unlike joining a meeting, this path spends money upstream.
      console.error('check_rate_limit failed', rateErr);
      return json({ error: 'The AI assistant is unavailable right now.' }, 503);
    }
    if (!allowed) return json({ error: 'Too many requests. Try again in a few minutes.' }, 429);

    if (!GROQ_API_KEY) return json({ error: 'The AI assistant is not configured.' }, 503);
    const requestBody = await req.json().catch(() => null);
    if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
      return json({ error: 'Invalid request body.' }, 400);
    }
    const { messages, meetingId } = requestBody as { messages?: InMessage[]; meetingId?: unknown };
    if (typeof meetingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meetingId)) {
      return json({ error: 'Invalid meeting.' }, 400);
    }

    if (!Array.isArray(messages) || messages.length === 0) return json({ error: 'messages is required.' }, 400);
    if (messages.length > MAX_MESSAGES) return json({ error: 'Conversation is too long.' }, 400);
    let totalContentLength = 0;
    for (const m of messages) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) {
        return json({ error: 'Malformed message.' }, 400);
      }
      if (m.content.length > MAX_CONTENT_LENGTH) return json({ error: 'Message is too long.' }, 400);
      totalContentLength += m.content.length;
    }
    if (totalContentLength > MAX_TOTAL_CONTENT_LENGTH) return json({ error: 'Conversation is too long.' }, 400);

    const { data: isMember, error: membershipError } = await userClient.rpc('is_active_meeting_member', {
      p_meeting_id: meetingId,
    });
    if (membershipError) {
      console.error('is_active_meeting_member failed', membershipError);
      return json({ error: 'The AI assistant is unavailable right now.' }, 503);
    }
    if (!isMember) return json({ error: 'This meeting is no longer available to you.' }, 403);

    const systemMessage = {
      role: 'system' as const,
      content: `You are Orbit's in-meeting AI assistant. Be concise and helpful. You cannot hear the meeting or read its chat, transcript, or files. Never claim to know what participants said or decided unless the user includes it in a message. Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [systemMessage, ...messages],
        max_completion_tokens: 800,
        stream: false,
      }),
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
