import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { ChatThread } from '@/features/chat';
import { useDmMessages } from '@/features/chat/api';
import { useContacts } from '@/features/contacts/api';

export default function DmChat() {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const { contacts } = useContacts();
  const contact = contacts.find((c) => c.id === contactId);

  const { messages, sendText, sendImage } = useDmMessages(contactId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => router.back()} />
        <Avatar name={contact?.name ?? 'Orbit User'} uri={contact?.avatarUrl} size={36} status={contact?.status ?? 'offline'} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyMedium">{contact?.name ?? 'Loading…'}</AppText>
          <AppText variant="micro" color="textTertiary" style={{ textTransform: 'capitalize' }}>
            {contact?.status ?? ''}
          </AppText>
        </View>
        <IconButton
          name="videocam"
          variant="glass"
          accessibilityLabel="Start video call"
          onPress={() => router.push('/meetings/new')}
        />
      </View>

      <ChatThread
        messages={messages}
        showSenderNames={false}
        bottomInset={insets.bottom}
        onSendText={sendText}
        onSendImage={sendImage}
      />
    </View>
  );
}
