import { useCallback, useEffect, useRef, useState, type ComponentType, type ElementRef, type Ref } from 'react';
import { ActivityIndicator, Alert, AppState, findNodeHandle, NativeModules, Platform, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveKitRoom, registerGlobals, useDataChannel, useLocalParticipant, useRemoteParticipants, useRoomContext } from '@livekit/react-native';
import { ScreenCapturePickerView } from '@livekit/react-native-webrtc';
import { ConnectionState, RoomEvent } from 'livekit-client';

import { AppText, Button, IconButton, PressableScale } from '@/components/ui';
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
import { changeLiveMeeting, MeetingLifecycleError, renewLiveMeeting } from './meeting-lifecycle-api';

registerGlobals();

// The library types this as HostComponent<unknown> — no props at all, even though the
// underlying native view does accept standard style props. Cast once here instead of
// suppressing the error at every usage site; the ref type is preserved from the original.
type ScreenCapturePickerViewRef = ElementRef<typeof ScreenCapturePickerView>;
const TypedScreenCapturePickerView = ScreenCapturePickerView as ComponentType<{
  ref?: Ref<ScreenCapturePickerViewRef>;
  style?: StyleProp<ViewStyle>;
}>;

type Panel = 'chat' | 'whiteboard' | 'polls' | 'participants' | 'more' | 'ai' | null;
const REACTION_EMOJIS = ['👍', '❤️', '😂', '👏', '🎉'];

type Props = {
  roomCode: string;
  password?: string;
};

export function LiveRoom({ roomCode, password }: Props) {
  const [joinInfo, setJoinInfo] = useState<LiveKitJoinInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState(password ?? '');
  const [joinAttempt, setJoinAttempt] = useState({ password });

  useEffect(() => {
    let cancelled = false;
    // Reset both, or switching rooms keeps the previous room's token connected and — because
    // the error branch below short-circuits — a single failed join makes every later room
    // render that stale error screen.
    setJoinInfo(null);
    setError(null);
    fetchLiveKitToken(roomCode, joinAttempt.password)
      .then((info) => {
        if (!cancelled) setJoinInfo(info);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not join this meeting.');
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode, joinAttempt]);

  if (error === 'Password required.' || error === 'Incorrect password.') {
    return (
      <MeetingPasswordPrompt
        message={error}
        value={passwordInput}
        onChange={setPasswordInput}
        onJoin={() => { if (passwordInput.trim()) setJoinAttempt({ password: passwordInput }); }}
      />
    );
  }
  if (error) return <JoinStatus icon="alert-circle-outline" message={error} />;
  if (!joinInfo) return <JoinStatus icon="hourglass-outline" message="Connecting…" spinner />;

  return (
    <LiveKitRoom
      serverUrl={joinInfo.url}
      token={joinInfo.token}
      audio
      video={false}
      connect
      onDisconnected={() => {
        // Final transport disconnects can happen without pressing Leave. The
        // lease still expires if this request cannot reach the backend.
        void changeLiveMeeting('leave', joinInfo.roomName).catch(() => {});
        router.back();
      }}
      onError={(err) => setError(err.message)}>
      {/* Keyed so panels, reactions, chat and the AI conversation don't carry into a new meeting. */}
      <RoomContent key={joinInfo.roomName} meetingId={joinInfo.roomName} meetingTitle={joinInfo.meetingTitle} isHost={joinInfo.isHost} />
    </LiveKitRoom>
  );
}

function MeetingPasswordPrompt({ message, value, onChange, onJoin }: {
  message: string;
  value: string;
  onChange: (value: string) => void;
  onJoin: () => void;
}) {
  const { radii, spacing } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: '#09090B', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl }}>
      <Ionicons name="lock-closed-outline" size={42} color="#7C5CFC" />
      <AppText variant="headline" style={{ color: '#FFFFFF' }}>Password-protected meeting</AppText>
      <AppText variant="body" style={{ color: '#A1A1AA' }}>{message === 'Incorrect password.' ? 'That password did not work. Try again.' : 'Enter the password shared by the host.'}</AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onJoin}
        returnKeyType="join"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        placeholder="Meeting password"
        placeholderTextColor="#8A8A93"
        accessibilityLabel="Meeting password"
        style={{ height: 52, paddingHorizontal: spacing.base, borderRadius: radii.md, borderWidth: 1, borderColor: '#45454A', backgroundColor: '#18181C', color: '#FFFFFF', fontSize: 16 }}
      />
      <Button label="Join meeting" onPress={onJoin} disabled={!value.trim()} />
      <PressableScale onPress={() => router.back()} haptic="soft" style={{ alignSelf: 'center', padding: spacing.sm }}>
        <AppText variant="captionMedium" color="primary">Go back</AppText>
      </PressableScale>
    </View>
  );
}

