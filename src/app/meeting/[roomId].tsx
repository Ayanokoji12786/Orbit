import { useLocalSearchParams } from 'expo-router';

import { LiveRoom } from '@/features/meeting-room';

export default function MeetingRoomRoute() {
  const { roomId, password } = useLocalSearchParams<{ roomId: string; password?: string }>();

  return <LiveRoom key={`${roomId}:${password ?? ''}`} roomCode={roomId} password={password} />;
}
