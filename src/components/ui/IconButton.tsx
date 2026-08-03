import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAppTheme } from '@/design-system/useAppTheme';

import { PressableScale } from './PressableScale';

type Props = {
  name: ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  size?: number;
  variant?: 'glass' | 'filled' | 'plain';
  tone?: 'default' | 'active' | 'danger';
  accessibilityLabel: string;
};

export function IconButton({
  name,
  onPress,
  size = 44,
  variant = 'glass',
  tone = 'default',
  accessibilityLabel,
}: Props) {
  const { colors } = useAppTheme();

  const backgroundColor =
    variant === 'plain'
      ? 'transparent'
      : tone === 'active'
        ? colors.primary
        : tone === 'danger'
          ? colors.error
          : variant === 'filled'
            ? colors.surfaceElevated
            : colors.surfaceGlass;

  const iconColor = tone === 'active' || tone === 'danger' ? colors.textInverse : colors.textPrimary;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={name} size={size * 0.45} color={iconColor} />
    </PressableScale>
  );
}
