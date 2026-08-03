import { View } from 'react-native';

import { useAppTheme } from '@/design-system/useAppTheme';

export function Divider() {
  const { colors } = useAppTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}
