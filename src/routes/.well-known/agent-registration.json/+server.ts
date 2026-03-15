import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// ERC-8004 §7: Domain verification endpoint
// Mirrors the IPFS registration file at a well-known URL so the domain
// itself can be verified as the agent's canonical home.
// See: https://eips.ethereum.org/EIPS/eip-8004#domain-verification

export const GET: RequestHandler = async ({ url, fetch, request }) => {
  // Accept an optional ?chain=celo|base&id=N query to return a specific agent's file
  const chain = url.searchParams.get('chain');
  const id = url.searchParams.get('id');

  if (chain && id) {
    // Proxy the specific agent's registration file from IPFS via our API
    const res = await fetch(`/api/agent/${chain}/${id}`);
    if (!res.ok) {
      return json({ error: 'Agent not found' }, { status: 404 });
    }
    const agent = await res.json();
    const meta = agent.metadata;

    if (!meta) {
      return json({ error: 'No metadata found for agent' }, { status: 404 });
    }

    return json(meta, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  // Default: return the wayMint platform registration descriptor
  // This tells ERC-8004 verifiers what this domain is and what it hosts
  const registration = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#domain-v1',
    name: 'wayMint',
    description: 'ERC-8004 agent registration and certificate platform by Lineage Labs. Supports agent registration with proof-of-human verification on Celo and Base.',
    url: 'https://8004.way.je',
    registries: [
      {
        chain: 'eip155:42220',
        name: 'SelfAgentRegistry (Celo)',
        address: '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944',
        proofOfHuman: true,
        proofProvider: '0x4b036aFD959B457A208F676cf44Ea3ef73Ea3E3d',
      },
      {
        chain: 'eip155:8453',
        name: 'ERC-8004 Identity Registry (Base)',
        address: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
        proofOfHuman: false,
      },
    ],
    agentCertificateUrl: 'https://8004.way.je/agent/{chain}:{id}',
    ownerProfileUrl: 'https://8004.way.je/owner/{address}',
  };

  return json(registration, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
