import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

type Point = { x: number; y: number };
type Stroke = { id: string; color: string; points: Point[] };

const BACKGROUND = '#0B0B0E';

function pointsToSvgPath(points: Point[]) {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ');
}

type Props = {
  activeColor: string;
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
};

export function WhiteboardCanvas({ activeColor, strokes, onStrokesChange }: Props) {
  const [liveStroke, setLiveStroke] = useState<Stroke | null>(null);

  const startStroke = (x: number, y: number) => {
    setLiveStroke({ id: `${Date.now()}`, color: activeColor, points: [{ x, y }] });
  };

  const appendPoint = (x: number, y: number) => {
    setLiveStroke((current) => (current ? { ...current, points: [...current.points, { x, y }] } : current));
  };

  const endStroke = () => {
    setLiveStroke((current) => {
      if (current && current.points.length > 1) {
        onStrokesChange([...strokes, current]);
      }
      return null;
    });
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onStart((e) => runOnJS(startStroke)(e.x, e.y))
    .onUpdate((e) => runOnJS(appendPoint)(e.x, e.y))
    .onEnd(() => runOnJS(endStroke)());

  return (
    <GestureDetector gesture={pan}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BACKGROUND }]}>
        <Canvas style={StyleSheet.absoluteFill}>
          {strokes.map((stroke) => (
            <Path
              key={stroke.id}
              path={pointsToSvgPath(stroke.points)}
              color={stroke.color}
              style="stroke"
              strokeWidth={5}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
          {liveStroke && (
            <Path
              path={pointsToSvgPath(liveStroke.points)}
              color={liveStroke.color}
              style="stroke"
              strokeWidth={5}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

export type { Stroke };
export { BACKGROUND as WHITEBOARD_BACKGROUND };
