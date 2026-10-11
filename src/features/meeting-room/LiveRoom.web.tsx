// Use LiveKit's browser SDK; the native SDK cannot run in a web bundle.
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { isTrackReference, LiveKitRoom, RoomAudioRenderer, StartAudio, useConnectionState, useLocalParticipant, useRemoteParticipants, useTracks, VideoTrack } from '@livekit/components-react';
import { ConnectionState, Track } from 'livekit-client';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, Button, IconButton } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { fetchLiveKitToken, type LiveKitJoinInfo } from '@/lib/livekit';

import { AiAssistantPanel } from './AiAssistantPanel';
import { ChatPanel } from './ChatPanel';
import { ControlBar } from './ControlBar';
import { FloatingReaction } from './FloatingReaction';
import { MoreSheet } from './MoreSheet';
import { ParticipantsSheet } from './ParticipantsSheet';
import { PollsPanel } from './PollsPanel';
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
    setJoinInfo(null);
    setError(null);
    fetchLiveKitToken(roomCode, password)
      .then((info) => { if (!cancelled) setJoinInfo(info); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not join this meeting.'); });
    return () => { cancelled = true; };
  }, [roomCode, password]);

  if (error || !joinInfo) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        {!error && <ActivityIndicator color="#5B5FFF" size="large" />}
        <AppText color="textInverse">{error ?? 'Connecting…'}</AppText>
        <Button label="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
      </View>
    );
  }

  return (
    <LiveKitRoom
      key={joinInfo.roomName}
      serverUrl={joinInfo.url}
      token={joinInfo.token}
      connect
      audio={false}
      video={false}
      style={{ display: 'flex', flex: 1, minHeight: 0 }}
      onError={(err) => setError(err.message)}
      onDisconnected={() => router.canGoBack() ? router.back() : router.replace('/')}>
      <RoomContent roomCode={roomCode} joinInfo={joinInfo} />
    </LiveKitRoom>
  );
}

function RoomContent({ roomCode, joinInfo }: { roomCode: string; joinInfo: LiveKitJoinInfo }) {
  const { spacing, radii } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const connection = useConnectionState();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const changeMedia = async (action: () => Promise<unknown>) => {
    setMediaError(null);
    try { await action(); }
    catch (err) { setMediaError(err instanceof Error ? err.message : 'Could not access this device.'); }
  };

  const spawnReaction = (emoji: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const x = 40 + Math.random() * 220;
    setReactions((current) => [...current, { id, emoji, x }]);
  };

  const participants = [
    { id: localParticipant.identity, name: `${localParticipant.name || 'You'} (you)`, muted: !isMicrophoneEnabled },
    ...remoteParticipants.map((p) => ({ id: p.identity, name: p.name || p.identity, muted: !p.isMicrophoneEnabled })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <RoomAudioRenderer />
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
        {tracks.map((track) => (
          <View
            key={`${track.participant.identity}-${track.source}`}
            style={{
              flexBasis: tracks.length === 1 ? '100%' : '46%',
              flexGrow: 1,
              minWidth: 160,
              maxHeight: '100%',
              aspectRatio: 16 / 9,
              borderRadius: radii.lg,
              backgroundColor: '#161618',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
            {isTrackReference(track) && !track.publication.isMuted ? (
              <VideoTrack trackRef={track} style={{ width: '100%', height: '100%', objectFit: track.source === Track.Source.ScreenShare ? 'contain' : 'cover' }} />
            ) : <Avatar name={track.participant.name || track.participant.identity || 'You'} size={64} />}
            <AppText variant="caption" color="textInverse" style={{ position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', padding: 4 }}>
              {track.participant.name || track.participant.identity || 'You'}{track.participant.isLocal ? ' (you)' : ''}
            </AppText>
          </View>
        ))}
      </View>

      {reactions.map((r) => (
        <FloatingReaction key={r.id} emoji={r.emoji} startX={r.x} onDone={() => setReactions((c) => c.filter((x) => x.id !== r.id))} />
      ))}

      <View style={{ position: 'absolute', bottom: 40, left: spacing.lg, right: spacing.lg }}>
        <ControlBar
          muted={!isMicrophoneEnabled}
          onToggleMute={() => void changeMedia(() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled))}
          cameraOff={!isCameraEnabled}
          onToggleCamera={() => void changeMedia(() => localParticipant.setCameraEnabled(!isCameraEnabled))}
          onReact={spawnReaction}
          onMore={() => setPanel('more')}
          onLeave={() => router.canGoBack() ? router.back() : router.replace('/')}
        />
      </View>

      <View style={{ position: 'absolute', bottom: 40 + 76, left: spacing.lg, right: spacing.lg, alignItems: 'center' }}>
        <StartAudio label="Enable meeting audio" />
        <AppText variant="caption" color={mediaError ? 'error' : 'textInverse'}>
          {mediaError ?? (connection === ConnectionState.Connected ? 'Connected' : connection)}
        </AppText>
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
              void changeMedia(() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled));
            },
          },
          { icon: 'hand-left-outline', label: 'Raise hand', onPress: () => setPanel(null) },
        ]}
      />
      <ChatPanel visible={panel === 'chat'} onClose={() => setPanel(null)} meetingId={joinInfo?.roomName} />
      <PollsPanel visible={panel === 'polls'} onClose={() => setPanel(null)} meetingId={joinInfo?.roomName} />
      <AiAssistantPanel
        visible={panel === 'ai'}
        onClose={() => setPanel(null)}
        meetingTitle={joinInfo?.meetingTitle ?? roomCode}
      />
      <ParticipantsSheet visible={panel === 'participants'} onClose={() => setPanel(null)} participants={participants} />
      <WhiteboardOverlay visible={panel === 'whiteboard'} onClose={() => setPanel(null)} />
    </View>
  );
}
