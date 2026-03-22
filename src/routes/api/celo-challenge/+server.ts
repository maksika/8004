// POST /api/celo-challenge
// Returns the challenge hash the agent must sign to prove it controls its ECDSA keypair.
// Step 1 of the ECDSA agent linking flow.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPublicClient, http, keccak256, encodePacked, isAddress } from 'viem';
import { celo } from '$lib/chains';

const REGISTRY = '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944' as `0x${string}`;

const client = createPublicClient({ chain: celo, transport: http() });

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.agentAddress || !body?.humanAddress) {
    throw error(400, 'Missing agentAddress or humanAddress');
  }
  if (!isAddress(body.agentAddress) || !isAddress(body.humanAddress)) {
    throw error(400, 'Invalid address format');
  }

  // Get the agent's current nonce from the registry
  let nonce = 0n;
  try {
    nonce = await client.readContract({
      address: REGISTRY,
      abi: [{ name: 'agentNonces', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
      functionName: 'agentNonces',
      args: [body.agentAddress as `0x${string}`],
    });
  } catch {
    // Nonce defaults to 0 for new agents
  }

  // Compute challenge hash: keccak256("self-agent-id:register:" + human + chainId + registry + nonce)
  const challengeHash = keccak256(encodePacked(
    ['string', 'address', 'uint256', 'address', 'uint256'],
    ['self-agent-id:register:', body.humanAddress as `0x${string}`, 42220n, REGISTRY, nonce]
  ));

  return json({
    challengeHash,
    nonce: nonce.toString(),
    agentAddress: body.agentAddress,
    humanAddress: body.humanAddress,
    registry: REGISTRY,
    chainId: 42220,
    instructions: 'Sign the challengeHash bytes with your ECDSA private key using personal_sign (signMessage with raw bytes). Then call POST /api/celo-register with the signature.',
  });
};
