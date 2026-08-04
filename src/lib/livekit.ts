import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';

export type LiveKitJoinInfo = {
  token: string;
  url: string;
  roomName: string;
  meetingTitle: string;
};

export class MeetingJoinError extends Error {}

/**
 * Calls the livekit-token Edge Function, which validates the room code
 * (and password, if set) and mints a short-lived LiveKit access token.
 * The LiveKit API secret never leaves that function's environment.
 */
export async function fetchLiveKitToken(roomCode: string, password?: string): Promise<LiveKitJoinInfo> {
  if (!supabase) {
    throw new MeetingJoinError('Connect a Supabase project to enable live video.');
  }

  const { data, error } = await supabase.functions.invoke<LiveKitJoinInfo>('livekit-token', {
    body: { roomCode, password },
  });

  if (error) {
    // FunctionsHttpError's `message` isn't the JSON body our function returns — pull the
    // actual `{error: "..."}` string out of the response instead.
    const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new MeetingJoinError(body?.error ?? 'Could not join this meeting.');
  }
  if (!data) {
    throw new MeetingJoinError('Could not join this meeting.');
  }

  return data;
}
