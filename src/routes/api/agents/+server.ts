// API: list all registered agents across Celo and Base
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPublicClient, http, parseAbi } from 'viem';
import { celo, base } from '$lib/chains';

const REGISTRIES = {
  celo: '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944' as `0x${string}`,
  base: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`,
};

const DEPLOY_BLOCKS = { celo: 60900000n, base: 25000000n };

const ERC721_ABI = parseAbi([
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);

async function resolveMetadata(uri: string): Promise<{ name?: string; description?: string; image?: string }> {
  if (!uri || !uri.trim()) return {};
  const url = uri.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${uri.slice(7)}` : uri;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return {};
    return res.json().catch(() => ({}));
  } catch {
    return {};
  }
}

async function getRegistryAgents(
  client: ReturnType<typeof createPublicClient>,
  registry: `0x${string}`,
  chain: 'celo' | 'base',
  fromBlock: bigint,
) {
  let mintLogs: any[] = [];
  try {
    mintLogs = await client.getLogs({
      address: registry,
      event: {
        type: 'event', name: 'Transfer', inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'tokenId', type: 'uint256', indexed: true },
        ],
      },
      args: { from: '0x0000000000000000000000000000000000000000' },
      fromBlock,
      toBlock: 'latest',
    });
  } catch {
    return [];
  }

  const agents: any[] = [];
  const BATCH = 10;

  for (let i = 0; i < mintLogs.length; i += BATCH) {
    const batch = mintLogs.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(async (log) => {
      const agentId = Number(log.args.tokenId);

      let owner = '';
      let uri = '';
      try {
        [owner, uri] = await Promise.all([
          client.readContract({ address: registry, abi: ERC721_ABI, functionName: 'ownerOf', args: [log.args.tokenId] }),
          client.readContract({ address: registry, abi: ERC721_ABI, functionName: 'tokenURI', args: [log.args.tokenId] }),
        ]);
      } catch { return null; }

      const meta = await resolveMetadata(uri);

      let registeredAt: number | null = null;
      try {
        if (log.blockNumber) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          registeredAt = Number(block.timestamp);
        }
      } catch {}

      return {
        agentId,
        chain,
        owner,
        name: meta.name || `Agent #${agentId}`,
        description: meta.description || null,
        image: meta.image || null,
        registeredAt,
      };
    }));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) agents.push(r.value);
    }
  }

  return agents;
}

async function getChainAgents(chain: 'celo' | 'base') {
  const client = createPublicClient({
    chain: chain === 'celo' ? celo : base,
    transport: http(),
  });
  const fromBlock = DEPLOY_BLOCKS[chain];

  return getRegistryAgents(client, REGISTRIES[chain], chain, fromBlock);
}

export const GET: RequestHandler = async ({ setHeaders }) => {
  const [celoAgents, baseAgents] = await Promise.all([
    getChainAgents('celo'),
    getChainAgents('base'),
  ]);

  const all = [...celoAgents, ...baseAgents].sort(
    (a, b) => (b.registeredAt ?? 0) - (a.registeredAt ?? 0)
  );

  setHeaders({ 'Cache-Control': 'public, max-age=120, s-maxage=120' });
  return json({ total: all.length, agents: all });
};
