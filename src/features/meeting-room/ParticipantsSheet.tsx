import { ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, Avatar, BottomSheet } from '@/components/ui';

type Participant = { id: string; name: string; muted?: boolean };

type Props = {
  visible: boolean;
  onClose: () => void;
  participants: Participant[];
};

export function ParticipantsSheet({ visible, onClose, participants }: Props) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightPercent={0.5}
      surfaceColor="#161618"
      handleColor="rgba(255,255,255,0.2)">
      <AppText variant="headline" color="textInverse" style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        Participants ({participants.length})
      </AppText>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 4 }}>
        {participants.map((p) => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <Avatar name={p.name} size={38} />
            <AppText variant="body" color="textInverse" style={{ flex: 1 }}>
              {p.name}
            </AppText>
            {p.muted && <Ionicons name="mic-off" size={16} color="rgba(255,255,255,0.5)" />}
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
