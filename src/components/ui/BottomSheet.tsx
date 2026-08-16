import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
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

/** Tracks the on-screen keyboard height, using the `Will` events on iOS so the sheet moves with the system animation. */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

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
  const keyboardHeight = useKeyboardHeight();

  if (!visible) return null;

  // The sheet is absolutely positioned and bottom-anchored, which is exactly the layout
  // KeyboardAvoidingView measures wrong (it works off a parent-relative frame, so inside
  // a sheet it under-pads and leaves inputs behind the keyboard). Lifting the sheet by the
  // real keyboard height here fixes every sheet at once — chat, AI assistant, poll create.
  const availableHeight = screenHeight - keyboardHeight - insets.top;
  const sheetHeight = Math.min(screenHeight * heightPercent, availableHeight);

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
          bottom: keyboardHeight,
          height: sheetHeight,
          backgroundColor: surfaceColor ?? colors.surfaceElevated,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          // The home indicator is behind the keyboard while it's up, so that inset
          // would just add dead space.
          paddingBottom: keyboardHeight > 0 ? 0 : insets.bottom,
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
