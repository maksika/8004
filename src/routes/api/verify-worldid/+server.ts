import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// In-memory nullifier store (use Workers KV via platform.env.NULLIFIER_KV in production)
const usedNullifiers = new Map<string, boolean>();

export const POST: RequestHandler = async ({ request }) => {
  let body: {
    nullifier_hash: string;
    merkle_root: string;
    proof: string;
    verification_level: string;
    action: string;
    signal: string;
  };

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  if (!body.nullifier_hash || !body.merkle_root || !body.proof) {
    throw error(400, 'Missing required fields: nullifier_hash, merkle_root, proof');
  }

  // Check for duplicate nullifier
  const key = 'worldid:' + body.nullifier_hash;
  if (usedNullifiers.has(key)) {
    return json({ error: 'World ID already used to register an agent' }, { status: 409 });
  }

  // Forward proof to World ID verification API (URL uses app_id, not rp_id)
  const verifyRes = await fetch('https://developer.world.org/api/v4/verify/app_9b41324bf599d95f63504dc568fa1533', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nullifier_hash: body.nullifier_hash,
      merkle_root: body.merkle_root,
      proof: body.proof,
      verification_level: body.verification_level,
      action: 'register-agent',
      signal: body.signal,
    }),
  });

  if (!verifyRes.ok) {
    const errData = await verifyRes.json().catch(() => ({ detail: 'World ID verification failed' }));
    return json({ error: errData.detail ?? errData.message ?? 'World ID verification failed' }, { status: 400 });
  }

  // Store nullifier to prevent reuse
  usedNullifiers.set(key, true);

  return json({
    verified: true,
    nullifier_hash: body.nullifier_hash,
    verification_level: body.verification_level,
  });
};
