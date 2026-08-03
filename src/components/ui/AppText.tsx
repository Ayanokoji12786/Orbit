import { Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/design-system/useAppTheme';
import type { TypographyVariant } from '@/design-system/tokens/typography';
import type { ThemeColors } from '@/design-system/tokens/colors';

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: keyof ThemeColors;
};

export function AppText({ variant = 'body', color = 'textPrimary', style, ...rest }: Props) {
  const { typography, colors } = useAppTheme();

  return (
    <Text
      style={[
        typography[variant],
        { color: colors[color] as string },
        style,
      ]}
      {...rest}
    />
  );
}
