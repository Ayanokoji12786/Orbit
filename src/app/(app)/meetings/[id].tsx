import { ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';

import { AppText, Avatar, Button, Chip } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { mockRecentMeetings, mockUpcomingMeeting } from '@/features/home/mock-data';
import { formatClockTime, formatCountdown } from '@/utils/datetime';

export default function MeetingDetail() {
  const { colors, spacing, radii } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const meeting =
    [mockUpcomingMeeting, ...mockRecentMeetings].find((m) => m.id === id) ?? mockUpcomingMeeting;
  const isUpcoming = new Date(meeting.startsAt).getTime() > Date.now();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Meeting Details" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        <View>
          <Chip label={isUpcoming ? formatCountdown(meeting.startsAt) : 'Completed'} tone={isUpcoming ? 'primary' : 'neutral'} />
          <AppText variant="displayMedium" style={{ marginTop: spacing.sm }}>
            {meeting.title}
          </AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: 2 }}>
            {formatClockTime(meeting.startsAt)} · {meeting.durationMinutes} min
          </AppText>
        </View>

        <View>
          <AppText variant="headline">Participants</AppText>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {meeting.participants.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Avatar name={p.name} uri={p.avatarUrl} size={36} />
                <AppText variant="body">{p.name}</AppText>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name={meeting.hasPassword ? 'lock-closed' : 'lock-open-outline'} size={16} color={colors.textTertiary} />
          <AppText variant="caption" color="textTertiary">
            {meeting.hasPassword ? 'Password protected' : 'No password required'}
          </AppText>
        </View>

        {isUpcoming ? (
          <Button label="Join meeting" onPress={() => router.push(`/meeting/${meeting.id}`)} />
        ) : (
          <Button label="View recording" variant="secondary" onPress={() => router.push(`/recordings/${meeting.id}`)} />
        )}
      </ScrollView>
    </View>
  );
}
