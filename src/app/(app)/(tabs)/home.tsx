import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, IconButton, PressableScale, SectionHeader } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { AiSummaryCard } from '@/features/home/AiSummaryCard';
import { FavoriteContactsRow } from '@/features/home/FavoriteContactsRow';
import {
  mockContacts,
  mockRecentMeetings,
  mockRecordingSummary,
  mockUpcomingMeeting,
} from '@/features/home/mock-data';
import { QuickActions } from '@/features/home/QuickActions';
import { UpcomingMeetingCard } from '@/features/home/UpcomingMeetingCard';
import { MeetingRow } from '@/features/meetings/components/MeetingRow';
import { useAuthStore } from '@/stores/auth-store';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const email = useAuthStore((s) => s.email);
  const displayName = email ? email.split('@')[0] : 'there';

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + 140,
        gap: spacing.xl,
      }}
      showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <AppText variant="caption" color="textSecondary">
            {greeting()}
          </AppText>
          <AppText variant="displayMedium" style={{ textTransform: 'capitalize' }}>
            {displayName}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <IconButton
            name="notifications-outline"
            accessibilityLabel="Notifications"
            onPress={() => router.push('/notifications')}
          />
          <PressableScale onPress={() => router.push('/profile')} haptic="soft" accessibilityLabel="Profile">
            <Avatar name={displayName} size={44} />
          </PressableScale>
        </View>
      </View>

      <QuickActions
        onInstant={() => router.push('/meetings/new')}
        onJoin={() => router.push('/meetings/join')}
        onSchedule={() => router.push('/meetings/new')}
      />

      <View>
        <SectionHeader title="Upcoming" actionLabel="See all" onAction={() => router.push('/(app)/(tabs)/meetings')} />
        <UpcomingMeetingCard meeting={mockUpcomingMeeting} onJoin={() => router.push(`/meeting/${mockUpcomingMeeting.id}`)} />
      </View>

      <View>
        <SectionHeader title="AI summaries" actionLabel="View all" onAction={() => router.push('/recordings')} />
        <AiSummaryCard summary={mockRecordingSummary} onPress={() => router.push(`/recordings/${mockRecordingSummary.meetingId}`)} />
      </View>

      <View>
        <SectionHeader title="Favorites" actionLabel="See all" onAction={() => router.push('/(app)/(tabs)/contacts')} />
        <FavoriteContactsRow contacts={mockContacts} onPressContact={(c) => router.push(`/contacts/${c.id}`)} />
      </View>

      <View>
        <SectionHeader title="Recent meetings" />
        <View style={{ gap: spacing.sm }}>
          {mockRecentMeetings.map((meeting) => (
            <MeetingRow key={meeting.id} meeting={meeting} onPress={() => router.push(`/meetings/${meeting.id}`)} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
