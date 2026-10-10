import { View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';

export default function Recordings() {
  const { colors } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Recordings" />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState icon="videocam-off-outline" title="No recordings" subtitle="Meeting recording and AI summaries are not available yet." />
      </View>
    </View>
  );
}
