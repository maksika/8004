import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPublicClient, http, getAddress } from 'viem';
import { base, mainnet } from '$lib/chains';
import { consumeNonce } from '$lib/server/nonce-store';

const baseClient = createPublicClient({ chain: base, transport: http() });
const l1Client = createPublicClient({ chain: mainnet, transport: http() });

// Parse EIP-4361 SIWE message manually (avoids `siwe` pkg bundling issues on CF)
function parseSiweMessage(msg: string): {
  domain: string;
  address: string;
  chainId: number;
  nonce: string;
  expirationTime: string | null;
} | null {
  try {
    const lines = msg.split('\n');
    const domain = lines[0]?.split(' wants you to sign')[0]?.trim() ?? '';
    const address = lines[1]?.trim() ?? '';

    const chainIdMatch = msg.match(/^Chain ID:\s*(\d+)/m);
    const nonceMatch = msg.match(/^Nonce:\s*(\S+)/m);
    const expiryMatch = msg.match(/^Expiration Time:\s*(.+)/m);

    const chainId = chainIdMatch ? parseInt(chainIdMatch[1], 10) : 0;
    const nonce = nonceMatch ? nonceMatch[1].trim() : '';
    const expirationTime = expiryMatch ? expiryMatch[1].trim() : null;

    if (!domain || !address || !chainId || !nonce) return null;
    return { domain, address, chainId, nonce, expirationTime };
  } catch {
    return null;
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body || !body.message || !body.signature) {
    throw error(400, 'Missing message or signature');
  }

  const { message: messageStr, signature, claimedName } = body as {
    message: string;
    signature: string;
    claimedName?: string;
  };

  // Parse SIWE message (no external dependency)
  const siwe = parseSiweMessage(messageStr);
  if (!siwe) {
    throw error(400, 'Invalid SIWE message format');
  }

  // Validate domain and chainId
  if (siwe.domain !== '8004.way.je') {
    throw error(400, 'Invalid domain');
  }
  if (siwe.chainId !== 8453) {
    throw error(400, 'Invalid chainId — must be Base (8453)');
  }

  // Check expiry
  if (siwe.expirationTime) {
    if (new Date(siwe.expirationTime).getTime() < Date.now()) {
      throw error(400, 'SIWE message expired');
    }
  }

  // Verify nonce
  if (!siwe.nonce || !consumeNonce(siwe.nonce)) {
    throw error(400, 'Invalid or expired nonce');
  }

  const address = getAddress(siwe.address);

  // Verify signature using viem (handles both EOA and EIP-1271 Smart Wallets)
  let valid = false;
  try {
    valid = await baseClient.verifyMessage({
      address: address as `0x${string}`,
      message: messageStr,
      signature: signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }

  if (!valid) {
    throw error(401, 'Signature verification failed');
  }

  // Anti-spoofing: if claimedName provided, forward-resolve and compare
  let nameVerified = false;
  let resolvedName = claimedName ?? null;

  if (claimedName) {
    try {
      const resolved = await l1Client.getEnsAddress({ name: claimedName });
      if (resolved && getAddress(resolved) === address) {
        nameVerified = true;
      } else {
        resolvedName = null;
      }
    } catch {
      resolvedName = null;
    }
  }

  // Detect account type
  let accountType: 'eoa' | 'smart_wallet' = 'eoa';
  try {
    const code = await baseClient.getCode({ address: address as `0x${string}` });
    if (code && code !== '0x') accountType = 'smart_wallet';
  } catch {}

  return json({
    address,
    name: resolvedName,
    nameVerified,
    accountType,
    chainId: 8453,
    verifiedAt: new Date().toISOString(),
    method: 'siwe',
    domain: siwe.domain,
  });
};
