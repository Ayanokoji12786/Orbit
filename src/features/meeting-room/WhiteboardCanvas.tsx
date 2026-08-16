import { useCallback, useMemo, useRef, useState } from 'react';
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
  // Mirrors liveStroke for the gesture callbacks, so `endStroke` can read the finished
  // stroke without doing work inside a state updater (updaters must stay pure — React
  // may invoke them more than once, which would commit the stroke twice).
  const liveStrokeRef = useRef<Stroke | null>(null);

  const startStroke = useCallback(
    (x: number, y: number) => {
      // Date.now() alone collides when two strokes start in the same millisecond
      // (fast dotting), producing duplicate React keys.
      const stroke: Stroke = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        color: activeColor,
        points: [{ x, y }],
      };
      liveStrokeRef.current = stroke;
      setLiveStroke(stroke);
    },
    [activeColor],
  );

  const appendPoint = useCallback((x: number, y: number) => {
    setLiveStroke((current) => {
      if (!current) return current;
      const next = { ...current, points: [...current.points, { x, y }] };
      liveStrokeRef.current = next;
      return next;
    });
  }, []);

  const endStroke = useCallback(() => {
    const finished = liveStrokeRef.current;
    liveStrokeRef.current = null;
    setLiveStroke(null);
    if (finished && finished.points.length > 1) {
      onStrokesChange([...strokes, finished]);
    }
  }, [strokes, onStrokesChange]);

  // Rebuilding the gesture on every render reconfigures GestureDetector mid-stroke,
  // which drops points and causes visible jank on long strokes.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onStart((e) => runOnJS(startStroke)(e.x, e.y))
        .onUpdate((e) => runOnJS(appendPoint)(e.x, e.y))
        .onEnd(() => runOnJS(endStroke)()),
    [startStroke, appendPoint, endStroke],
  );

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
