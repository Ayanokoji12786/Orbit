import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { MAX_STROKE_POINTS, type WhiteboardPoint, type WhiteboardStroke } from '@/utils/whiteboard-events';

const BACKGROUND = '#0B0B0E';

function pointsToSvgPath(points: WhiteboardPoint[], width: number, height: number) {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x * width} ${first.y * height} ` + rest.map((p) => `L ${p.x * width} ${p.y * height}`).join(' ');
}

type Props = {
  activeColor: string;
  strokes: WhiteboardStroke[];
  onStroke: (stroke: WhiteboardStroke) => void;
};

export function WhiteboardCanvas({ activeColor, strokes, onStroke }: Props) {
  const [liveStroke, setLiveStroke] = useState<WhiteboardStroke | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const dimensionsRef = useRef(dimensions);
  // Mirrors liveStroke for the gesture callbacks, so `endStroke` can read the finished
  // stroke without doing work inside a state updater (updaters must stay pure — React
  // may invoke them more than once, which would commit the stroke twice).
  const liveStrokeRef = useRef<WhiteboardStroke | null>(null);

  const normalizedPoint = useCallback((x: number, y: number): WhiteboardPoint => {
    const { width, height } = dimensionsRef.current;
    return {
      x: Math.round(Math.max(0, Math.min(1, x / width)) * 10000) / 10000,
      y: Math.round(Math.max(0, Math.min(1, y / height)) * 10000) / 10000,
    };
  }, []);

  const startStroke = useCallback(
    (x: number, y: number) => {
      // Date.now() alone collides when two strokes start in the same millisecond
      // (fast dotting), producing duplicate React keys.
      const stroke: WhiteboardStroke = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        color: activeColor,
        points: [normalizedPoint(x, y)],
      };
      liveStrokeRef.current = stroke;
      setLiveStroke(stroke);
    },
    [activeColor, normalizedPoint],
  );

  const appendPoint = useCallback((x: number, y: number) => {
    const current = liveStrokeRef.current;
    if (!current || current.points.length >= MAX_STROKE_POINTS) return;
    const point = normalizedPoint(x, y);
    const last = current.points[current.points.length - 1];
    if (last.x === point.x && last.y === point.y) return;
    const next = { ...current, points: [...current.points, point] };
    liveStrokeRef.current = next;
    setLiveStroke(next);
  }, [normalizedPoint]);

  const endStroke = useCallback(() => {
    const finished = liveStrokeRef.current;
    liveStrokeRef.current = null;
    setLiveStroke(null);
    if (finished) {
      // Two identical points let Skia draw a dot and satisfy the server limit.
      onStroke(finished.points.length === 1 ? { ...finished, points: [finished.points[0], finished.points[0]] } : finished);
    }
  }, [onStroke]);

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
      <View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0 &&
              (width !== dimensionsRef.current.width || height !== dimensionsRef.current.height)) {
            const next = { width, height };
            dimensionsRef.current = next;
            setDimensions(next);
          }
        }}
        style={[StyleSheet.absoluteFill, { backgroundColor: BACKGROUND }]}>
        <Canvas style={StyleSheet.absoluteFill}>
          {strokes.map((stroke) => (
            <Path
              key={stroke.id}
              path={pointsToSvgPath(stroke.points, dimensions.width, dimensions.height)}
              color={stroke.color}
              style="stroke"
              strokeWidth={5}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
          {liveStroke && (
            <Path
              path={pointsToSvgPath(liveStroke.points, dimensions.width, dimensions.height)}
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

export { BACKGROUND as WHITEBOARD_BACKGROUND };
