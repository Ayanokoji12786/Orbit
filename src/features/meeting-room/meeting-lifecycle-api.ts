import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

type Action = 'leave' | 'end';

export class MeetingLifecycleError extends Error {
  constructor(message: string, readonly databaseUpdated: boolean, readonly status?: number) {
    super(message);
  }
}

async function invokeLifecycle(action: Action | 'renew', meetingId: string): Promise<void> {
  if (!supabase) throw new Error('Connect a Supabase project to manage this meeting.');
  const { data, error } = await supabase.functions.invoke<Record<string, boolean>>('meeting-lifecycle', {
    body: { action, meetingId },
  });
  if (error) {
    const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new MeetingLifecycleError(
      typeof body?.error === 'string' ? body.error : 'Could not update this meeting. Try again.',
      body?.retryable === true,
      error instanceof FunctionsHttpError ? error.context.status : undefined,
    );
  }
  const resultKey = action === 'end' ? 'ended' : action === 'leave' ? 'left' : 'renewed';
  if (!data?.[resultKey]) {
    throw new Error('Could not confirm the meeting change. Try again.');
  }
}

export async function changeLiveMeeting(action: Action, meetingId: string): Promise<void> {
  await invokeLifecycle(action, meetingId);
}

export async function renewLiveMeeting(meetingId: string): Promise<void> {
  await invokeLifecycle('renew', meetingId);
}
