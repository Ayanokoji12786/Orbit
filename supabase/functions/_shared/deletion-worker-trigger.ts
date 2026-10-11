const TRIGGER_PREFIX = 'orbit-account-deletion-worker:v1:';
const MAX_CLOCK_SKEW_SECONDS = 120;

function decodeHex(hex: string | null): Uint8Array | null {
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g)!, (byte) => Number.parseInt(byte, 16));
}

/** Validate the short-lived Cron trigger without exposing a reusable key to pg_net. */
export async function verifyDeletionWorkerTrigger(
  secret: string | undefined,
  timestamp: string | null,
  signatureHex: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const signature = decodeHex(signatureHex);
  if (!secret || secret.length < 32 || !timestamp || !/^[0-9]{10,13}$/.test(timestamp) || !signature) {
    return false;
  }
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)
    || Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return false;
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(`${TRIGGER_PREFIX}${timestamp}`));
}
