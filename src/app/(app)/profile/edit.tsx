import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { AppText, Avatar, Button } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { updateOwnProfile, useProfile, type UserProfile } from '@/features/profile/api';

export default function EditProfile() {
  const { colors, spacing } = useAppTheme();
  const { profile, loading, error } = useProfile();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Edit profile" />
      {loading && !profile ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !profile ? (
        <View style={{ padding: spacing.lg }}>
          <AppText variant="body" color="error">{error ?? 'Your profile could not be loaded.'}</AppText>
        </View>
      ) : (
        <ProfileForm key={profile.id} profile={profile} loadError={error} />
      )}
    </KeyboardAvoidingView>
  );
}

function ProfileForm({ profile, loadError }: { profile: UserProfile; loadError: string | null }) {
  const { colors, spacing, radii } = useAppTheme();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const previewUri = avatar === undefined ? profile.avatarUrl : avatar?.uri ?? null;

  const choosePhoto = async () => {
    setSaveError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) setAvatar(result.assets[0]);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not open your photo library.');
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateOwnProfile({ displayName, bio, avatar });
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}>
      <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
        <Avatar name={displayName || profile.displayName} uri={previewUri} size={88} />
      </View>

      <View style={{ gap: spacing.xs }}>
        <AppText variant="bodyMedium">Display name</AppText>
        <TextInput
          accessibilityLabel="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={80}
          autoCapitalize="words"
          style={inputStyle}
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        <AppText variant="bodyMedium">Bio</AppText>
        <TextInput
          accessibilityLabel="Bio"
          value={bio}
          onChangeText={setBio}
          maxLength={500}
          multiline
          textAlignVertical="top"
          placeholder="A little about you"
          placeholderTextColor={colors.textTertiary}
          style={[inputStyle, { minHeight: 110 }]}
        />
        <AppText variant="caption" color="textTertiary">{bio.length}/500</AppText>
      </View>

      <View style={{ gap: spacing.xs }}>
        <AppText variant="bodyMedium">Photo</AppText>
        <Button label={previewUri ? 'Change photo' : 'Choose photo'} variant="secondary" disabled={saving} onPress={choosePhoto} />
        {previewUri && (
          <Button label="Remove photo" variant="ghost" disabled={saving} onPress={() => setAvatar(null)} />
        )}
        <AppText variant="caption" color="textTertiary">
          Your photo is visible to contacts. Choose a JPEG, PNG, WebP, HEIC, or HEIF image under 5 MB.
        </AppText>
      </View>

      {(saveError || loadError) && (
        <AppText variant="caption" color="error">{saveError ?? loadError}</AppText>
      )}
      <Button label="Save profile" loading={saving} disabled={!displayName.trim()} onPress={save} />
    </ScrollView>
  );
}
