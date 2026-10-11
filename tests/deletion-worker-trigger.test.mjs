import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { verifyDeletionWorkerTrigger } from '../supabase/functions/_shared/deletion-worker-trigger.ts';

const secret = 'orbit-test-secret-with-more-than-32-characters';
const nowSeconds = 1800000000;
const timestamp = String(nowSeconds);

function signatureFor(value, key = secret) {
  return createHmac('sha256', key)
    .update(`orbit-account-deletion-worker:v1:${value}`)
    .digest('hex');
}

test('worker accepts only a correctly signed, current trigger', async () => {
  assert.equal(await verifyDeletionWorkerTrigger(secret, timestamp, signatureFor(timestamp), nowSeconds), true);
  assert.equal(await verifyDeletionWorkerTrigger(secret, timestamp, signatureFor(timestamp), nowSeconds + 120), true);
  assert.equal(await verifyDeletionWorkerTrigger(secret, timestamp, signatureFor(timestamp), nowSeconds + 121), false);
  assert.equal(await verifyDeletionWorkerTrigger(secret, timestamp, signatureFor(timestamp), nowSeconds - 121), false);
  assert.equal(await verifyDeletionWorkerTrigger(secret, timestamp, signatureFor(timestamp, 'wrong-signing-key'), nowSeconds), false);
  assert.equal(await verifyDeletionWorkerTrigger(secret, timestamp, '0'.repeat(64), nowSeconds), false);
  assert.equal(await verifyDeletionWorkerTrigger(secret, timestamp, 'not-hex', nowSeconds), false);
  assert.equal(await verifyDeletionWorkerTrigger(secret, '1800000000000', signatureFor('1800000000000'), nowSeconds), false);
  assert.equal(await verifyDeletionWorkerTrigger('short', timestamp, signatureFor(timestamp), nowSeconds), false);
  assert.equal(await verifyDeletionWorkerTrigger(undefined, timestamp, signatureFor(timestamp), nowSeconds), false);
});
