import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';

import { AppText, Button, Chip } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { ensureNotificationPermission } from '@/lib/notifications';

export default function NotificationSettings() {
  const { colors, spacing, radii } = useAppTheme();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Notifications.getPermissionsAsync()
      .then((res) => {
        setGranted(res.granted || res.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
        setError(null);
      })
      .catch(() => setError('Could not check device notification settings.'));
  }, []);

  useFocusEffect(refresh);

  const requestPermission = async () => {
    try {
      const enabled = await ensureNotificationPermission();
      if (!enabled) await Linking.openSettings();
      refresh();
    } catch {
      setError('Could not open device notification settings.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Notifications" />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceElevated,
          }}>
          <View>
            <AppText variant="bodyMedium">Meeting reminders</AppText>
            <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
              A local reminder 10 minutes before meetings you schedule.
            </AppText>
          </View>
          <Chip label={granted === null ? 'Checking' : granted ? 'On' : 'Off'} tone={granted ? 'success' : 'neutral'} />
        </View>

        {granted === false && (
          <Button label="Enable notifications" onPress={requestPermission} />
        )}

        {error && <AppText variant="caption" color="error">{error}</AppText>}

        <AppText variant="caption" color="textTertiary">
          Reminders are scheduled on this device when you create or reschedule a meeting here. Push notifications,
          recording alerts, and invitation alerts are not available yet.
        </AppText>
      </View>
    </View>
  );
}
