import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalParticipant, useRemoteParticipants, useSpeakingParticipants, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';

import { useAppTheme } from '@/design-system/useAppTheme';

import { VideoTile } from './VideoTile';

export function VideoGrid() {
  const { spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const speaking = useSpeakingParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);

  const speakingIds = new Set(speaking.map((p) => p.identity));
  const localTrackRef = cameraTracks.find((t) => t.participant.identity === localParticipant.identity);
  // v1: feature one active share at a time, matching how most meeting apps handle concurrent shares.
  const featuredShare = screenShareTracks[0];

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 64, paddingHorizontal: spacing.sm, paddingBottom: 160 }}>
      {featuredShare && (
        <View style={{ marginBottom: spacing.sm }}>
          <VideoTile
            name={`${
              featuredShare.participant.identity === localParticipant.identity
                ? 'You'
                : featuredShare.participant.name || featuredShare.participant.identity
            } — presenting`}
            trackRef={featuredShare}
            fullWidth
          />
        </View>
      )}
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <VideoTile
          name={localParticipant.name || 'You'}
          trackRef={localTrackRef}
          muted={!isMicrophoneEnabled}
          isSpeaking={speakingIds.has(localParticipant.identity)}
        />
        {remoteParticipants.map((participant) => (
          <VideoTile
            key={participant.identity}
            name={participant.name || participant.identity}
            trackRef={cameraTracks.find((t) => t.participant.identity === participant.identity)}
            muted={!participant.isMicrophoneEnabled}
            isSpeaking={speakingIds.has(participant.identity)}
          />
        ))}
      </View>
    </View>
  );
}
