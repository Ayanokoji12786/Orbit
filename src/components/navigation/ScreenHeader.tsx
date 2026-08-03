import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';

type Props = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function ScreenHeader({ title, onBack, right }: Props) {
  const { spacing } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
      <IconButton
        name="chevron-back"
        accessibilityLabel="Back"
        onPress={onBack ?? (() => router.back())}
      />
      <AppText variant="headline">{title}</AppText>
      {right ?? <View style={{ width: 44 }} />}
    </View>
  );
}
