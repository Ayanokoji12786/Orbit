import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/design-system/useAppTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  heightPercent?: number;
  surfaceColor?: string;
  handleColor?: string;
};

export function BottomSheet({
  visible,
  onClose,
  children,
  heightPercent = 0.62,
  surfaceColor,
  handleColor,
}: Props) {
  const { colors, radii } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().damping(22).stiffness(220)}
        exiting={SlideOutDown}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: screenHeight * heightPercent,
          backgroundColor: surfaceColor ?? colors.surfaceElevated,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          paddingBottom: insets.bottom,
          overflow: 'hidden',
        }}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: handleColor ?? colors.border }} />
        </View>
        {children}
      </Animated.View>
    </View>
  );
}
