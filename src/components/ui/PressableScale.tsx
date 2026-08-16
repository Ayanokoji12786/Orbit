import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Pressable } from 'react-native-gesture-handler';

import { duration } from '@/design-system/tokens/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'soft' | 'none';
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: 'button' | 'link' | 'none';
  accessibilityLabel?: string;
};

export function PressableScale({
  children,
  onPress,
  disabled,
  scaleTo = 0.96,
  haptic = 'light',
  style,
  accessibilityRole = 'button',
  accessibilityLabel,
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const triggerHaptic = () => {
    if (haptic === 'none') return;
    const map = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      soft: Haptics.ImpactFeedbackStyle.Soft,
    } as const;
    Haptics.impactAsync(map[haptic]);
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        // `.set()` rather than `.value =` — React Compiler (enabled in app.json) treats
        // the assignment as mutating a captured value and bails out of optimizing this
        // component, which is the most heavily used one in the app.
        scale.set(withTiming(scaleTo, { duration: duration.fast }));
      }}
      onPressOut={() => {
        scale.set(withTiming(1, { duration: duration.fast }));
      }}
      onPress={() => {
        triggerHaptic();
        onPress?.();
      }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[{ opacity: disabled ? 0.5 : 1 }, style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}
