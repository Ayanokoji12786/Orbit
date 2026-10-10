import assert from 'node:assert/strict';
import test from 'node:test';

import { parseRoomCode } from '../src/utils/meeting-links.ts';

test('accepts codes and supported share links', () => {
  assert.equal(parseRoomCode(' ABC123 '), 'abc123');
  assert.equal(parseRoomCode('orbit.app/j/ABC123'), 'abc123');
  assert.equal(parseRoomCode('https://www.orbit.app/meeting/abc123?source=invite'), 'abc123');
  assert.equal(parseRoomCode('orbit://meeting/abc123'), 'abc123');
});

test('rejects malformed and lookalike links', () => {
  for (const value of ['', 'abc', 'abcdefg', 'https://evil.example/j/abc123', 'https://orbit.app.evil.example/j/abc123', 'http://orbit.app/j/abc123', 'orbit.app/j/abc123/extra', 'https://orbit.app/j/abc%31%32%33']) {
    assert.equal(parseRoomCode(value), null, value);
  }
});
