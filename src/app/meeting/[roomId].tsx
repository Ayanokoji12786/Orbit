import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { mockContacts } from '@/features/home/mock-data';
import {
  ChatPanel,
  ControlBar,
  FloatingReaction,
  MoreSheet,
  ParticipantsSheet,
  PollsPanel,
  WhiteboardOverlay,
} from '@/features/meeting-room';
import { useAuthStore } from '@/stores/auth-store';

type Panel = 'chat' | 'whiteboard' | 'polls' | 'participants' | 'more' | null;

export default function MeetingRoom() {
  const { spacing, radii } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const email = useAuthStore((s) => s.email);
  const selfName = email ? email.split('@')[0] : 'You';

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);

  const tiles = [{ id: 'self', name: selfName }, ...mockContacts.slice(0, 3)];

  const spawnReaction = (emoji: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const x = 40 + Math.random() * 220;
    setReactions((current) => [...current, { id, emoji, x }]);
  };

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
        <IconButton
          name="people-outline"
          variant="glass"
          accessibilityLabel="Participants"
          onPress={() => setPanel('participants')}
        />
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
        <FloatingReaction
          key={r.id}
          emoji={r.emoji}
          startX={r.x}
          onDone={() => setReactions((current) => current.filter((x) => x.id !== r.id))}
        />
      ))}

      <View
        style={{
          position: 'absolute',
          bottom: 40,
          left: spacing.lg,
          right: spacing.lg,
        }}>
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

      <View
        style={{
          position: 'absolute',
          bottom: 40 + 76,
          left: spacing.lg,
          right: spacing.lg,
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
        <AppText variant="micro" color="textTertiary">
          Live video needs a connected LiveKit project — this is the Phase 1 interface preview.
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

      <ChatPanel visible={panel === 'chat'} onClose={() => setPanel(null)} roomId={roomId} />
      <PollsPanel visible={panel === 'polls'} onClose={() => setPanel(null)} />
      <ParticipantsSheet
        visible={panel === 'participants'}
        onClose={() => setPanel(null)}
        participants={tiles.map((t) => ({ id: t.id, name: t.name, muted: t.id === 'self' ? muted : false }))}
      />
      <WhiteboardOverlay visible={panel === 'whiteboard'} onClose={() => setPanel(null)} />
    </View>
  );
}
