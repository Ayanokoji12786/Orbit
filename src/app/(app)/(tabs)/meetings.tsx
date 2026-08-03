import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, IconButton, PressableScale } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { mockRecentMeetings, mockUpcomingMeeting } from '@/features/home/mock-data';
import { MeetingRow } from '@/features/meetings/components/MeetingRow';

type Segment = 'upcoming' | 'past';

export default function Meetings() {
  const { colors, spacing, radii } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('upcoming');

  const upcoming = [mockUpcomingMeeting];
  const past = mockRecentMeetings;
  const list = segment === 'upcoming' ? upcoming : past;

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + 140,
      }}
      showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="displayMedium">Meetings</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <IconButton name="qr-code-outline" accessibilityLabel="Scan QR code" onPress={() => router.push('/meetings/join')} />
          <IconButton name="add" tone="active" accessibilityLabel="New meeting" onPress={() => router.push('/meetings/new')} />
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surfaceElevated,
          borderRadius: radii.md,
          padding: 4,
          marginTop: spacing.lg,
        }}>
        <SegmentButton label="Upcoming" active={segment === 'upcoming'} onPress={() => setSegment('upcoming')} />
        <SegmentButton label="Past" active={segment === 'past'} onPress={() => setSegment('past')} />
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        {list.map((meeting) => (
          <MeetingRow key={meeting.id} meeting={meeting} onPress={() => router.push(`/meetings/${meeting.id}`)} />
        ))}
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <Button label="Join with a code" variant="secondary" onPress={() => router.push('/meetings/join')} />
      </View>
    </ScrollView>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors, radii } = useAppTheme();

  return (
    <PressableScale
      onPress={onPress}
      haptic="soft"
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: radii.sm,
        backgroundColor: active ? colors.surface : 'transparent',
        alignItems: 'center',
      }}>
      <AppText variant="bodyMedium" color={active ? 'textPrimary' : 'textSecondary'}>
        {label}
      </AppText>
    </PressableScale>
  );
}
