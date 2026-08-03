import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '@/design-system/useAppTheme';

type Props = {
  children?: ReactNode;
  glow?: boolean;
};

/**
 * Full-bleed background used on splash/onboarding/auth: brand background
 * color plus two soft, oversized blurred gradient orbs for depth.
 */
export function GradientBackground({ children, glow = true }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      {glow && (
        <>
          <LinearGradient
            colors={['rgba(91,95,255,0.35)', 'rgba(91,95,255,0)']}
            style={[styles.orb, { top: -140, left: -100 }]}
          />
          <LinearGradient
            colors={['rgba(124,92,252,0.28)', 'rgba(124,92,252,0)']}
            style={[styles.orb, { bottom: -160, right: -120 }]}
          />
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  orb: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
  },
});
