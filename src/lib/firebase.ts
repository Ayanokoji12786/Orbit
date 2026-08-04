import { getApps } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getFunctions } from '@react-native-firebase/functions';
import { getStorage } from '@react-native-firebase/storage';

/**
 * True once the native app has initialized from GoogleService-Info.plist /
 * google-services.json. False (never throws) if those files aren't present
 * yet — callers should check this before touching auth/firestore/etc.
 */
export const isFirebaseConfigured = getApps().length > 0;

export const auth = isFirebaseConfigured ? getAuth() : null;
export const firestore = isFirebaseConfigured ? getFirestore() : null;
export const storage = isFirebaseConfigured ? getStorage() : null;
export const functionsClient = isFirebaseConfigured ? getFunctions() : null;
