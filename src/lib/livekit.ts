import { httpsCallable } from '@react-native-firebase/functions';

import { functionsClient } from './firebase';

export type LiveKitJoinInfo = {
  token: string;
  url: string;
  roomName: string;
  meetingTitle: string;
};

export class MeetingJoinError extends Error {}

/**
 * Calls the livekitToken Cloud Function, which validates the room code
 * (and password, if set) and mints a short-lived LiveKit access token.
 * The LiveKit API secret never leaves that function's environment.
 */
export async function fetchLiveKitToken(roomCode: string, password?: string): Promise<LiveKitJoinInfo> {
  if (!functionsClient) {
    throw new MeetingJoinError('Connect a Firebase project to enable live video.');
  }

  try {
    const callable = httpsCallable<{ roomCode: string; password?: string }, LiveKitJoinInfo>(
      functionsClient,
      'livekitToken',
    );
    const result = await callable({ roomCode, password });
    return result.data;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not join this meeting.';
    throw new MeetingJoinError(message);
  }
}
