import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { VideoTrack, type TrackReference } from '@livekit/react-native';

import { AppText, Avatar } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';

type Props = {
  name: string;
  trackRef?: TrackReference;
  muted?: boolean;
  isSpeaking?: boolean;
  fullWidth?: boolean;
};

export function VideoTile({ name, trackRef, muted, isSpeaking, fullWidth }: Props) {
  const { radii } = useAppTheme();

  return (
    <View
      style={{
        width: fullWidth ? '100%' : '48%',
        aspectRatio: fullWidth ? 16 / 9 : 3 / 4,
        borderRadius: radii.lg,
        backgroundColor: '#161618',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: isSpeaking ? 2 : 0,
        borderColor: '#20C997',
      }}>
      {trackRef ? (
        <VideoTrack trackRef={trackRef} style={StyleSheet.absoluteFill} objectFit="cover" mirror />
      ) : (
        <Avatar name={name} size={64} />
      )}
      <View
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          right: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View
          style={{
            backgroundColor: 'rgba(0,0,0,0.45)',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
          }}>
          <AppText variant="caption" color="textInverse" numberOfLines={1}>
            {name}
          </AppText>
        </View>
        {muted && (
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="mic-off" size={12} color="#FF4D6D" />
          </View>
        )}
      </View>
    </View>
  );
}
