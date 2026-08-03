import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '@/design-system/useAppTheme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  fullWidth = true,
  icon,
  style,
}: Props) {
  const { colors, radii, spacing } = useAppTheme();
  const height = size === 'lg' ? 56 : 46;
  const isDisabled = disabled || loading;

  const content = (
    <View style={styles.contentRow}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.textInverse : colors.textPrimary} />
      ) : (
        <>
          {icon}
          <AppText
            variant="headline"
            color={variant === 'primary' ? 'textInverse' : variant === 'destructive' ? 'error' : 'textPrimary'}>
            {label}
          </AppText>
        </>
      )}
    </View>
  );

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      height,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      width: fullWidth ? '100%' : undefined,
    },
    style,
  ];

  if (variant === 'primary') {
    return (
      <PressableScale onPress={onPress} disabled={isDisabled} style={containerStyle}>
        <LinearGradient
          colors={['#5B5FFF', '#7C5CFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radii.md }]}
        />
        {content}
      </PressableScale>
    );
  }

  const variantStyle: StyleProp<ViewStyle> =
    variant === 'secondary'
      ? { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border }
      : variant === 'destructive'
        ? { backgroundColor: colors.errorMuted }
        : { backgroundColor: 'transparent' };

  return (
    <PressableScale onPress={onPress} disabled={isDisabled} style={[containerStyle, variantStyle]}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
