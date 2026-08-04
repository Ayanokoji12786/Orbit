import { useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';

import { AppText, Button, Chip } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { ensureNotificationPermission } from '@/lib/notifications';

export default function NotificationSettings() {
  const { colors, spacing, radii } = useAppTheme();
  const [status, setStatus] = useState<Notifications.PermissionStatus | null>(null);

  const refresh = useCallback(() => {
    Notifications.getPermissionsAsync().then((res) => setStatus(res.status));
  }, []);

  useFocusEffect(refresh);

  const requestPermission = async () => {
    const granted = await ensureNotificationPermission();
    if (!granted) {
      Linking.openSettings();
    }
    refresh();
  };

  const granted = status === Notifications.PermissionStatus.GRANTED;

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
          <Chip label={granted ? 'On' : 'Off'} tone={granted ? 'success' : 'neutral'} />
        </View>

        {!granted && (
          <Button label="Enable notifications" onPress={requestPermission} />
        )}

        <AppText variant="caption" color="textTertiary">
          Recording-ready, AI-summary, and invitation notifications are sent from Orbit's backend and
          switch on once Supabase + push are wired up (Phase 2/4).
        </AppText>
      </View>
    </View>
  );
}
