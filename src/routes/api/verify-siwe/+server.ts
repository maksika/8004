import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SiweMessage } from 'siwe';
import { createPublicClient, http, getAddress } from 'viem';
import { base, mainnet } from '$lib/chains';
import { consumeNonce } from '$lib/server/nonce-store';

const baseClient = createPublicClient({ chain: base, transport: http() });
const l1Client = createPublicClient({ chain: mainnet, transport: http() });

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

  // Parse SIWE message
  let siwe: SiweMessage;
  try {
    siwe = new SiweMessage(messageStr);
  } catch {
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
    const exp = new Date(siwe.expirationTime);
    if (exp.getTime() < Date.now()) {
      throw error(400, 'SIWE message expired');
    }
  }

  // Verify nonce
  if (!siwe.nonce || !consumeNonce(siwe.nonce)) {
    throw error(400, 'Invalid or expired nonce');
  }

  const address = getAddress(siwe.address);

  // Verify signature using viem (handles both EOA and EIP-1271 Smart Wallets)
  let valid: boolean;
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
        nameVerified = false;
      }
    } catch {
      resolvedName = null;
      nameVerified = false;
    }
  }

  // Detect account type
  let accountType: 'eoa' | 'smart_wallet' = 'eoa';
  try {
    const code = await baseClient.getCode({ address: address as `0x${string}` });
    if (code && code !== '0x') {
      accountType = 'smart_wallet';
    }
  } catch {}

  // Identity assertion (PRD §6.5)
  const assertion = {
    address,
    name: resolvedName,
    nameVerified,
    accountType,
    chainId: 8453,
    verifiedAt: new Date().toISOString(),
    method: 'siwe',
    domain: siwe.domain,
  };

  return json(assertion);
};
