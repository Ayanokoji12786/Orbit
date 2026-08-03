import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { useAppTheme } from '@/design-system/useAppTheme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  intensity?: number;
};

export function GlassCard({ children, style, padding, intensity = 40 }: Props) {
  const { colors, radii, spacing, isDark } = useAppTheme();

  return (
    <View style={[styles.wrapper, { borderRadius: radii.lg, borderColor: colors.border }, style]}>
      <BlurView
        intensity={intensity}
        tint={isDark ? 'dark' : 'light'}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.surfaceGlass, borderRadius: radii.lg },
        ]}
      />
      <View style={{ padding: padding ?? spacing.base }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
