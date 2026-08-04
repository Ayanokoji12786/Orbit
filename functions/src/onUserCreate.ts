import * as functionsV1 from 'firebase-functions/v1';

import { db } from './admin';

/** Creates the Firestore profile doc the moment a Firebase Auth user is created. */
export const onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  const displayName = user.displayName ?? user.email?.split('@')[0] ?? 'New user';

  await db
    .collection('users')
    .doc(user.uid)
    .set({
      displayName,
      email: user.email?.toLowerCase() ?? null,
      avatarUrl: user.photoURL ?? null,
      bio: null,
      status: 'offline',
      timezone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
});
