import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  let body: { pubkey: string };

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  if (!body.pubkey || !/^[0-9a-f]{64}$/i.test(body.pubkey)) {
    throw error(400, 'pubkey must be a 64-char hex Ed25519 public key (no 0x prefix)');
  }

  const res = await fetch('https://app.ai.self.xyz/api/agent/register/ed25519-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pubkey: body.pubkey, network: 'mainnet' }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ message: 'Self API error' }));
    return json({ error: errData.message ?? 'Failed to get challenge' }, { status: res.status });
  }

  const data = await res.json();
  return json(data);
};
