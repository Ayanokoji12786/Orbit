import { registerGlobals } from '@livekit/react-native';

registerGlobals();

import { useEffect, useRef, useState, type ComponentType, type ElementRef, type Ref } from 'react';
import { ActivityIndicator, findNodeHandle, NativeModules, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveKitRoom, useLocalParticipant, useRemoteParticipants } from '@livekit/react-native';
import { ScreenCapturePickerView } from '@livekit/react-native-webrtc';

// The library types this as HostComponent<unknown> — no props at all, even though the
// underlying native view does accept standard style props. Cast once here instead of
// suppressing the error at every usage site; the ref type is preserved from the original.
type ScreenCapturePickerViewRef = ElementRef<typeof ScreenCapturePickerView>;
const TypedScreenCapturePickerView = ScreenCapturePickerView as ComponentType<{
  ref?: Ref<ScreenCapturePickerViewRef>;
  style?: StyleProp<ViewStyle>;
}>;

import { AppText, IconButton, PressableScale } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { fetchLiveKitToken, type LiveKitJoinInfo } from '@/lib/livekit';

import { AiAssistantPanel } from './AiAssistantPanel';
import { ChatPanel } from './ChatPanel';
import { ControlBar } from './ControlBar';
import { FloatingReaction } from './FloatingReaction';
import { MoreSheet } from './MoreSheet';
import { ParticipantsSheet } from './ParticipantsSheet';
import { PollsPanel } from './PollsPanel';
import { VideoGrid } from './VideoGrid';
import { WhiteboardOverlay } from './WhiteboardOverlay';

type Panel = 'chat' | 'whiteboard' | 'polls' | 'participants' | 'more' | 'ai' | null;

type Props = {
  roomCode: string;
  password?: string;
};

export function LiveRoom({ roomCode, password }: Props) {
  const [joinInfo, setJoinInfo] = useState<LiveKitJoinInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Reset both, or switching rooms keeps the previous room's token connected and — because
    // the error branch below short-circuits — a single failed join makes every later room
    // render that stale error screen.
    setJoinInfo(null);
    setError(null);
    fetchLiveKitToken(roomCode, password)
      .then((info) => {
        if (!cancelled) setJoinInfo(info);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not join this meeting.');
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode, password]);

  if (error) return <JoinStatus icon="alert-circle-outline" message={error} />;
  if (!joinInfo) return <JoinStatus icon="hourglass-outline" message="Connecting…" spinner />;

  return (
    <LiveKitRoom
      serverUrl={joinInfo.url}
      token={joinInfo.token}
      audio
      video={false}
      connect
      onDisconnected={() => router.back()}
      onError={(err) => setError(err.message)}>
      {/* Keyed so panels, reactions, chat and the AI conversation don't carry into a new meeting. */}
      <RoomContent key={joinInfo.roomName} meetingId={joinInfo.roomName} meetingTitle={joinInfo.meetingTitle} />
    </LiveKitRoom>
  );
}

