import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPublicClient, http, parseAbi } from 'viem';
import { celo, base } from '$lib/chains';

const REGISTRIES = {
  celo: '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944' as `0x${string}`,
  base: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`,
};

const BASE_ABI = parseAbi([
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function getAgentWallet(uint256 agentId) external view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);

const CELO_EXTRA_ABI = parseAbi([
  'function hasHumanProof(uint256 agentId) external view returns (bool)',
  'function isProofFresh(uint256 agentId) external view returns (bool)',
  'function proofExpiresAt(uint256 agentId) external view returns (uint256)',
]);

async function resolveIPFS(uri: string): Promise<any> {
  let url = uri;
  if (uri.startsWith('ipfs://')) {
    url = `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export const GET: RequestHandler = async ({ params, setHeaders }) => {
  const { chain, id } = params;

  if (chain !== 'celo' && chain !== 'base') {
    throw error(400, `Unknown chain: ${chain}`);
  }

  const agentId = parseInt(id, 10);
  if (isNaN(agentId) || agentId < 0) {
    throw error(400, 'Invalid agent ID');
  }

  const viemChain = chain === 'celo' ? celo : base;
  const registry = REGISTRIES[chain];

  const client = createPublicClient({
    chain: viemChain,
    transport: http(),
  });

  // Fetch on-chain data
  let owner: string;
  let agentURI: string;

  try {
    [owner, agentURI] = await Promise.all([
      client.readContract({ address: registry, abi: BASE_ABI, functionName: 'ownerOf', args: [BigInt(agentId)] }),
      client.readContract({ address: registry, abi: BASE_ABI, functionName: 'tokenURI', args: [BigInt(agentId)] }),
    ]);
  } catch (e: any) {
    if (e.message?.includes('ERC721NonexistentToken') || e.message?.includes('revert')) {
      throw error(404, `Agent #${agentId} not found on ${chain}`);
    }
    throw error(502, 'Failed to fetch on-chain data');
  }

  // Resolve agent wallet (operational key)
  let agentWallet: string | null = null;
  try {
    agentWallet = await client.readContract({
      address: registry,
      abi: BASE_ABI,
      functionName: 'getAgentWallet',
      args: [BigInt(agentId)],
    });
    if (agentWallet === '0x0000000000000000000000000000000000000000') agentWallet = null;
  } catch {}

  // Celo: fetch proof data
  let hasHumanProof = false;
  let isProofFresh = false;
  let proofExpiresAt: number | null = null;

  if (chain === 'celo') {
    try {
      [hasHumanProof, isProofFresh, proofExpiresAt] = await Promise.all([
        client.readContract({ address: registry, abi: CELO_EXTRA_ABI, functionName: 'hasHumanProof', args: [BigInt(agentId)] }),
        client.readContract({ address: registry, abi: CELO_EXTRA_ABI, functionName: 'isProofFresh', args: [BigInt(agentId)] }),
        client.readContract({ address: registry, abi: CELO_EXTRA_ABI, functionName: 'proofExpiresAt', args: [BigInt(agentId)] }).then(Number),
      ]);
    } catch {}
  }

  // Resolve IPFS metadata
  const metadata = await resolveIPFS(agentURI);

  // Get registration block via Transfer event (mint = from 0x0)
  let registeredAt: number | null = null;
  try {
    const logs = await client.getLogs({
      address: registry,
      event: {
        type: 'event', name: 'Transfer', inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'tokenId', type: 'uint256', indexed: true },
        ],
      },
      args: { from: '0x0000000000000000000000000000000000000000', tokenId: BigInt(agentId) },
      fromBlock: 'earliest',
      toBlock: 'latest',
    });
    if (logs.length > 0 && logs[0].blockNumber) {
      const block = await client.getBlock({ blockNumber: logs[0].blockNumber });
      registeredAt = Number(block.timestamp);
    }
  } catch {}

  const explorerBase = chain === 'celo' ? 'https://celoscan.io' : 'https://basescan.org';

  const result = {
    agentId,
    chain,
    owner,
    agentWallet,
    agentURI,
    metadata,
    hasHumanProof,
    isProofFresh,
    proofExpiresAt,
    hasCoinbaseVerification: chain === 'base',
    registeredAt,
    explorerNftUrl: `${explorerBase}/token/${registry}?a=${agentId}`,
    explorerOwnerUrl: `${explorerBase}/address/${owner}`,
    ipfsGatewayUrl: agentURI.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${agentURI.slice(7)}` : agentURI,
  };

  setHeaders({ 'Cache-Control': 'public, max-age=300, s-maxage=300' });
  return json(result);
};
