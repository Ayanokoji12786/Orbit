import { View } from 'react-native';

import { AppText, BottomSheet } from '@/components/ui';
import { ChatThread } from '@/features/chat';
import { useMeetingMessages } from '@/features/chat/api';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Undefined until the meeting is resolved; the hook renders an empty thread until then. */
  meetingId: string | undefined;
};

export function ChatPanel({ visible, onClose, meetingId }: Props) {
  const { messages, error, sendText, sendImage } = useMeetingMessages(meetingId);

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
      {error && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <AppText variant="caption" color="error">
            {error}
          </AppText>
        </View>
      )}
      <ChatThread messages={messages} showSenderNames forceDark onSendText={sendText} onSendImage={sendImage} />
    </BottomSheet>
  );
}
