import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthApiError } from '@supabase/supabase-js';

import { requestExistingAccountCode, verifyExistingAccountCode } from '../src/features/auth/recovery.ts';

test('recovery requests an OTP only for an existing account and hides unknown-account responses', async () => {
  let options;
  await requestExistingAccountCode({
    signInWithOtp: async (request) => {
      options = request;
      return { data: null, error: new AuthApiError('Signups not allowed for otp', 422, 'otp_disabled') };
    },
  }, '  person@example.com  ');

  assert.deepEqual(options, {
    email: 'person@example.com',
    options: { shouldCreateUser: false },
  });

  await requestExistingAccountCode({
    signInWithOtp: async () => {
      throw new AuthApiError('User not found', 400, 'user_not_found');
    },
  }, 'unknown@example.com');
});

test('recovery verifies an email OTP and accepts a fresh session without a local one', async () => {
  let params;
  await verifyExistingAccountCode({
    verifyOtp: async (request) => {
      params = request;
      return { data: { session: { user: { id: 'account-id' } } }, error: null };
    },
  }, '  person@example.com ', ' 123456 ');

  assert.deepEqual(params, { email: 'person@example.com', token: '123456', type: 'email' });
});

test('recovery never exposes account-specific verification errors or accepts an empty session', async () => {
  await assert.rejects(
    verifyExistingAccountCode({
      verifyOtp: async () => ({
        data: { session: null },
        error: new AuthApiError('User not found', 400, 'user_not_found'),
      }),
    }, 'unknown@example.com', '123456'),
    /invalid or has expired/,
  );

  await assert.rejects(
    verifyExistingAccountCode({
      verifyOtp: async () => ({ data: { session: null }, error: null }),
    }, 'person@example.com', '123456'),
    /Could not complete sign-in/,
  );

  await assert.rejects(
    verifyExistingAccountCode({
      verifyOtp: async () => {
        throw new AuthApiError('User not found', 400, 'user_not_found');
      },
    }, 'unknown@example.com', '123456'),
    /invalid or has expired/,
  );
});

test('transport failures are reported without account details', async () => {
  await assert.rejects(
    requestExistingAccountCode({
      signInWithOtp: async () => { throw new Error('Internal request URL with secrets'); },
    }, 'person@example.com'),
    /Could not request a code right now/,
  );
});

test('rate limits and service errors are not mistaken for a sent code', async () => {
  for (const status of [429, 500, 503]) {
    await assert.rejects(
      requestExistingAccountCode({
        signInWithOtp: async () => ({
          data: null,
          error: new AuthApiError('Service-specific details', status, 'service_error'),
        }),
      }, 'person@example.com'),
      /Could not request a code right now/,
    );
  }
});

test('verification rate limits and service errors are not called invalid codes', async () => {
  for (const status of [429, 500, 503]) {
    await assert.rejects(
      verifyExistingAccountCode({
        verifyOtp: async () => ({
          data: { session: null },
          error: new AuthApiError('Service-specific details', status, 'service_error'),
        }),
      }, 'person@example.com', '123456'),
      /Could not verify the code right now/,
    );
  }
});
