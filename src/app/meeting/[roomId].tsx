import { useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { mockContacts } from '@/features/home/mock-data';
import { useAuthStore } from '@/stores/auth-store';

export default function MeetingRoom() {
  const { spacing, radii } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const email = useAuthStore((s) => s.email);
  const selfName = email ? email.split('@')[0] : 'You';

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(true);

  const tiles = [{ id: 'self', name: selfName }, ...mockContacts.slice(0, 3)];

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View
        style={{
          position: 'absolute',
          top: insets.top + spacing.sm,
          left: spacing.lg,
          right: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4D6D' }} />
          <AppText variant="captionMedium" color="textInverse">
            {roomId}
          </AppText>
        </View>
        <IconButton name="people-outline" variant="glass" accessibilityLabel="Participants" onPress={() => {}} />
      </View>

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingTop: insets.top + 64,
          paddingHorizontal: spacing.sm,
          paddingBottom: 160,
          gap: spacing.sm,
        }}>
        {tiles.map((tile) => (
          <View
            key={tile.id}
            style={{
              width: '48%',
              aspectRatio: 3 / 4,
              borderRadius: radii.lg,
              backgroundColor: '#161618',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
            <Avatar name={tile.name} size={64} />
            <AppText variant="caption" color="textInverse" style={{ marginTop: spacing.sm }}>
              {tile.name}
            </AppText>
          </View>
        ))}
      </View>

      <View
        style={{
          position: 'absolute',
          bottom: 40,
          left: spacing.lg,
          right: spacing.lg,
          padding: spacing.md,
          borderRadius: radii.xl,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          flexDirection: 'row',
          justifyContent: 'space-around',
        }}>
        <IconButton
          name={muted ? 'mic-off' : 'mic'}
          variant="filled"
          tone={muted ? 'danger' : 'default'}
          accessibilityLabel={muted ? 'Unmute' : 'Mute'}
          onPress={() => setMuted((m) => !m)}
        />
        <IconButton
          name={cameraOff ? 'videocam-off' : 'videocam'}
          variant="filled"
          tone={cameraOff ? 'danger' : 'default'}
          accessibilityLabel={cameraOff ? 'Turn camera on' : 'Turn camera off'}
          onPress={() => setCameraOff((c) => !c)}
        />
        <IconButton name="hand-left-outline" variant="filled" accessibilityLabel="Raise hand" onPress={() => {}} />
        <IconButton name="chatbubble-outline" variant="filled" accessibilityLabel="Chat" onPress={() => {}} />
        <IconButton
          name="call"
          variant="filled"
          tone="danger"
          accessibilityLabel="Leave meeting"
          onPress={() => router.back()}
        />
      </View>

      <View
        style={{
          position: 'absolute',
          bottom: 40 + 76,
          left: spacing.lg,
          right: spacing.lg,
          alignItems: 'center',
        }}>
        <AppText variant="micro" color="textTertiary">
          Live video needs a connected LiveKit project — this is the Phase 1 interface preview.
        </AppText>
      </View>
    </View>
  );
}
