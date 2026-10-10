import { View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { useAppTheme } from '@/design-system/useAppTheme';

export default function RecordingDetail() {
  const { colors } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Recording" />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState icon="videocam-off-outline" title="Recording unavailable" subtitle="No recording or transcript exists for this meeting." />
      </View>
    </View>
  );
}
