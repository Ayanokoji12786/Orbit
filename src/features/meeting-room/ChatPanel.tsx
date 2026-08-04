import { View } from 'react-native';

import { AppText, BottomSheet } from '@/components/ui';
import { ChatThread, meetingThreadId, useChatStore } from '@/features/chat';

type Props = {
  visible: boolean;
  onClose: () => void;
  roomId: string;
};

export function ChatPanel({ visible, onClose, roomId }: Props) {
  const threadId = meetingThreadId(roomId);
  const messages = useChatStore((s) => s.threads[threadId]) ?? [];
  const sendMessage = useChatStore((s) => s.sendMessage);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightPercent={0.68}
      surfaceColor="#161618"
      handleColor="rgba(255,255,255,0.2)">
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <AppText variant="headline" color="textInverse">
          In-call chat
        </AppText>
      </View>
      <ChatThread
        messages={messages}
        showSenderNames
        forceDark
        onSendText={(text) => sendMessage(threadId, { text })}
        onSendImage={(imageUri) => sendMessage(threadId, { imageUri })}
      />
    </BottomSheet>
  );
}
