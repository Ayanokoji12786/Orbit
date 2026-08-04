import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, BottomSheet, PressableScale } from '@/components/ui';

type Action = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  actions: Action[];
};

export function MoreSheet({ visible, onClose, actions }: Props) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightPercent={0.4}
      surfaceColor="#161618"
      handleColor="rgba(255,255,255,0.2)">
      <View style={{ paddingHorizontal: 8 }}>
        {actions.map((action) => (
          <PressableScale key={action.label} onPress={action.onPress} haptic="soft">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, paddingVertical: 14 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={action.icon} size={18} color="#F5F5F7" />
              </View>
              <AppText variant="body" color="textInverse">
                {action.label}
              </AppText>
            </View>
          </PressableScale>
        ))}
      </View>
    </BottomSheet>
  );
}
