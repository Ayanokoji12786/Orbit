export type WhiteboardPoint = { x: number; y: number };
export type WhiteboardStroke = { id: string; color: string; points: WhiteboardPoint[] };
export type WhiteboardEvent = {
  seq: number;
  clientId: string;
  kind: 'stroke' | 'clear';
  stroke?: WhiteboardStroke;
};

export const WHITEBOARD_COLORS = ['#F5F5F7', '#5B5FFF', '#7C5CFC', '#20C997', '#F59F00', '#FF4D6D'] as const;
export const MAX_WHITEBOARD_EVENTS = 500;
export const MAX_STROKE_POINTS = 512;

/** Realtime payloads are untrusted JSON even when the table has server checks. */
export function parseWhiteboardEvent(value: unknown): WhiteboardEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!Number.isSafeInteger(row.seq) || (row.seq as number) < 1 || typeof row.client_id !== 'string') return null;
  if (row.kind === 'clear') return { seq: row.seq as number, clientId: row.client_id, kind: 'clear' };
  if (row.kind !== 'stroke' || typeof row.color !== 'string' || !WHITEBOARD_COLORS.includes(row.color as typeof WHITEBOARD_COLORS[number])) return null;
  if (!Array.isArray(row.points) || row.points.length < 2 || row.points.length > MAX_STROKE_POINTS) return null;
  const points: WhiteboardPoint[] = [];
  for (const point of row.points) {
    if (!point || typeof point !== 'object' || Array.isArray(point)) return null;
    const candidate = point as Record<string, unknown>;
    if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number' ||
        !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y) ||
        candidate.x < 0 || candidate.x > 1 || candidate.y < 0 || candidate.y > 1) return null;
    points.push({ x: candidate.x, y: candidate.y });
  }
  return { seq: row.seq as number, clientId: row.client_id, kind: 'stroke', stroke: { id: row.client_id, color: row.color, points } };
}

/** Merge fetches and live inserts by sequence so their arrival order cannot duplicate or reorder strokes. */
export function mergeWhiteboardEvents(current: WhiteboardEvent[], incoming: WhiteboardEvent[]): WhiteboardEvent[] {
  const bySeq = new Map(current.map((event) => [event.seq, event]));
  for (const event of incoming) bySeq.set(event.seq, event);
  return Array.from(bySeq.values()).sort((a, b) => a.seq - b.seq).slice(-MAX_WHITEBOARD_EVENTS);
}

export function visibleWhiteboardStrokes(events: WhiteboardEvent[]): WhiteboardStroke[] {
  const strokes: WhiteboardStroke[] = [];
  for (const event of events) {
    if (event.kind === 'clear') strokes.length = 0;
    else if (event.stroke) strokes.push(event.stroke);
  }
  return strokes;
}
