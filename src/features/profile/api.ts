import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { File as ExpoFile } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { AVATAR_STORAGE_PREFIX } from './useAvatarImageUrl';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export type UserProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
};

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
  };
}

/** Reloads when the profile route is focused, including after the edit modal closes. */
export function useProfile() {
  const uid = useAuthStore((state) => state.uid);
  const [record, setRecord] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const currentRequest = ++requestId.current;
      if (!supabase || !uid) {
        setRecord(null);
        setError(!supabase ? 'Connect a Supabase project to view your profile.' : 'Sign in to view your profile.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      supabase
        .from('users')
        .select('id, display_name, avatar_url, bio')
        .eq('id', uid)
        .single()
        .then(({ data, error: loadError }) => {
          if (currentRequest !== requestId.current) return;
          if (loadError) {
            setError(loadError.message);
          } else {
            setRecord(mapProfile(data as ProfileRow));
          }
          setLoading(false);
        });

      return () => {
        requestId.current++;
      };
    }, [uid]),
  );

  return { profile: record?.id === uid ? record : null, loading, error };
}

export async function updateOwnProfile(input: {
  displayName: string;
  bio: string;
  /** undefined keeps the current image; null removes it; an asset replaces it. */
  avatar: ImagePickerAsset | null | undefined;
}): Promise<UserProfile> {
  if (!supabase) throw new Error('Connect a Supabase project to edit your profile.');
  const uid = useAuthStore.getState().uid;
  if (!uid) throw new Error('Sign in to edit your profile.');

  const displayName = input.displayName.trim();
  const bio = input.bio.trim();
  if (!displayName || displayName.length > 80) throw new Error('Name must be between 1 and 80 characters.');
  if (bio.length > 500) throw new Error('Bio must be 500 characters or fewer.');

  let previousAvatarUrl: string | null = null;
  let uploadedPath: string | null = null;
  if (input.avatar !== undefined) {
    const { data, error } = await supabase.from('users').select('avatar_url').eq('id', uid).single();
    if (error) throw new Error(error.message);
    previousAvatarUrl = (data as { avatar_url: string | null }).avatar_url;
    if (input.avatar) uploadedPath = await uploadAvatarImage(input.avatar, uid);
  }

  const updates: Record<string, string | null> = {
    display_name: displayName,
    bio: bio || null,
    updated_at: new Date().toISOString(),
  };
  if (input.avatar !== undefined) updates.avatar_url = uploadedPath ? AVATAR_STORAGE_PREFIX + uploadedPath : null;

  let saved: ProfileRow;
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', uid)
      .select('id, display_name, avatar_url, bio')
      .single();
    if (error) throw new Error(error.message);
    saved = data as ProfileRow;
  } catch (error) {
    if (uploadedPath) await removeAvatarImage(uploadedPath);
    throw error;
  }

  const oldPath = previousAvatarUrl?.startsWith(AVATAR_STORAGE_PREFIX)
    ? previousAvatarUrl.slice(AVATAR_STORAGE_PREFIX.length)
    : null;
  if (oldPath && oldPath.startsWith(`${uid}/`) && oldPath !== uploadedPath) {
    // Profile saving has succeeded. Cleanup failure should not turn it into a
    // misleading save error; old objects remain private and can be reclaimed.
    void removeAvatarImage(oldPath);
  }
  return mapProfile(saved);
}

async function uploadAvatarImage(asset: ImagePickerAsset, uid: string): Promise<string> {
  if (!supabase) throw new Error('Connect a Supabase project to upload an avatar.');
  const filename = asset.fileName || asset.uri;
  const extensionFromName = filename.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase();
  const inferredType = extensionFromName === 'jpg' || extensionFromName === 'jpeg'
    ? 'image/jpeg'
    : extensionFromName && AVATAR_EXTENSIONS[`image/${extensionFromName}`]
      ? `image/${extensionFromName}`
      : '';
  const rawType = (asset.mimeType || asset.file?.type || inferredType).toLowerCase();
  const contentType = rawType === 'image/jpg' ? 'image/jpeg' : rawType;
  const extension = AVATAR_EXTENSIONS[contentType];
  if (!extension) throw new Error('Choose a JPEG, PNG, WebP, HEIC, or HEIF photo.');
  if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) throw new Error('Choose a photo smaller than 5 MB.');

  // React Native's Blob is not a transferable byte buffer for storage-js.
  const body = Platform.OS === 'web'
    ? (asset.file ?? await (await fetch(asset.uri)).blob())
    : await new ExpoFile(asset.uri).arrayBuffer();
  const byteLength = body instanceof ArrayBuffer ? body.byteLength : body.size;
  if (byteLength > MAX_AVATAR_BYTES) throw new Error('Choose a photo smaller than 5 MB.');

  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const { error } = await supabase.storage.from('profile-avatars').upload(path, body, { contentType });
  if (error) throw new Error(error.message);
  return path;
}

async function removeAvatarImage(path: string) {
  if (!supabase) return;
  try {
    await supabase.storage.from('profile-avatars').remove([path]);
  } catch {
    // The profile operation has already succeeded or failed independently.
  }
}
