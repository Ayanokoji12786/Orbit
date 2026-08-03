import { ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';

import { AppText, GlassCard } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { mockRecordingSummary } from '@/features/home/mock-data';

export default function RecordingDetail() {
  const { colors, spacing, radii } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const summary = mockRecordingSummary.meetingId === id ? mockRecordingSummary : mockRecordingSummary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={summary.meetingTitle} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <View
          style={{
            height: 180,
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceElevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="play-circle" size={56} color={colors.primary} />
          <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.sm }}>
            Playback needs Egress recording from Phase 2
          </AppText>
        </View>

        <GlassCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <AppText variant="captionMedium" color="primary">
              AI SUMMARY
            </AppText>
          </View>
          <AppText variant="body" style={{ marginTop: spacing.sm }}>
            {summary.highlight}
          </AppText>
        </GlassCard>

        <View>
          <AppText variant="headline">Action items</AppText>
          <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.xs }}>
            Extracted action items appear here once the AI pipeline (Phase 4) is connected.
          </AppText>
        </View>

        <View>
          <AppText variant="headline">Ask this recording</AppText>
          <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.xs }}>
            "What was decided about the budget?" — natural-language search over transcripts ships in Phase 4.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}
