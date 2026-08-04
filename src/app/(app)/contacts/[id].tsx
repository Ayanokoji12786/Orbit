import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AppText, Avatar, IconButton, SectionHeader } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { mockContacts, mockRecentMeetings } from '@/features/home/mock-data';
import { MeetingRow } from '@/features/meetings/components/MeetingRow';

export default function ContactDetail() {
  const { colors, spacing } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contact = mockContacts.find((c) => c.id === id) ?? mockContacts[0];
  const history = mockRecentMeetings.filter((m) => m.participants.some((p) => p.id === contact.id));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={contact.name} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, alignItems: 'center' }}>
        <Avatar name={contact.name} size={88} status={contact.status} />
        <AppText variant="title" style={{ marginTop: spacing.md }}>
          {contact.name}
        </AppText>
        <AppText variant="caption" color="textSecondary" style={{ textTransform: 'capitalize', marginTop: 2 }}>
          {contact.status}
        </AppText>

        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xl }}>
          <IconButton
            name="videocam"
            variant="filled"
            size={54}
            tone="active"
            accessibilityLabel="Start video call"
            onPress={() => router.push('/meetings/new')}
          />
          <IconButton
            name="chatbubble"
            variant="filled"
            size={54}
            accessibilityLabel="Message"
            onPress={() => router.push(`/chat/${contact.id}`)}
          />
          <IconButton
            name="call"
            variant="filled"
            size={54}
            accessibilityLabel="Audio call"
            onPress={() => {}}
          />
        </View>

        {history.length > 0 && (
          <View style={{ width: '100%', marginTop: spacing.xxl }}>
            <SectionHeader title="Meeting history" />
            <View style={{ gap: spacing.sm }}>
              {history.map((meeting) => (
                <MeetingRow key={meeting.id} meeting={meeting} onPress={() => router.push(`/meetings/${meeting.id}`)} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
