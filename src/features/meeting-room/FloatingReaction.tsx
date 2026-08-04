import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  emoji: string;
  startX: number;
  onDone: () => void;
};

export function FloatingReaction({ emoji, startX, onDone }: Props) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.4);

  // Runs once: each instance is a short-lived, uniquely-keyed reaction that
  // plays its animation exactly once and then unmounts via onDone.
  useEffect(() => {
    scale.value = withSpring(1, { damping: 8 });
    translateY.value = withTiming(-360, { duration: 2200, easing: Easing.out(Easing.quad) });
    translateX.value = withRepeat(withTiming(16, { duration: 550, easing: Easing.inOut(Easing.sin) }), 3, true);
    opacity.value = withDelay(
      1500,
      withTiming(0, { duration: 600 }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { translateX: translateX.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', bottom: 150, left: startX, pointerEvents: 'none' }, style]}>
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
    </Animated.View>
  );
}
