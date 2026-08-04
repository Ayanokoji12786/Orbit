import { ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { AppText, PressableScale } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { mockRecordingSummary } from '@/features/home/mock-data';
import { formatRelativeDay } from '@/utils/datetime';

export default function Recordings() {
  const { colors, spacing, radii } = useAppTheme();
  const recordings = [mockRecordingSummary];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Recordings" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        {recordings.map((rec) => (
          <PressableScale key={rec.meetingId} onPress={() => router.push(`/recordings/${rec.meetingId}`)} haptic="soft">
            <View
              style={{
                padding: spacing.md,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceElevated,
                gap: 6,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <AppText variant="bodyMedium">{rec.meetingTitle}</AppText>
                <Ionicons name="play-circle" size={22} color={colors.primary} />
              </View>
              <AppText variant="caption" color="textSecondary" numberOfLines={2}>
                {rec.highlight}
              </AppText>
              <AppText variant="micro" color="textTertiary">
                {formatRelativeDay(rec.createdAt)}
              </AppText>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}
