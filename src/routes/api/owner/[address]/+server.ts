import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPublicClient, http, isAddress } from 'viem';
import { celo, base } from '$lib/chains';

const REGISTRIES = {
  celo: '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944' as `0x${string}`,
  base: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`,
};

interface AgentSummary {
  agentId: number;
  chain: string;
  agentURI: string;
  name: string;
  image?: string;
  registeredAt: number | null;
}

async function getAgentsForChain(chain: 'celo' | 'base', address: `0x${string}`): Promise<AgentSummary[]> {
  const viemChain = chain === 'celo' ? celo : base;
  const registry = REGISTRIES[chain];

  const client = createPublicClient({ chain: viemChain, transport: http() });

  const transferEvent = {
    type: 'event' as const,
    name: 'Transfer' as const,
    inputs: [
      { name: 'from', type: 'address' as const, indexed: true },
      { name: 'to', type: 'address' as const, indexed: true },
      { name: 'tokenId', type: 'uint256' as const, indexed: true },
    ],
  };

  // Use known deployment blocks to avoid scanning from genesis (times out on Celo)
  // Celo SelfAgentRegistry deployed ~Feb 2026, Base registry similar era
  const DEPLOY_BLOCK: Record<string, bigint> = {
    celo: 60900000n,  // ~Feb 2026 on Celo mainnet (~61M blocks total as of Mar 2026)
    base: 25000000n,  // ~Feb 2026 on Base mainnet
  };
  const fromBlock = DEPLOY_BLOCK[chain] ?? 0n;

  // Find Transfer events TO this address (mints + transfers)
  let transferLogs: any[] = [];
  try {
    transferLogs = await client.getLogs({
      address: registry,
      event: transferEvent,
      args: { to: address },
      fromBlock,
      toBlock: 'latest',
    });
  } catch {
    return [];
  }

  // Also find transfers OUT (sold/transferred away)
  let transferOutLogs: any[] = [];
  try {
    transferOutLogs = await client.getLogs({
      address: registry,
      event: transferEvent,
      args: { from: address },
      fromBlock,
      toBlock: 'latest',
    });
  } catch {}

  // Tokens transferred out
  const transferredOut = new Set(transferOutLogs.map((l: any) => l.args.tokenId?.toString()));
  // Current tokens: received but not sent away
  const ownedTokenIds = [...new Set(
    transferLogs
      .filter((l: any) => !transferredOut.has(l.args.tokenId?.toString()))
      .map((l: any) => l.args.tokenId)
  )];

  if (ownedTokenIds.length === 0) return [];

  // Fetch tokenURI for each
  const ERC721_ABI = [{
    name: 'tokenURI' as const,
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [{ name: 'tokenId', type: 'uint256' as const }],
    outputs: [{ name: '', type: 'string' as const }],
  }] as const;

  const results: AgentSummary[] = [];

  await Promise.allSettled(
    ownedTokenIds.map(async (tokenId) => {
      const agentId = Number(tokenId);
      let uri = '';
      try {
        uri = await client.readContract({
          address: registry,
          abi: ERC721_ABI,
          functionName: 'tokenURI',
          args: [tokenId as bigint],
        });
      } catch { return; }

      let name = `Agent #${agentId}`;
      let image: string | undefined;

      // Try to resolve IPFS metadata
      try {
        const url = uri.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${uri.slice(7)}` : uri;
        const meta = await fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null);
        if (meta?.name) name = meta.name;
        if (meta?.image) image = meta.image;
      } catch {}

      // Find registration timestamp
      let registeredAt: number | null = null;
      try {
        const mintLog = transferLogs.find((l: any) =>
          l.args.tokenId?.toString() === tokenId?.toString() &&
          l.args.from === '0x0000000000000000000000000000000000000000'
        );
        if (mintLog?.blockNumber) {
          const block = await client.getBlock({ blockNumber: mintLog.blockNumber });
          registeredAt = Number(block.timestamp);
        }
      } catch {}

      results.push({ agentId, chain, agentURI: uri, name, image, registeredAt });
    })
  );

  return results.sort((a, b) => (b.registeredAt ?? 0) - (a.registeredAt ?? 0));
}

export const GET: RequestHandler = async ({ params, setHeaders }) => {
  const { address } = params;

  if (!isAddress(address)) {
    throw error(400, 'Invalid Ethereum address');
  }

  const addr = address.toLowerCase() as `0x${string}`;

  const [celoAgents, baseAgents] = await Promise.all([
    getAgentsForChain('celo', addr),
    getAgentsForChain('base', addr),
  ]);

  const allAgents = [...celoAgents, ...baseAgents].sort(
    (a, b) => (b.registeredAt ?? 0) - (a.registeredAt ?? 0)
  );

  setHeaders({ 'Cache-Control': 'public, max-age=300, s-maxage=300' });
  return json({ address: addr, agents: allAgents });
};
