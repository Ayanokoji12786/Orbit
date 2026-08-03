import { Platform } from 'react-native';

/**
 * iOS already renders SF Pro as the system font, so we only need to bundle
 * Inter for Android/web where the OS default (Roboto) would look off-brand.
 */
export const fontFamily = Platform.select({
  ios: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  default: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
})!;

type Variant = {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  letterSpacing?: number;
};

export const typography = {
  displayLarge: { fontSize: 34, lineHeight: 41, fontFamily: fontFamily.bold, letterSpacing: -0.4 },
  displayMedium: { fontSize: 28, lineHeight: 34, fontFamily: fontFamily.bold, letterSpacing: -0.3 },
  title: { fontSize: 22, lineHeight: 28, fontFamily: fontFamily.semibold, letterSpacing: -0.2 },
  headline: { fontSize: 17, lineHeight: 22, fontFamily: fontFamily.semibold },
  body: { fontSize: 16, lineHeight: 23, fontFamily: fontFamily.regular },
  bodyMedium: { fontSize: 16, lineHeight: 23, fontFamily: fontFamily.medium },
  callout: { fontSize: 15, lineHeight: 20, fontFamily: fontFamily.regular },
  caption: { fontSize: 13, lineHeight: 17, fontFamily: fontFamily.regular },
  captionMedium: { fontSize: 13, lineHeight: 17, fontFamily: fontFamily.medium },
  micro: { fontSize: 11, lineHeight: 14, fontFamily: fontFamily.medium, letterSpacing: 0.2 },
} satisfies Record<string, Variant>;

export type TypographyVariant = keyof typeof typography;
