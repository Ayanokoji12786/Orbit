import * as bcrypt from 'bcryptjs';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';

type Request = { meetingId?: string; password?: string | null };

/** Callable function: host-only. Sets or clears a meeting's password (stored hashed). */
export const setMeetingPassword = onCall<Request>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const meetingId = request.data.meetingId;
  if (!meetingId) {
    throw new HttpsError('invalid-argument', 'meetingId is required.');
  }

  const meetingRef = db.collection('meetings').doc(meetingId);
  const meetingSnap = await meetingRef.get();
  if (!meetingSnap.exists) {
    throw new HttpsError('not-found', 'Meeting not found.');
  }
  if (meetingSnap.data()?.hostId !== uid) {
    throw new HttpsError('permission-denied', 'Only the host can set a meeting password.');
  }

  const password = request.data.password?.trim();

  if (!password) {
    await meetingRef.update({ hasPassword: false });
    await db.collection('meetingSecrets').doc(meetingId).delete();
    return { hasPassword: false };
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  await meetingRef.update({ hasPassword: true });
  await db.collection('meetingSecrets').doc(meetingId).set({ passwordHash });

  return { hasPassword: true };
});
