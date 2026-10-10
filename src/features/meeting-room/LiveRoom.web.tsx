// @livekit/react-native has no web implementation. Keep this a visual preview:
// fetching a native token here would falsely register the browser as a joined
// participant even though it has no media connection.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { ControlBar } from './ControlBar';
import { MoreSheet } from './MoreSheet';
import { ParticipantsSheet } from './ParticipantsSheet';
import { WhiteboardOverlay } from './WhiteboardOverlay';

type Panel = 'whiteboard' | 'participants' | 'more' | null;

type Props = {
  roomCode: string;
  password?: string;
};

export function LiveRoom({ roomCode }: Props) {
  const { spacing, radii } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [panel, setPanel] = useState<Panel>(null);

  const tiles = [{ id: 'self', name: 'You' }];

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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(0,0,0,0.4)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
          }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4D6D' }} />
          <AppText variant="captionMedium" color="textInverse">
            {roomCode}
          </AppText>
        </View>
        <IconButton name="people-outline" variant="glass" accessibilityLabel="Participants" onPress={() => setPanel('participants')} />
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

      <View style={{ position: 'absolute', bottom: 40, left: spacing.lg, right: spacing.lg }}>
        <ControlBar
          muted
          cameraOff
          onMore={() => setPanel('more')}
          onLeave={() => router.back()}
          previewOnly
        />
      </View>

      <View style={{ position: 'absolute', bottom: 40 + 76, left: spacing.lg, right: spacing.lg, alignItems: 'center' }} pointerEvents="none">
        <AppText variant="micro" color="textTertiary">
          Web preview only — real video calling runs on iOS/Android.
        </AppText>
      </View>

      <MoreSheet
        visible={panel === 'more'}
        onClose={() => setPanel(null)}
        actions={[
          { icon: 'chatbubble-outline', label: 'Chat (native only)', disabled: true },
          { icon: 'brush-outline', label: 'Whiteboard (local preview)', onPress: () => setPanel('whiteboard') },
          { icon: 'stats-chart-outline', label: 'Polls (native only)', disabled: true },
          { icon: 'sparkles-outline', label: 'AI Assistant (native only)', disabled: true },
          { icon: 'desktop-outline', label: 'Share screen (native only)', disabled: true },
          { icon: 'hand-left-outline', label: 'Raise hand (native only)', disabled: true },
        ]}
      />
      <ParticipantsSheet visible={panel === 'participants'} onClose={() => setPanel(null)} participants={tiles} />
      <WhiteboardOverlay visible={panel === 'whiteboard'} onClose={() => setPanel(null)} canClear />
    </View>
  );
}
