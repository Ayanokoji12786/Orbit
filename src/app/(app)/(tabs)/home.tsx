import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, IconButton, PressableScale, SectionHeader } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { useContacts } from '@/features/contacts/api';
import { FavoriteContactsRow } from '@/features/home/FavoriteContactsRow';
import { QuickActions } from '@/features/home/QuickActions';
import { UpcomingMeetingCard } from '@/features/home/UpcomingMeetingCard';
import { MeetingRow } from '@/features/meetings/components/MeetingRow';
import { usePastMeetings, useUpcomingMeetings } from '@/features/meetings/api';
import { useProfile } from '@/features/profile/api';
import { useNow } from '@/hooks/use-now';
import { useAuthStore } from '@/stores/auth-store';

function greeting(now: number): string {
  const hour = new Date(now).getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const email = useAuthStore((s) => s.email);
  const { profile } = useProfile();
  const displayName = profile?.displayName || (email ? email.split('@')[0] : 'there');
  const upcoming = useUpcomingMeetings();
  const recent = usePastMeetings().filter((meeting) => !meeting.cancelledAt).slice(0, 3);
  const nextMeeting = upcoming.find((meeting) => !meeting.cancelledAt && !meeting.endedAt);
  const { contacts } = useContacts();
  const favorites = contacts.filter((c) => c.isFavorite);

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
            {greeting(now)}
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
            <Avatar name={displayName} uri={profile?.avatarUrl} size={44} />
          </PressableScale>
        </View>
      </View>

      <QuickActions
        onInstant={() => router.push('/meetings/new')}
        onJoin={() => router.push('/meetings/join')}
        onSchedule={() => router.push('/meetings/new')}
      />

      {nextMeeting && (
        <View>
          <SectionHeader title="Upcoming" actionLabel="See all" onAction={() => router.push('/(app)/(tabs)/meetings')} />
          <UpcomingMeetingCard meeting={nextMeeting} onJoin={() => router.push(`/meeting/${nextMeeting.roomCode}`)} />
        </View>
      )}

      {favorites.length > 0 && (
        <View>
          <SectionHeader title="Favorites" actionLabel="See all" onAction={() => router.push('/(app)/(tabs)/contacts')} />
          <FavoriteContactsRow contacts={favorites} onPressContact={(c) => router.push(`/contacts/${c.id}`)} />
        </View>
      )}

      <View>
        <SectionHeader title="Recent meetings" />
        <View style={{ gap: spacing.sm }}>
          {recent.map((meeting) => (
            <MeetingRow key={meeting.id} meeting={meeting} onPress={() => router.push(`/meetings/${meeting.id}`)} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
