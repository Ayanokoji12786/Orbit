import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';

import { EmptyState } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';

import { ScreenHeader } from './ScreenHeader';

type Props = {
  title: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  subtitle: string;
};

/** Placeholder for routes whose full functionality lands in a later phase. */
export function StubScreen({ title, icon, subtitle }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={title} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState icon={icon} title={title} subtitle={subtitle} />
      </View>
    </View>
  );
}
