import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * @react-native-async-storage/async-storage's web implementation assumes a browser and
 * touches `window` unconditionally — that crashes Expo Router's web server-side render
 * pass (a real Node process, not a browser). This adapter no-ops during that pass and
 * only touches `window.localStorage` once actually running client-side.
 */
const webStorage = {
  getItem: (key: string) =>
    Promise.resolve(typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    return Promise.resolve();
  },
};

/**
 * `supabase` is null until EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are set
 * in .env (see .env.example). Callers must check `isSupabaseConfigured` first so the app can
 * still render its UI before a backend is wired up. Unlike the old @react-native-firebase
 * client, this is pure JS and runs identically on native and web — no `.web.ts` stub needed.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
