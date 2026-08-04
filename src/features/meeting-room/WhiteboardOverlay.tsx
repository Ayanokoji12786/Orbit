import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, IconButton, PressableScale } from '@/components/ui';

import { WhiteboardCanvas, type Stroke } from './WhiteboardCanvas';

const COLORS = ['#F5F5F7', '#5B5FFF', '#7C5CFC', '#20C997', '#F59F00', '#FF4D6D'];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function WhiteboardOverlay({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeColor, setActiveColor] = useState(COLORS[0]);

  if (!visible) return null;

  return (
    // No entering/exiting animation: mounting Skia's canvas can block the
    // animation frame loop and leave this stuck invisible mid-fade.
    <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
      <WhiteboardCanvas activeColor={activeColor} strokes={strokes} onStrokesChange={setStrokes} />

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
        <AppText variant="headline" color="textInverse">
          Whiteboard
        </AppText>
        <IconButton name="close" variant="glass" accessibilityLabel="Close whiteboard" onPress={onClose} />
      </View>

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
          {COLORS.map((color) => (
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
        <PressableScale onPress={() => setStrokes([])} haptic="soft" accessibilityLabel="Clear whiteboard">
          <AppText variant="captionMedium" color="textInverse">
            Clear
          </AppText>
        </PressableScale>
      </View>
    </View>
  );
}
