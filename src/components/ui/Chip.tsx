import { View } from 'react-native';

import { useAppTheme } from '@/design-system/useAppTheme';
import type { ThemeColors } from '@/design-system/tokens/colors';

import { AppText } from './AppText';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'error';

type Props = {
  label: string;
  tone?: Tone;
};

const toneMap: Record<Tone, { bg: keyof ThemeColors; fg: keyof ThemeColors }> = {
  neutral: { bg: 'surfaceElevated', fg: 'textSecondary' },
  primary: { bg: 'primaryMuted', fg: 'primary' },
  success: { bg: 'successMuted', fg: 'success' },
  warning: { bg: 'warningMuted', fg: 'warning' },
  error: { bg: 'errorMuted', fg: 'error' },
};

export function Chip({ label, tone = 'neutral' }: Props) {
  const { colors, radii } = useAppTheme();
  const { bg, fg } = toneMap[tone];

  return (
    <View
      style={{
        backgroundColor: colors[bg] as string,
        borderRadius: radii.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}>
      <AppText variant="captionMedium" color={fg}>
        {label}
      </AppText>
    </View>
  );
}
