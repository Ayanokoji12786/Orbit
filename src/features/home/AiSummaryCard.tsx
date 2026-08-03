import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, GlassCard, PressableScale } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import type { RecordingSummary } from '@/types/domain';
import { formatRelativeDay } from '@/utils/datetime';

type Props = {
  summary: RecordingSummary;
  onPress: () => void;
};

export function AiSummaryCard({ summary, onPress }: Props) {
  const { colors, spacing } = useAppTheme();

  return (
    <PressableScale onPress={onPress} haptic="soft">
      <GlassCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="sparkles" size={14} color={colors.primary} />
          </View>
          <AppText variant="captionMedium" color="primary">
            AI SUMMARY · {summary.meetingTitle.toUpperCase()}
          </AppText>
        </View>
        <AppText variant="body" style={{ marginTop: spacing.sm }} numberOfLines={3}>
          {summary.highlight}
        </AppText>
        <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.sm }}>
          {formatRelativeDay(summary.createdAt)} · Tap to view full recording
        </AppText>
      </GlassCard>
    </PressableScale>
  );
}
