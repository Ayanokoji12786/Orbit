import { View } from 'react-native';

import { useAppTheme } from '@/design-system/useAppTheme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: Props) {
  const { spacing } = useAppTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
      }}>
      <AppText variant="headline">{title}</AppText>
      {actionLabel && onAction && (
        <PressableScale onPress={onAction} haptic="none">
          <AppText variant="captionMedium" color="primary">
            {actionLabel}
          </AppText>
        </PressableScale>
      )}
    </View>
  );
}
