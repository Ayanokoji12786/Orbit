import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, Avatar, Button, GlassCard } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import type { Meeting } from '@/types/domain';
import { formatClockTime, formatCountdown } from '@/utils/datetime';

type Props = {
  meeting: Meeting;
  onJoin: () => void;
};

export function UpcomingMeetingCard({ meeting, onJoin }: Props) {
  const { colors, spacing } = useAppTheme();

  return (
    <GlassCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="time-outline" size={14} color={colors.primary} />
          <AppText variant="captionMedium" color="primary">
            {formatCountdown(meeting.startsAt)}
          </AppText>
        </View>
        <AppText variant="caption" color="textTertiary">
          {formatClockTime(meeting.startsAt)}
        </AppText>
      </View>

      <AppText variant="title" style={{ marginTop: spacing.sm }}>
        {meeting.title}
      </AppText>

      {meeting.participants.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row' }}>
            {meeting.participants.slice(0, 4).map((p, i) => (
              <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                <Avatar name={p.name} uri={p.avatarUrl} size={30} />
              </View>
            ))}
          </View>
          <AppText variant="caption" color="textSecondary">
            {meeting.participants.length} joining
          </AppText>
        </View>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <Button label="Join meeting" onPress={onJoin} />
      </View>
    </GlassCard>
  );
}
