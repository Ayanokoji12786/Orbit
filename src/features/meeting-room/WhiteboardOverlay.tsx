import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, IconButton, PressableScale } from '@/components/ui';

import { WHITEBOARD_COLORS } from '@/utils/whiteboard-events';

import { WhiteboardCanvas } from './WhiteboardCanvas';
import { useWhiteboardEvents } from './useWhiteboardEvents';

type Props = {
  visible: boolean;
  onClose: () => void;
  meetingId?: string;
  canClear?: boolean;
};

export function WhiteboardOverlay({ visible, onClose, meetingId, canClear = false }: Props) {
  const insets = useSafeAreaInsets();
  const [activeColor, setActiveColor] = useState<string>(WHITEBOARD_COLORS[0]);
  const { strokes, loading, error, addStroke, clearBoard } = useWhiteboardEvents(meetingId);

  if (!visible) return null;

  return (
    // No entering/exiting animation: mounting Skia's canvas can block the
    // animation frame loop and leave this stuck invisible mid-fade.
    <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
      <WhiteboardCanvas activeColor={activeColor} strokes={strokes} onStroke={(stroke) => { void addStroke(stroke); }} />

      <View
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          right: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <AppText variant="headline" style={{ color: '#FFFFFF' }}>
          Whiteboard
        </AppText>
        <IconButton name="close" variant="glass" accessibilityLabel="Close whiteboard" onPress={onClose} />
      </View>

      {(loading || error) && (
        <View style={{ position: 'absolute', top: insets.top + 64, left: 16, right: 16 }}>
          <AppText variant="caption" style={{ color: error ? '#FF4D6D' : '#A1A1AA' }}>
            {error ?? 'Loading shared strokes…'}
          </AppText>
        </View>
      )}

      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 24,
          left: 16,
          right: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {WHITEBOARD_COLORS.map((color) => (
            <PressableScale key={color} onPress={() => setActiveColor(color)} haptic="light" accessibilityLabel={`Color ${color}`}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: color,
                  borderWidth: activeColor === color ? 2 : 0,
                  borderColor: '#FFFFFF',
                }}
              />
            </PressableScale>
          ))}
        </View>
        {canClear ? (
          <PressableScale onPress={() => { void clearBoard(); }} haptic="soft" accessibilityLabel="Clear whiteboard">
            <AppText variant="captionMedium" style={{ color: '#FFFFFF' }}>Clear</AppText>
          </PressableScale>
        ) : (
          <AppText variant="micro" style={{ color: '#A1A1AA' }}>Host clears</AppText>
        )}
      </View>
    </View>
  );
}
