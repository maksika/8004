import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  let body: { pubkey: string; signature: string };

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  if (!body.pubkey || !/^[0-9a-f]{64}$/i.test(body.pubkey)) {
    throw error(400, 'pubkey must be a 64-char hex Ed25519 public key (no 0x prefix)');
  }

  if (!body.signature || !/^[0-9a-f]{128}$/i.test(body.signature)) {
    throw error(400, 'signature must be a 128-char hex Ed25519 signature (no 0x prefix)');
  }

  const res = await fetch('https://app.ai.self.xyz/api/agent/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'ed25519',
      network: 'mainnet',
      ed25519Pubkey: body.pubkey,
      ed25519Signature: body.signature,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ message: 'Self API error' }));
    return json({ error: errData.message ?? 'Registration failed' }, { status: res.status });
  }

  const data = await res.json();
  return json(data);
};