function RoomContent({ meetingId, meetingTitle, isHost }: { meetingId: string; meetingTitle: string; isHost: boolean }) {
  const { spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const [panel, setPanel] = useState<Panel>(null);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
  // An attribute event re-renders this room and its existing participant tiles.
  const [, setAttributesRevision] = useState(0);
  const [roomActionError, setRoomActionError] = useState<string | null>(null);
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const roomActionInFlight = useRef(false);
  const { message: reactionMessage, send: sendReaction } = useDataChannel('orbit.reaction');
  const screenSharePickerRef = useRef<ScreenCapturePickerViewRef>(null);

  useEffect(() => {
    const onAttributesChanged = () => setAttributesRevision((revision) => revision + 1);
    room.on(RoomEvent.ParticipantAttributesChanged, onAttributesChanged);
    return () => { room.off(RoomEvent.ParticipantAttributesChanged, onAttributesChanged); };
  }, [room]);

  useEffect(() => {
    let mounted = true;
    const renew = () => {
      if (room.state !== ConnectionState.Connected) return;
      void renewLiveMeeting(meetingId).then(
        () => { if (mounted) setRenewalError(null); },
        (error: unknown) => {
          if (!mounted) return;
          if (error instanceof MeetingLifecycleError && error.status === 403) {
            // The server has revoked this participant or ended the meeting.
            void room.disconnect().catch(() => {});
            return;
          }
          setRenewalError('Meeting access could not be renewed. Check your connection or rejoin.');
        },
      );
    };
    const timer = setInterval(renew, 60_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') renew();
    });
    return () => {
      mounted = false;
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [meetingId, room]);

  const changeRoomState = async (action: 'leave' | 'end') => {
    if (roomActionInFlight.current) return;
    roomActionInFlight.current = true;
    setPanel(null);
    setRoomActionError(null);
    try {
      await changeLiveMeeting(action, meetingId);
      await room.disconnect();
    } catch (err) {
      if (action === 'leave' && err instanceof MeetingLifecycleError && err.databaseUpdated) {
        // The database already revoked access. Disconnect locally even if the
        // room service is temporarily unavailable.
        await room.disconnect().catch(() => {});
        return;
      }
      setRoomActionError(err instanceof Error ? err.message : 'Could not update this meeting. Try again.');
    } finally {
      roomActionInFlight.current = false;
    }
  };

  const confirmEndMeeting = () => {
    Alert.alert('End meeting for everyone?', 'Everyone will be disconnected and this meeting cannot be reopened.', [
      { text: 'Keep meeting', style: 'cancel' },
      { text: 'End meeting', style: 'destructive', onPress: () => { void changeRoomState('end'); } },
    ]);
  };

  const addReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const x = 40 + Math.random() * 220;
    setReactions((current) => [...current, { id, emoji, x }]);
  }, []);
  const removeReaction = useCallback((id: string) => {
    setReactions((current) => current.filter((reaction) => reaction.id !== id));
  }, []);

  useEffect(() => {
    if (!reactionMessage) return;
    if (reactionMessage.from?.identity === localParticipant.identity) return;
    const emoji = REACTION_EMOJIS[reactionMessage.payload[0]];
    if (emoji) addReaction(emoji);
  }, [reactionMessage, localParticipant.identity, addReaction]);

  const spawnReaction = (emoji: string) => {
    const index = REACTION_EMOJIS.indexOf(emoji);
    if (index < 0) return;
    setRoomActionError(null);
    void sendReaction(new Uint8Array([index]), { reliable: false }).then(
      () => addReaction(emoji),
      () => setRoomActionError('Could not send your reaction. Try again.'),
    );
  };

  const handRaised = localParticipant.attributes['orbit.handRaised'] === 'true';
  const toggleHand = async () => {
    setRoomActionError(null);
    try {
      await localParticipant.setAttributes({ 'orbit.handRaised': handRaised ? '' : 'true' });
      setAttributesRevision((revision) => revision + 1);
      setPanel(null);
    } catch (err) {
      setRoomActionError(err instanceof Error ? err.message : 'Could not update your hand.');
    }
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
    { id: localParticipant.identity, name: `${localParticipant.name || 'You'} (you)`, muted: !isMicrophoneEnabled, handRaised },
    ...remoteParticipants.map((p) => ({ id: p.identity, name: p.name || p.identity, muted: !p.isMicrophoneEnabled, handRaised: p.attributes['orbit.handRaised'] === 'true' })),
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
          id={r.id}
          key={r.id}
          emoji={r.emoji}
          startX={r.x}
          onDone={removeReaction}
        />
      ))}

      {(screenShareError || roomActionError || renewalError) && (
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
              {screenShareError || roomActionError || renewalError}
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
          onLeave={() => { void changeRoomState('leave'); }}
        />
      </View>

      <MoreSheet
        visible={panel === 'more'}
        onClose={() => setPanel(null)}
        actions={[
          ...(isHost ? [{ icon: 'close-circle-outline' as const, label: 'End meeting for everyone', onPress: confirmEndMeeting }] : []),
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
          { icon: 'hand-left-outline', label: handRaised ? 'Lower hand' : 'Raise hand', onPress: () => { void toggleHand(); } },
        ]}
      />
      <ChatPanel visible={panel === 'chat'} onClose={() => setPanel(null)} meetingId={meetingId} />
      <PollsPanel visible={panel === 'polls'} onClose={() => setPanel(null)} meetingId={meetingId} />
      <AiAssistantPanel visible={panel === 'ai'} onClose={() => setPanel(null)} meetingId={meetingId} />
      <ParticipantsSheet visible={panel === 'participants'} onClose={() => setPanel(null)} participants={participants} />
      <WhiteboardOverlay visible={panel === 'whiteboard'} onClose={() => setPanel(null)} meetingId={meetingId} canClear={isHost} />
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
      <AppText variant="body" style={{ color: '#FFFFFF', textAlign: 'center' }}>
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
