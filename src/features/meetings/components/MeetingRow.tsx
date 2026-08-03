import { View } from 'react-native';

import { AppText, Avatar, PressableScale } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import type { Meeting } from '@/types/domain';
import { formatClockTime, formatRelativeDay } from '@/utils/datetime';

type Props = {
  meeting: Meeting;
  onPress?: () => void;
};

export function MeetingRow({ meeting, onPress }: Props) {
  const { colors, spacing, radii } = useAppTheme();
  const isPast = new Date(meeting.startsAt).getTime() < Date.now();

  return (
    <PressableScale
      onPress={onPress}
      haptic="soft"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceElevated,
      }}>
      <View style={{ flexDirection: 'row' }}>
        {meeting.participants.slice(0, 3).map((p, i) => (
          <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -12 }}>
            <Avatar name={p.name} uri={p.avatarUrl} size={36} />
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {meeting.title}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {isPast ? formatRelativeDay(meeting.startsAt) : formatClockTime(meeting.startsAt)} ·{' '}
          {meeting.durationMinutes}m
        </AppText>
      </View>
    </PressableScale>
  );
}
