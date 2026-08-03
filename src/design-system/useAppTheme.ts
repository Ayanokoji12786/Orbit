import { useColorScheme } from 'react-native';

import { useThemeStore } from '@/stores/theme-store';

import { dark, gradients, light } from './tokens/colors';
import { radii, spacing } from './tokens/spacing';
import { duration, spring } from './tokens/motion';
import { typography } from './tokens/typography';

export function useAppTheme() {
  const systemScheme = useColorScheme();
  const mode = useThemeStore((s) => s.mode);

  const isDark = mode === 'system' ? systemScheme !== 'light' : mode === 'dark';
  const colors = isDark ? dark : light;

  return {
    isDark,
    colors,
    gradients,
    spacing,
    radii,
    typography,
    duration,
    spring,
  };
}
