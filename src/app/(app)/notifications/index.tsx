import { ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { formatRelativeDay } from '@/utils/datetime';

type NotificationItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  createdAt: string;
};

const items: NotificationItem[] = [
  {
    id: '1',
    icon: 'sparkles',
    title: 'AI summary ready',
    subtitle: 'Weekly Sync summary and action items are ready to view.',
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    icon: 'time',
    title: 'Meeting starting soon',
    subtitle: 'Design Review — Orbit v1 starts in 45 minutes.',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    icon: 'person-add',
    title: 'New contact request',
    subtitle: 'Noah Kim wants to connect on Orbit.',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function Notifications() {
  const { colors, spacing, radii } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        {items.map((item) => (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceElevated,
            }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={item.icon} size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium">{item.title}</AppText>
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                {item.subtitle}
              </AppText>
              <AppText variant="micro" color="textTertiary" style={{ marginTop: 4 }}>
                {formatRelativeDay(item.createdAt)}
              </AppText>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
