import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';

import { useAppTheme } from '@/design-system/useAppTheme';

import { AppText } from './AppText';
import { Button } from './Button';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  const { colors, spacing, radii } = useAppTheme();

  return (
    <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.md }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radii.xl,
          backgroundColor: colors.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {subtitle && (
        <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          {subtitle}
        </AppText>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} variant="secondary" fullWidth={false} style={{ paddingHorizontal: spacing.xl, marginTop: spacing.sm }} />
      )}
    </View>
  );
}
