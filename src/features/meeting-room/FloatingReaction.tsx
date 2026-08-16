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
    // `.set()`/`.get()` accessors rather than `.value` — React Compiler (enabled in
    // app.json) treats the assignment form as mutating a captured value.
    scale.set(withSpring(1, { damping: 8 }));
    translateY.set(withTiming(-360, { duration: 2200, easing: Easing.out(Easing.quad) }));
    translateX.set(withRepeat(withTiming(16, { duration: 550, easing: Easing.inOut(Easing.sin) }), 3, true));
    opacity.set(
      withDelay(
        1500,
        withTiming(0, { duration: 600 }, () => {
          // Fire regardless of `finished`: an interrupted animation (backgrounding,
          // reduce-motion, unmount race) would otherwise leave this reaction in the
          // parent's list forever, accumulating invisible mounted views for the call.
          runOnJS(onDone)();
        }),
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }, { translateX: translateX.get() }, { scale: scale.get() }],
    opacity: opacity.get(),
  }));

  return (
    <Animated.View style={[{ position: 'absolute', bottom: 150, left: startX, pointerEvents: 'none' }, style]}>
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
    </Animated.View>
  );
}
