// @livekit/react-native has no web implementation. This preview keeps the
// room's visual design and panels testable in a browser without a real
// video connection — real calling only ever runs on iOS/Android.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';

import { ChatPanel } from './ChatPanel';
import { ControlBar } from './ControlBar';
import { FloatingReaction } from './FloatingReaction';
import { MoreSheet } from './MoreSheet';
import { ParticipantsSheet } from './ParticipantsSheet';
import { PollsPanel } from './PollsPanel';
import { WhiteboardOverlay } from './WhiteboardOverlay';

type Panel = 'chat' | 'whiteboard' | 'polls' | 'participants' | 'more' | null;

type Props = {
  roomCode: string;
  password?: string;
};

export function LiveRoom({ roomCode }: Props) {
  const { spacing, radii } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);

  const spawnReaction = (emoji: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const x = 40 + Math.random() * 220;
    setReactions((current) => [...current, { id, emoji, x }]);
  };

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

      {reactions.map((r) => (
        <FloatingReaction key={r.id} emoji={r.emoji} startX={r.x} onDone={() => setReactions((c) => c.filter((x) => x.id !== r.id))} />
      ))}

      <View style={{ position: 'absolute', bottom: 40, left: spacing.lg, right: spacing.lg }}>
        <ControlBar
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          cameraOff={cameraOff}
          onToggleCamera={() => setCameraOff((c) => !c)}
          onReact={spawnReaction}
          onMore={() => setPanel('more')}
          onLeave={() => router.back()}
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
          { icon: 'chatbubble-outline', label: 'Chat', onPress: () => setPanel('chat') },
          { icon: 'brush-outline', label: 'Whiteboard', onPress: () => setPanel('whiteboard') },
          { icon: 'stats-chart-outline', label: 'Polls', onPress: () => setPanel('polls') },
          { icon: 'hand-left-outline', label: 'Raise hand', onPress: () => setPanel(null) },
        ]}
      />
      <ChatPanel visible={panel === 'chat'} onClose={() => setPanel(null)} meetingId={roomCode} />
      <PollsPanel visible={panel === 'polls'} onClose={() => setPanel(null)} meetingId={roomCode} />
      <ParticipantsSheet visible={panel === 'participants'} onClose={() => setPanel(null)} participants={tiles} />
      <WhiteboardOverlay visible={panel === 'whiteboard'} onClose={() => setPanel(null)} />
    </View>
  );
}
