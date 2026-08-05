import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, BottomSheet, EmptyState, PressableScale } from '@/components/ui';

import { type AiMessage, useAiAssistant } from './ai-assistant-api';

type Props = { visible: boolean; onClose: () => void; meetingTitle: string };

export function AiAssistantPanel({ visible, onClose, meetingTitle }: Props) {
  const { messages, isThinking, error, sendMessage } = useAiAssistant(meetingTitle);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<AiMessage>>(null);

  const submit = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.68} surfaceColor="#161618" handleColor="rgba(255,255,255,0.2)">
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <AppText variant="headline" color="textInverse">
          AI Assistant
        </AppText>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {messages.length === 0 ? (
          <EmptyState icon="sparkles-outline" title="Ask me anything" subtitle="Quick answers, summaries, or notes during your call." />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <AiBubble message={item} />}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={isThinking ? <ThinkingBubble /> : null}
          />
        )}
        {error && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <AppText variant="caption" color="error">
              {error}
            </AppText>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask the AI assistant"
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
            editable={!isThinking}
            style={{
              flex: 1,
              maxHeight: 100,
              minHeight: 44,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              paddingHorizontal: 14,
              paddingVertical: 10,
              color: '#F5F5F7',
              fontSize: 16,
            }}
          />
          <PressableScale onPress={submit} disabled={!text.trim() || isThinking} accessibilityLabel="Send" haptic="soft">
            <Ionicons name="arrow-up-circle" size={34} color={text.trim() && !isThinking ? '#5B5FFF' : 'rgba(255,255,255,0.3)'} />
          </PressableScale>
        </View>
        <View style={{ height: 8 }} />
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

function AiBubble({ message }: { message: AiMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <View
        style={{
          maxWidth: '82%',
          borderRadius: 16,
          borderBottomRightRadius: isUser ? 4 : 16,
          borderBottomLeftRadius: isUser ? 16 : 4,
          backgroundColor: isUser ? '#5B5FFF' : 'rgba(255,255,255,0.08)',
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}>
        <AppText variant="body" style={{ color: '#F5F5F7' }}>
          {message.content}
        </AppText>
      </View>
    </View>
  );
}

function ThinkingBubble() {
  return (
    <View style={{ alignItems: 'flex-start', marginBottom: 10 }}>
      <View style={{ borderRadius: 16, borderBottomLeftRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 12 }}>
        <AppText variant="body" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Thinking…
        </AppText>
      </View>
    </View>
  );
}
