import { useState } from 'react';
import { TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';

import { IconButton, PressableScale } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { dark as darkColors } from '@/design-system/tokens/colors';

type Props = {
  onSendText: (text: string) => void;
  onSendImage: (uri: string) => void;
  /** Forces the always-dark meeting-room palette regardless of app theme. */
  forceDark?: boolean;
};

export function ChatInput({ onSendText, onSendImage, forceDark }: Props) {
  const theme = useAppTheme();
  const colors = forceDark ? darkColors : theme.colors;
  const { radii, spacing } = theme;
  const [text, setText] = useState('');

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText('');
  };

  const attachImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      onSendImage(result.assets[0].uri);
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
      }}>
      <IconButton name="image-outline" variant="glass" accessibilityLabel="Attach image" onPress={attachImage} />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Message"
        placeholderTextColor={colors.textTertiary}
        multiline
        maxLength={4000}
        style={{
          flex: 1,
          maxHeight: 100,
          minHeight: 44,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceElevated,
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          color: colors.textPrimary,
          fontSize: 16,
        }}
      />
      <PressableScale onPress={send} disabled={!text.trim()} accessibilityLabel="Send" haptic="soft">
        <Ionicons name="arrow-up-circle" size={34} color={text.trim() ? colors.primary : colors.textTertiary} />
      </PressableScale>
    </View>
  );
}
