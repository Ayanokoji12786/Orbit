import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AppText, Avatar, IconButton } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';
import { useContacts } from '@/features/contacts/api';

export default function ContactDetail() {
  const { colors, spacing } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { contacts, loading } = useContacts();
  const contact = contacts.find((c) => c.id === id);

  if (loading && !contact) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Contact" />
        <AppText variant="body" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.xxl }}>
          Contact not found.
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={contact.name} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, alignItems: 'center' }}>
        <Avatar name={contact.name} uri={contact.avatarUrl} size={88} status={contact.status} />
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
          <IconButton name="call" variant="filled" size={54} accessibilityLabel="Audio call" onPress={() => {}} />
        </View>
      </ScrollView>
    </View>
  );
}
