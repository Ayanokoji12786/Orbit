import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { AppText, Button } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { deleteOwnAccount } from '@/features/account/api';

export default function PrivacySettings() {
  const { colors, spacing, radii } = useAppTheme();
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notice = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  };

  const deleteAccount = async () => {
    if (deleting || confirmation !== 'DELETE') return;
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteOwnAccount();
      const messages: string[] = [];
      if (!result.verifiedDeleted) {
        messages.push('Your session is no longer available, so Orbit cannot confirm whether deletion finished. Sign in again to verify; if the account still exists, retry deletion.');
      }
      if (result.reminderCleanupFailed) {
        messages.push('Orbit could not clear scheduled reminders on this device. You may still receive them.');
      }
      if (result.signOutFailed) {
        messages.push('This device could not finish signing out. Restart Orbit before signing in again.');
      }
      if (messages.length) notice(result.verifiedDeleted ? 'Device cleanup' : 'Check your account', messages.join('\n\n'));
      router.replace('/(auth)/sign-in');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account deletion could not finish. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Privacy & Security" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}>
        <AppText variant="headline">Delete your account</AppText>
        <AppText variant="body" color="textSecondary">
          This permanently removes your profile, contacts, direct messages, hosted meetings, uploads, and content you posted in other meetings. Other people will lose access to shared direct messages and meetings you hosted. This cannot be undone.
        </AppText>
        <AppText variant="caption" color="textTertiary">
          For security, sign out and sign back in before deleting, then start within 10 minutes. If cleanup is interrupted, come back and retry. Other devices cannot renew their sessions after deletion, though an already issued access token may work briefly until it expires.
        </AppText>

        <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
          <AppText variant="bodyMedium">Type DELETE to confirm</AppText>
          <TextInput
            accessibilityLabel="Type DELETE to confirm account deletion"
            accessibilityHint="Required before the permanent delete button is enabled"
            value={confirmation}
            onChangeText={(value) => { setConfirmation(value); setError(null); }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            editable={!deleting}
            placeholder="DELETE"
            placeholderTextColor={colors.textTertiary}
            style={{
              color: colors.textPrimary,
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              fontSize: 16,
            }}
          />
        </View>

        {error && <AppText variant="caption" color="error">{error}</AppText>}
        <Button
          label="Permanently delete account"
          variant="destructive"
          onPress={deleteAccount}
          loading={deleting}
          disabled={confirmation !== 'DELETE'}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
