import { Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui';

const REACTIONS = ['👍', '❤️', '😂', '👏', '🎉'];

type Props = {
  onSelect: (emoji: string) => void;
};

export function ReactionPicker({ onSelect }: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={{
        flexDirection: 'row',
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
      }}>
      {REACTIONS.map((emoji) => (
        <PressableScale key={emoji} onPress={() => onSelect(emoji)} haptic="light" accessibilityLabel={`React ${emoji}`}>
          <Text style={{ fontSize: 26 }}>{emoji}</Text>
        </PressableScale>
      ))}
    </Animated.View>
  );
}
