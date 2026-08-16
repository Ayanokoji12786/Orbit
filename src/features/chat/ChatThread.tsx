import { useRef } from 'react';
import { FlatList, View } from 'react-native';

import type { ChatMessage } from '@/types/domain';

import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';

type Props = {
  messages: ChatMessage[];
  onSendText: (text: string) => void;
  onSendImage: (uri: string) => void;
  showSenderNames?: boolean;
  bottomInset?: number;
  /** Forces the always-dark meeting-room palette regardless of app theme. */
  forceDark?: boolean;
};

export function ChatThread({
  messages,
  onSendText,
  onSendImage,
  showSenderNames,
  bottomInset = 0,
  forceDark,
}: Props) {
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Deliberately no KeyboardAvoidingView here: this renders both inside a BottomSheet
  // (which now lifts itself by the real keyboard height) and inside the standalone DM
  // screen (which wraps this in its own correctly-measured KAV). Having one here too
  // double-counted the offset and pushed the input off-screen.
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} showSender={showSenderNames} forceDark={forceDark} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />
      <ChatInput onSendText={onSendText} onSendImage={onSendImage} forceDark={forceDark} />
      <View style={{ height: bottomInset }} />
    </View>
  );
}