function RoomContent({ meetingId, meetingTitle }: { meetingId: string; meetingTitle: string }) {
  const { spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const [panel, setPanel] = useState<Panel>(null);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const screenSharePickerRef = useRef<ScreenCapturePickerViewRef>(null);

  const spawnReaction = (emoji: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const x = 40 + Math.random() * 220;
    setReactions((current) => [...current, { id, emoji, x }]);
  };

  const [screenShareError, setScreenShareError] = useState<string | null>(null);

  const toggleScreenShare = async () => {
    setScreenShareError(null);
    try {
      if (!isScreenShareEnabled && Platform.OS === 'ios') {
        // Absent in Expo Go and in dev clients built without the LiveKit plugin —
        // reaching straight for `.show` there throws "undefined is not an object".
        const picker = NativeModules.ScreenCapturePickerViewManager;
        const reactTag = findNodeHandle(screenSharePickerRef.current);
        if (!picker?.show || !reactTag) {
          throw new Error('Screen sharing needs a development build with the LiveKit plugin.');
        }
        picker.show(reactTag);
      }
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (err) {
      // Also covers the user dismissing the ReplayKit picker, which rejects.
      setScreenShareError(err instanceof Error ? err.message : 'Could not start screen sharing.');
    }
  };

  const participants = [
    { id: localParticipant.identity, name: `${localParticipant.name || 'You'} (you)`, muted: !isMicrophoneEnabled },
    ...remoteParticipants.map((p) => ({ id: p.identity, name: p.name || p.identity, muted: !p.isMicrophoneEnabled })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {Platform.OS === 'ios' && (
        <TypedScreenCapturePickerView ref={screenSharePickerRef} style={{ width: 1, height: 1, opacity: 0, position: 'absolute' }} />
      )}
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
          <AppText variant="captionMedium" color="textInverse" numberOfLines={1} style={{ maxWidth: 180 }}>
            {meetingTitle}
          </AppText>
        </View>
        <IconButton
          name="people-outline"
          variant="glass"
          accessibilityLabel="Participants"
          onPress={() => setPanel('participants')}
        />
      </View>

      <VideoGrid />

      {reactions.map((r) => (
        <FloatingReaction
          key={r.id}
          emoji={r.emoji}
          startX={r.x}
          onDone={() => setReactions((current) => current.filter((x) => x.id !== r.id))}
        />
      ))}

      {screenShareError && (
        <View
          style={{
            position: 'absolute',
            bottom: 40 + 76,
            left: spacing.lg,
            right: spacing.lg,
            alignItems: 'center',
          }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
            <AppText variant="caption" color="error" style={{ textAlign: 'center' }}>
              {screenShareError}
            </AppText>
          </View>
        </View>
      )}

      <View style={{ position: 'absolute', bottom: 40, left: spacing.lg, right: spacing.lg }}>
        <ControlBar
          muted={!isMicrophoneEnabled}
          onToggleMute={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          cameraOff={!isCameraEnabled}
          onToggleCamera={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          onReact={spawnReaction}
          onMore={() => setPanel('more')}
          onLeave={() => router.back()}
        />
      </View>

      <MoreSheet
        visible={panel === 'more'}
        onClose={() => setPanel(null)}
        actions={[
          { icon: 'chatbubble-outline', label: 'Chat', onPress: () => setPanel('chat') },
          { icon: 'brush-outline', label: 'Whiteboard', onPress: () => setPanel('whiteboard') },
          { icon: 'stats-chart-outline', label: 'Polls', onPress: () => setPanel('polls') },
          { icon: 'sparkles-outline', label: 'AI Assistant', onPress: () => setPanel('ai') },
          {
            icon: isScreenShareEnabled ? 'stop-circle-outline' : 'desktop-outline',
            label: isScreenShareEnabled ? 'Stop sharing' : 'Share screen',
            onPress: () => {
              setPanel(null);
              // toggleScreenShare handles its own errors; void marks the floating promise deliberate.
              void toggleScreenShare();
            },
          },
          { icon: 'hand-left-outline', label: 'Raise hand', onPress: () => setPanel(null) },
        ]}
      />
      <ChatPanel visible={panel === 'chat'} onClose={() => setPanel(null)} meetingId={meetingId} />
      <PollsPanel visible={panel === 'polls'} onClose={() => setPanel(null)} meetingId={meetingId} />
      <AiAssistantPanel visible={panel === 'ai'} onClose={() => setPanel(null)} meetingTitle={meetingTitle} />
      <ParticipantsSheet visible={panel === 'participants'} onClose={() => setPanel(null)} participants={participants} />
      <WhiteboardOverlay visible={panel === 'whiteboard'} onClose={() => setPanel(null)} />
    </View>
  );
}

function JoinStatus({
  icon,
  message,
  spinner,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  message: string;
  spinner?: boolean;
}) {
  const { spacing } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl }}>
      {spinner ? <ActivityIndicator color="#5B5FFF" size="large" /> : <Ionicons name={icon} size={56} color="#5B5FFF" />}
      <AppText variant="body" color="textInverse" style={{ textAlign: 'center' }}>
        {message}
      </AppText>
      <PressableScale onPress={() => router.back()} haptic="soft">
        <AppText variant="captionMedium" color="primary">
          Go back
        </AppText>
      </PressableScale>
    </View>
  );
}
