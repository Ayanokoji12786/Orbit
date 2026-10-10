import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeWhiteboardEvents, parseWhiteboardEvent, visibleWhiteboardStrokes } from '../src/utils/whiteboard-events.ts';

const stroke = (seq, id) => parseWhiteboardEvent({
  seq,
  client_id: id,
  kind: 'stroke',
  color: '#5B5FFF',
  points: [{ x: 0.1, y: 0.2 }, { x: 0.7, y: 0.8 }],
});

test('late fetch and live inserts merge without duplicates or wrong order', () => {
  const live = stroke(3, 'live-003');
  const fetched = [stroke(1, 'early-001'), stroke(2, 'early-002'), live];
  const events = mergeWhiteboardEvents([live], fetched);
  assert.deepEqual(events.map((event) => event.seq), [1, 2, 3]);
  assert.deepEqual(visibleWhiteboardStrokes(events).map((item) => item.id), ['early-001', 'early-002', 'live-003']);
});

test('a clear hides earlier strokes but preserves later ones', () => {
  const clear = parseWhiteboardEvent({ seq: 3, client_id: 'clear-003', kind: 'clear' });
  const events = mergeWhiteboardEvents([], [stroke(4, 'new-004'), stroke(1, 'old-001'), clear, stroke(2, 'old-002')]);
  assert.deepEqual(visibleWhiteboardStrokes(events).map((item) => item.id), ['new-004']);
});

test('malformed and oversized remote strokes are ignored', () => {
  assert.equal(parseWhiteboardEvent({ seq: 1, client_id: 'bad-001', kind: 'stroke', color: '#5B5FFF', points: [{ x: -1, y: 0 }, { x: 1, y: 1 }] }), null);
  assert.equal(parseWhiteboardEvent({ seq: 2, client_id: 'bad-002', kind: 'stroke', color: '#FFFFFF', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }), null);
  assert.equal(parseWhiteboardEvent({ seq: 3, client_id: 'bad-003', kind: 'stroke', color: '#5B5FFF', points: Array.from({ length: 513 }, () => ({ x: 0, y: 0 })) }), null);
});

test('the same 500-event window is used after reconnect', () => {
  const all = Array.from({ length: 501 }, (_, index) => stroke(index + 1, `stroke-${index + 1}`));
  const events = mergeWhiteboardEvents([], all);
  assert.equal(events.length, 500);
  assert.equal(events[0].seq, 2);
  assert.equal(events.at(-1).seq, 501);
});
