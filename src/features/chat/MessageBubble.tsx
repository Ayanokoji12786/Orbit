import { View } from 'react-native';
import { Image } from 'expo-image';

import { AppText } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { dark as darkColors } from '@/design-system/tokens/colors';
import type { ChatMessage } from '@/types/domain';

type Props = {
  message: ChatMessage;
  showSender?: boolean;
  /** Forces the always-dark meeting-room palette regardless of app theme. */
  forceDark?: boolean;
};

export function MessageBubble({ message, showSender, forceDark }: Props) {
  const theme = useAppTheme();
  const colors = forceDark ? darkColors : theme.colors;
  const { radii, spacing } = theme;
  const isOwn = message.senderId === 'me';
  const time = new Date(message.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={{ alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom: spacing.sm }}>
      {showSender && !isOwn && (
        <AppText variant="micro" style={{ marginBottom: 2, marginLeft: 4, color: colors.textTertiary }}>
          {message.senderName}
        </AppText>
      )}
      <View
        style={{
          maxWidth: '78%',
          borderRadius: radii.md,
          borderBottomRightRadius: isOwn ? 4 : radii.md,
          borderBottomLeftRadius: isOwn ? radii.md : 4,
          backgroundColor: isOwn ? colors.primary : colors.surfaceElevated,
          overflow: 'hidden',
        }}>
        {message.imageUri && (
          <Image source={{ uri: message.imageUri }} style={{ width: 220, height: 220 }} contentFit="cover" />
        )}
        {message.text && (
          <AppText
            variant="body"
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: 10,
              color: isOwn ? colors.textInverse : colors.textPrimary,
            }}>
            {message.text}
          </AppText>
        )}
      </View>
      <AppText variant="micro" style={{ marginTop: 2, marginHorizontal: 4, color: colors.textTertiary }}>
        {time}
      </AppText>
    </View>
  );
}
