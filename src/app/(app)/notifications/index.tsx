import { View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';

export default function Notifications() {
  const { colors } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Notifications" />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState icon="notifications-off-outline" title="No in-app notifications" subtitle="Scheduled meeting reminders arrive as device notifications. An in-app inbox is not available yet." />
      </View>
    </View>
  );
}
