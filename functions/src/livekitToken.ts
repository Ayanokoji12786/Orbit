import * as bcrypt from 'bcryptjs';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { AccessToken } from 'livekit-server-sdk';

import { db } from './admin';

const livekitApiKey = defineSecret('LIVEKIT_API_KEY');
const livekitApiSecret = defineSecret('LIVEKIT_API_SECRET');
const livekitUrl = defineString('LIVEKIT_URL');

type Request = { roomCode?: string; password?: string };

/**
 * Callable function: validates a meeting join (room code + optional
 * password), records the participant, and mints a LiveKit access token.
 * The LiveKit API secret only ever lives in this function's environment.
 */
export const livekitToken = onCall<Request>(
  { secrets: [livekitApiKey, livekitApiSecret] },
  async (request) => {
    const uid = request.auth?.uid;
    const email = request.auth?.token.email as string | undefined;
    const displayName = (request.auth?.token.name as string | undefined) ?? email ?? 'Guest';

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const roomCode = request.data.roomCode?.trim();
    if (!roomCode) {
      throw new HttpsError('invalid-argument', 'roomCode is required.');
    }

    const meetingsSnap = await db.collection('meetings').where('roomCode', '==', roomCode).limit(1).get();
    if (meetingsSnap.empty) {
      throw new HttpsError('not-found', 'Meeting not found.');
    }
    const meetingDoc = meetingsSnap.docs[0];
    const meeting = meetingDoc.data();

    if (meeting.hasPassword) {
      const secretSnap = await db.collection('meetingSecrets').doc(meetingDoc.id).get();
      const passwordHash = secretSnap.data()?.passwordHash as string | undefined;

      if (!request.data.password) {
        throw new HttpsError('unauthenticated', 'Password required.');
      }
      if (!passwordHash || !bcrypt.compareSync(request.data.password, passwordHash)) {
        throw new HttpsError('permission-denied', 'Incorrect password.');
      }
    }

    await meetingDoc.ref.collection('participants').doc(uid).set(
      { joinedAt: new Date() },
      { merge: true },
    );
    await meetingDoc.ref.update({ participantIds: FieldValue.arrayUnion(uid) });

    const accessToken = new AccessToken(livekitApiKey.value(), livekitApiSecret.value(), {
      identity: uid,
      name: displayName,
      ttl: '4h',
    });
    accessToken.addGrant({
      room: meetingDoc.id,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      token: await accessToken.toJwt(),
      url: livekitUrl.value(),
      roomName: meetingDoc.id,
      meetingTitle: meeting.title as string,
    };
  },
);
