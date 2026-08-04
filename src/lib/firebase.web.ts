// @react-native-firebase has no web implementation at all (unlike our old
// Supabase client, which was pure JS and ran identically everywhere). This
// file keeps `expo start --web` usable for the rest of the app by never
// importing the native package here — every consumer already checks
// `isFirebaseConfigured` first, so nothing tries to call through these nulls.
import type { Auth } from '@react-native-firebase/auth';
import type { Firestore } from '@react-native-firebase/firestore';
import type { Functions } from '@react-native-firebase/functions';
import type { FirebaseStorage } from '@react-native-firebase/storage';

export const isFirebaseConfigured = false;

export const auth: Auth | null = null;
export const firestore: Firestore | null = null;
export const storage: FirebaseStorage | null = null;
export const functionsClient: Functions | null = null;
