export const palette = {
  primary: '#5B5FFF',
  accent: '#7C5CFC',
  success: '#20C997',
  warning: '#F59F00',
  error: '#FF4D6D',
} as const;

export const dark = {
  ...palette,
  background: '#09090B',
  backgroundElevated: '#0F0F12',
  surface: '#111114',
  surfaceElevated: '#18181C',
  surfaceGlass: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  textPrimary: '#F5F5F7',
  textSecondary: '#A1A1AA',
  textTertiary: '#6B6B72',
  textInverse: '#09090B',
  primaryMuted: 'rgba(91,95,255,0.16)',
  successMuted: 'rgba(32,201,151,0.16)',
  warningMuted: 'rgba(245,159,0,0.16)',
  errorMuted: 'rgba(255,77,109,0.16)',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: 'rgba(0,0,0,0.5)',
} as const;

export const light = {
  ...palette,
  background: '#FFFFFF',
  backgroundElevated: '#F7F7F9',
  surface: '#F2F2F5',
  surfaceElevated: '#FFFFFF',
  surfaceGlass: 'rgba(255,255,255,0.6)',
  border: 'rgba(9,9,11,0.08)',
  borderStrong: 'rgba(9,9,11,0.14)',
  textPrimary: '#09090B',
  textSecondary: '#52525B',
  textTertiary: '#8A8A93',
  textInverse: '#FFFFFF',
  primaryMuted: 'rgba(91,95,255,0.10)',
  successMuted: 'rgba(32,201,151,0.12)',
  warningMuted: 'rgba(245,159,0,0.12)',
  errorMuted: 'rgba(255,77,109,0.12)',
  overlay: 'rgba(0,0,0,0.35)',
  shadow: 'rgba(9,9,11,0.16)',
} as const;

export const gradients = {
  brand: [palette.primary, palette.accent] as const,
  brandSubtle: ['rgba(91,95,255,0.24)', 'rgba(124,92,252,0.06)'] as const,
  success: [palette.success, '#0CA678'] as const,
};

export type ThemeColors = typeof dark;
