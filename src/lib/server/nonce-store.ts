/** In-memory nonce store: nonce → expiry timestamp (ms) */
const nonceStore = new Map<string, number>();

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Purge expired nonces */
function purgeExpired() {
  const now = Date.now();
  for (const [nonce, expiry] of nonceStore) {
    if (expiry < now) nonceStore.delete(nonce);
  }
}

/** Generate a random hex string using Web Crypto API (works in Cloudflare Workers + Node) */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generate a new nonce and store it */
export function createNonce(): string {
  purgeExpired();
  const nonce = randomHex(32);
  nonceStore.set(nonce, Date.now() + NONCE_TTL_MS);
  return nonce;
}

/** Consume and delete a nonce. Returns true if valid. */
export function consumeNonce(nonce: string): boolean {
  purgeExpired();
  if (!nonceStore.has(nonce)) return false;
  nonceStore.delete(nonce);
  return true;
}
