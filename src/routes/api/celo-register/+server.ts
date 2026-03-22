// POST /api/celo-register
// Step 2: Takes the agent's ECDSA signature over the challenge hash,
// builds the Self Protocol QR with the agent address embedded,
// and returns the session token + modified deep link.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAddress } from 'viem';

const SELF_API = 'https://app.ai.self.xyz';

function buildAdvancedUserData(agentAddress: string, r: string, s: string, v: number): string {
  // Format: K + configDigit(0) + agentAddress(40 hex) + r(64) + s(64) + v(2)
  const addr = agentAddress.slice(2).toLowerCase().padStart(40, '0');
  const rHex = r.slice(2).toLowerCase().padStart(64, '0');
  const sHex = s.slice(2).toLowerCase().padStart(64, '0');
  const vHex = v.toString(16).padStart(2, '0');
  return 'K0' + addr + rHex + sHex + vHex;
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.agentAddress || !body?.humanAddress || !body?.signature) {
    throw error(400, 'Missing agentAddress, humanAddress, or signature');
  }
  if (!isAddress(body.agentAddress) || !isAddress(body.humanAddress)) {
    throw error(400, 'Invalid address format');
  }

  const sig = body.signature as string;
  if (!sig.startsWith('0x') || sig.length !== 132) {
    throw error(400, 'Invalid signature format — expected 65-byte hex string (0x + 130 chars)');
  }

  // Extract r, s, v from the signature
  const r = '0x' + sig.slice(2, 66);
  const s = '0x' + sig.slice(66, 130);
  let v = parseInt(sig.slice(130), 16);
  // Normalize v: some wallets return 0/1, EVM expects 27/28
  if (v < 27) v += 27;

  // Get a Self Protocol session (just for sessionId + WebSocket relay)
  const selfRes = await fetch(`${SELF_API}/api/agent/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'linked',
      network: 'mainnet',
      humanAddress: body.humanAddress,
      agentName: body.agentName || '',
      agentDescription: body.agentDescription || '',
    }),
  });

  if (!selfRes.ok) {
    const err = await selfRes.json().catch(() => ({}));
    throw error(502, err.error ?? `Self API error: ${selfRes.status}`);
  }

  const session = await selfRes.json();

  // Parse the selfApp data from the deep link
  const deepLinkUrl = new URL(session.deepLink);
  const selfAppParam = deepLinkUrl.searchParams.get('selfApp');
  if (!selfAppParam) throw error(502, 'Self API returned no selfApp in deepLink');

  const selfApp = JSON.parse(decodeURIComponent(selfAppParam));

  // Override userDefinedData with our agent's address + signature
  const userData = buildAdvancedUserData(body.agentAddress, r, s, v);
  selfApp.userDefinedData = userData;

  // Rebuild deep link with overridden data
  const newDeepLink = 'https://redirect.self.xyz?selfApp=' + encodeURIComponent(JSON.stringify(selfApp));

  return json({
    sessionToken: session.sessionToken,
    sessionId: selfApp.sessionId,
    deepLink: newDeepLink,
    scanUrl: session.scanUrl, // polling URL (if available)
    agentAddress: body.agentAddress,
    humanAddress: body.humanAddress,
    qrData: selfApp, // full selfApp data for client-side QR rendering
  });
};
