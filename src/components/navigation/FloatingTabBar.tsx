import { forwardRef } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/design-system/useAppTheme';

/**
 * Rendered via `<TabList asChild><FloatingTabBar>...</FloatingTabBar></TabList>` —
 * expo-router/ui's `Tabs` only discovers a `TabList` that's its direct child, so this
 * needs `asChild`'s Slot to dissolve into `TabList`'s place while forwarding its props.
 */
export const FloatingTabBar = forwardRef<View, ViewProps>(function FloatingTabBar(
  { children, style, ...rest },
  ref,
) {
  const { colors, radii, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 12, pointerEvents: 'box-none' }]}>
      <View ref={ref} style={[styles.bar, { borderRadius: radii.xl, borderColor: colors.border }, style]} {...rest}>
        <BlurView
          intensity={50}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceGlass, borderRadius: radii.xl }]}
        />
        {children}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
    width: '100%',
  },
});
