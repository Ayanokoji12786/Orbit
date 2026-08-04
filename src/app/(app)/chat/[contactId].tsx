import { useEffect } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { ChatThread, dmThreadId, useChatStore } from '@/features/chat';
import { seedDmMessages } from '@/features/chat/mock-data';
import { mockContacts } from '@/features/home/mock-data';

export default function DmChat() {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const contact = mockContacts.find((c) => c.id === contactId) ?? mockContacts[0];
  const threadId = dmThreadId(contact.id);

  const messages = useChatStore((s) => s.threads[threadId]) ?? [];
  const seedThread = useChatStore((s) => s.seedThread);
  const sendMessage = useChatStore((s) => s.sendMessage);

  useEffect(() => {
    seedThread(threadId, seedDmMessages[contact.id] ?? []);
  }, [threadId, contact.id, seedThread]);

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
        <Avatar name={contact.name} size={36} status={contact.status} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyMedium">{contact.name}</AppText>
          <AppText variant="micro" color="textTertiary" style={{ textTransform: 'capitalize' }}>
            {contact.status}
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
        onSendText={(text) => sendMessage(threadId, { text })}
        onSendImage={(imageUri) => sendMessage(threadId, { imageUri })}
      />
    </View>
  );
}
