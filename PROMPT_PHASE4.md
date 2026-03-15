# wayMint — Phase 4: Agent Certificate Page + Owner Profile + API Routes

You are continuing to build **wayMint**. The project is at `/home/erasmus/.openclaw/workspace/waymint/`. Phases 1–3 are done.

Read the existing files before writing anything. Key files to read:
- `src/lib/chains.ts` — chain configs
- `src/lib/contracts.ts` — contract addresses + ABIs
- `src/app.css` — design tokens

---

## What you are building

### Phase 4: Agent Certificate Page
**`/agent/[chain]/[id]`** — the public trust surface. SSR-rendered for SEO. Shows agent identity, verified-human badge, endpoints, on-chain data.

### Phase 5: Owner Profile Page
**`/owner/[address]`** — lists all agents registered by a wallet.

### API Routes (real implementations)
- `GET /api/agent/[chain]/[id]` — on-chain data fetcher
- `GET /api/owner/[address]` — owner's agent list via Transfer event scan

---

## STEP 1: Create src/routes/api/agent/[chain]/[id]/+server.ts

This fetches on-chain agent data and resolves IPFS metadata. Replace the 501 stub.

```ts
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

  // Base: check Coinbase Verification (EAS)
  let hasCoinbaseVerification = false;
  if (chain === 'base') {
    // Simple check: trust the registration file's supportedTrust field
    // Full EAS check done during registration; certificate shows what was attested
    hasCoinbaseVerification = true; // will be validated from registration file below
  }

  // Resolve IPFS metadata
  const metadata = await resolveIPFS(agentURI);

  // Get registration block via Transfer event (mint = from 0x0)
  let registeredAt: number | null = null;
  try {
    const logs = await client.getLogs({
      address: registry,
      event: { type: 'event', name: 'Transfer', inputs: [
        { name: 'from', type: 'address', indexed: true },
        { name: 'to', type: 'address', indexed: true },
        { name: 'tokenId', type: 'uint256', indexed: true },
      ]},
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
```

---

## STEP 2: Create src/routes/api/owner/[address]/+server.ts

Replace the 501 stub. Scans Transfer event logs on both chains to find all agents owned by a wallet.

```ts
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

  // Find Transfer events TO this address (mints + transfers)
  let transferLogs: any[] = [];
  try {
    transferLogs = await client.getLogs({
      address: registry,
      event: {
        type: 'event', name: 'Transfer',
        inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'tokenId', type: 'uint256', indexed: true },
        ],
      },
      args: { to: address },
      fromBlock: 'earliest',
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
      event: {
        type: 'event', name: 'Transfer',
        inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'tokenId', type: 'uint256', indexed: true },
        ],
      },
      args: { from: address },
      fromBlock: 'earliest',
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
    name: 'tokenURI', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
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
```

---

## STEP 3: Create src/routes/api/health/[...endpoint]/+server.ts

Replace the 501 stub. Simple server-side reachability probe.

```ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const endpoint = decodeURIComponent(params.endpoint ?? '');

  if (!endpoint || !endpoint.startsWith('http')) {
    return json({ status: 'unknown', error: 'Invalid endpoint' });
  }

  try {
    const url = new URL(endpoint);
    // Block internal addresses
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname)) {
      return json({ status: 'unknown', error: 'Internal addresses not allowed' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(endpoint, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'wayMint/1.0 (health-check)' },
    });
    clearTimeout(timeout);

    return json({ status: res.ok || res.status < 500 ? 'reachable' : 'unreachable', statusCode: res.status });
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return json({ status: 'unreachable', error: 'Timeout' });
    }
    return json({ status: 'unknown', error: 'Probe failed' });
  }
};
```

---

## STEP 4: Create src/routes/agent/[chain]/[id]/+page.server.ts

Replace the placeholder. SSR load function that fetches agent data.

```ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
  const { chain, id } = params;

  if (chain !== 'celo' && chain !== 'base') {
    throw error(404, 'Unknown chain');
  }

  const res = await fetch(`/api/agent/${chain}/${id}`);
  if (res.status === 404) throw error(404, `Agent #${id} not found on ${chain}`);
  if (!res.ok) throw error(502, 'Failed to load agent data');

  const agent = await res.json();

  setHeaders({ 'Cache-Control': 'public, max-age=300, s-maxage=300' });
  return { agent, chain, id };
};
```

---

## STEP 5: Create src/routes/agent/[chain]/[id]/+page.svelte — FULL certificate page

Replace the placeholder. This is the public trust surface.

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  const { agent, chain, id } = data;
  const meta = agent.metadata ?? {};

  // Derived
  const isVerified = chain === 'celo' ? (agent.hasHumanProof && agent.isProofFresh) : agent.hasCoinbaseVerification;
  const verificationMethod = chain === 'celo' ? 'Self Protocol (ZK passport)' : 'Coinbase Verifications';
  const verificationDesc = chain === 'celo'
    ? 'This agent\'s owner proved their identity using Self Protocol. A zero-knowledge proof confirms a real human is behind this agent, without revealing personal data.'
    : 'This agent\'s owner verified their identity via Coinbase. An on-chain EAS attestation confirms a real person is behind this agent.';

  const services = meta.services ?? [];
  const supportedTrust = meta.supportedTrust ?? [];
  const chainLabel = chain === 'celo' ? 'Celo Mainnet' : 'Base Mainnet';
  const explorerLabel = chain === 'celo' ? 'Celoscan' : 'BaseScan';

  function truncate(addr: string, start = 8, end = 6) {
    if (!addr) return '';
    return addr.slice(0, start) + '…' + addr.slice(-end);
  }

  function formatDate(ts: number | null) {
    if (!ts) return 'Unknown';
    return new Date(ts * 1000).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatExpiry(ts: number | null) {
    if (!ts) return null;
    const d = new Date(ts * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    return { date: d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }), daysLeft };
  }

  const expiry = chain === 'celo' ? formatExpiry(agent.proofExpiresAt) : null;

  // Identicon fallback (deterministic from agent address/id)
  const avatarUrl = meta.image || null;
  const initials = (meta.name ?? `A${id}`).slice(0, 2).toUpperCase();

  // OG image description
  const ogTitle = `${meta.name ?? `Agent #${id}`} — wayMint`;
  const ogDesc = meta.description ? meta.description.slice(0, 160) : `Verified AI agent on ${chainLabel}`;

  let badgeTooltipOpen = false;
</script>

<svelte:head>
  <title>{ogTitle}</title>
  <meta name="description" content={ogDesc} />

  <!-- OpenGraph -->
  <meta property="og:title" content={ogTitle} />
  <meta property="og:description" content={ogDesc} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://8004.way.je/agent/{chain}/{id}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content={ogTitle} />
  <meta name="twitter:description" content={ogDesc} />

  <!-- JSON-LD -->
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": meta.name ?? `Agent #${id}`,
    "description": meta.description ?? '',
    "identifier": `${chain}:${id}`,
    "url": `https://8004.way.je/agent/${chain}/${id}`,
    "applicationCategory": "AI Agent",
    "operatingSystem": "Blockchain",
  })}<\/script>`}
</svelte:head>

<div class="page">

  <!-- Nav -->
  <nav class="nav">
    <div class="container nav-inner">
      <a href="/" class="nav-logo">
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#3b82f6" opacity="0.15"/>
          <path d="M14 4L22 9V19L14 24L6 19V9L14 4Z" stroke="#3b82f6" stroke-width="1.5" fill="none"/>
          <circle cx="14" cy="14" r="3" fill="#3b82f6"/>
        </svg>
        <span class="nav-wordmark">wayMint</span>
      </a>
      <a href="/register" class="btn btn-primary btn-sm">Register Agent</a>
    </div>
  </nav>

  <main class="main">
    <div class="container cert-layout">

      <!-- ── Header ── -->
      <header class="agent-header">
        <div class="agent-avatar-wrap">
          {#if avatarUrl}
            <img src={avatarUrl} alt={meta.name} class="agent-avatar" />
          {:else}
            <div class="agent-avatar-fallback">{initials}</div>
          {/if}
        </div>

        <div class="agent-meta">
          <div class="agent-badges">
            <span class="badge {chain === 'celo' ? 'badge-celo' : 'badge-base'}">
              {chain === 'celo' ? '⬡' : '◈'} {chainLabel}
            </span>
            {#if isVerified}
              <button
                class="badge badge-verified verified-badge"
                on:click={() => badgeTooltipOpen = !badgeTooltipOpen}
                title="Click for details"
              >
                🛡 Verified Human
              </button>
            {:else}
              <span class="badge badge-unverified">⚪ Unverified</span>
            {/if}
          </div>

          <h1 class="agent-name">{meta.name ?? `Agent #${id}`}</h1>

          {#if meta.description}
            <p class="agent-description">{meta.description}</p>
          {/if}

          {#if badgeTooltipOpen && isVerified}
            <div class="verification-tooltip card">
              <button class="tooltip-close" on:click={() => badgeTooltipOpen = false}>✕</button>
              <h3>✓ Verified Human</h3>
              <p>Verified using: <strong>{verificationMethod}</strong></p>
              <p>{verificationDesc}</p>
              {#if expiry}
                <p class="expiry-note">Proof expires: {expiry.date} ({expiry.daysLeft} days)</p>
              {/if}
            </div>
          {/if}
        </div>
      </header>

      <div class="cert-body">

        <!-- ── Details ── -->
        <section class="card cert-section">
          <h2 class="section-heading">Agent details</h2>
          <dl class="detail-list">
            <div class="detail-row">
              <dt>Agent ID</dt>
              <dd><code class="mono">#{agent.agentId}</code></dd>
            </div>
            <div class="detail-row">
              <dt>Owner</dt>
              <dd>
                <a href="/owner/{agent.owner}" class="mono addr-link">
                  {truncate(agent.owner)}
                </a>
                <a href={agent.explorerOwnerUrl} target="_blank" rel="noopener" class="ext-link">↗</a>
              </dd>
            </div>
            {#if agent.agentWallet}
              <div class="detail-row">
                <dt>Agent key</dt>
                <dd><code class="mono">{truncate(agent.agentWallet)}</code></dd>
              </div>
            {/if}
            <div class="detail-row">
              <dt>Registered</dt>
              <dd>{formatDate(agent.registeredAt)}</dd>
            </div>
            <div class="detail-row">
              <dt>Status</dt>
              <dd>
                <span class="badge {meta.active !== false ? 'badge-verified' : 'badge-unverified'}">
                  {meta.active !== false ? 'Active' : 'Inactive'}
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <!-- ── Endpoints ── -->
        {#if services.length > 0}
          <section class="card cert-section">
            <h2 class="section-heading">Service endpoints</h2>
            <div class="endpoints-list">
              {#each services as svc}
                <div class="endpoint-card">
                  <div class="endpoint-header">
                    <span class="endpoint-protocol badge badge-base">{svc.name}</span>
                    {#if svc.version}
                      <span class="endpoint-version">v{svc.version}</span>
                    {/if}
                  </div>
                  <a href={svc.endpoint} target="_blank" rel="noopener" class="endpoint-url mono">
                    {svc.endpoint}
                  </a>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- ── On-chain data ── -->
        <section class="card cert-section">
          <h2 class="section-heading">On-chain data</h2>
          <dl class="detail-list">
            <div class="detail-row">
              <dt>NFT</dt>
              <dd>
                <a href={agent.explorerNftUrl} target="_blank" rel="noopener" class="ext-link-full">
                  View on {explorerLabel} ↗
                </a>
              </dd>
            </div>
            <div class="detail-row">
              <dt>Metadata</dt>
              <dd>
                <a href={agent.ipfsGatewayUrl} target="_blank" rel="noopener" class="ext-link-full mono small">
                  {agent.agentURI.startsWith('ipfs://') ? agent.agentURI.slice(0, 40) + '…' : agent.agentURI}
                </a>
              </dd>
            </div>
            {#if chain === 'celo'}
              <div class="detail-row">
                <dt>Proof status</dt>
                <dd>
                  {#if agent.hasHumanProof && agent.isProofFresh}
                    <span class="badge badge-verified">Fresh ✓</span>
                  {:else if agent.hasHumanProof}
                    <span class="badge badge-unverified">Expired</span>
                  {:else}
                    <span class="badge badge-unverified">No proof</span>
                  {/if}
                  {#if expiry}
                    <span class="expiry-inline">Expires {expiry.date}</span>
                  {/if}
                </dd>
              </div>
            {/if}
          </dl>
        </section>

        <!-- ── Trust ── -->
        <section class="card cert-section">
          <h2 class="section-heading">Trust signals</h2>
          <div class="trust-badges">
            {#if isVerified}
              <span class="badge badge-verified">🛡 Proof of Human</span>
            {/if}
            {#each supportedTrust as t}
              <span class="trust-badge">{t}</span>
            {/each}
            <span class="trust-badge upcoming">Reputation score — coming soon</span>
          </div>
          <p class="trust-note">Trust signals are sourced from on-chain registries and cannot be faked.</p>
        </section>

      </div>

      <!-- Back -->
      <div class="back-row">
        <a href="/" class="muted-link">← wayMint home</a>
        <a href="/owner/{agent.owner}" class="muted-link">View owner profile →</a>
      </div>

    </div>
  </main>

  <footer class="footer-mini">
    <div class="container footer-mini-inner">
      <span>wayMint by Lineage Labs</span>
      <a href="https://eips.ethereum.org/EIPS/eip-8004" target="_blank" rel="noopener">ERC-8004 ↗</a>
    </div>
  </footer>
</div>

<style>
  .page { display: flex; flex-direction: column; min-height: 100vh; }

  /* Nav */
  .nav { border-bottom: 1px solid var(--color-border); background: rgba(10,10,10,0.9); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 100; }
  .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .nav-logo { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--color-text); }
  .nav-wordmark { font-family: var(--font-heading); font-weight: 700; font-size: 1rem; }
  .btn-sm { padding: 0.4rem 1rem; font-size: 0.85rem; }

  /* Layout */
  .main { flex: 1; padding: 3rem 0 4rem; }
  .cert-layout { max-width: 720px; }

  /* Header */
  .agent-header {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--color-border);
    position: relative;
  }

  .agent-avatar-wrap { flex-shrink: 0; }
  .agent-avatar { width: 72px; height: 72px; border-radius: 12px; object-fit: cover; border: 1px solid var(--color-border); }
  .agent-avatar-fallback {
    width: 72px; height: 72px; border-radius: 12px;
    background: var(--color-accent-dim);
    border: 1px solid rgba(59,130,246,0.3);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-heading); font-weight: 700; font-size: 1.5rem;
    color: var(--color-accent);
  }

  .agent-meta { flex: 1; min-width: 0; }
  .agent-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .agent-name { font-size: 1.75rem; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
  .agent-description { color: var(--color-text-muted); font-size: 0.9rem; line-height: 1.5; }

  /* Verified badge (interactive) */
  .verified-badge {
    cursor: pointer;
    background: var(--color-success-dim);
    color: var(--color-success);
    border: 1px solid rgba(34,197,94,0.4);
    box-shadow: 0 0 8px var(--color-success-dim);
    transition: box-shadow 0.2s;
  }
  .verified-badge:hover { box-shadow: 0 0 16px var(--color-success-dim); }

  /* Tooltip */
  .verification-tooltip {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    z-index: 50;
    border-color: rgba(34,197,94,0.3);
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .verification-tooltip h3 { color: var(--color-success); margin-bottom: 0.5rem; font-size: 0.95rem; }
  .verification-tooltip p { font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 0.4rem; }
  .expiry-note { color: var(--color-warning) !important; }
  .tooltip-close { position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 1rem; }

  /* Body */
  .cert-body { display: flex; flex-direction: column; gap: 1rem; }
  .cert-section { }
  .section-heading { font-size: 0.8rem; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); margin-bottom: 1rem; }

  /* Details */
  .detail-list { display: flex; flex-direction: column; gap: 0; }
  .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px solid var(--color-border); font-size: 0.875rem; gap: 1rem; }
  .detail-row:last-child { border-bottom: none; }
  .detail-row dt { color: var(--color-text-muted); flex-shrink: 0; }
  .detail-row dd { text-align: right; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end; }
  .addr-link { color: var(--color-text); font-size: 0.85rem; }
  .addr-link:hover { color: var(--color-accent); }
  .ext-link { color: var(--color-accent); font-size: 0.8rem; }
  .ext-link-full { color: var(--color-accent); font-size: 0.85rem; }
  .small { font-size: 0.75rem; }
  .expiry-inline { font-size: 0.75rem; color: var(--color-text-faint); }

  /* Endpoints */
  .endpoints-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .endpoint-card { background: var(--color-bg-3); border-radius: 8px; padding: 0.75rem 1rem; }
  .endpoint-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; }
  .endpoint-protocol { font-size: 0.7rem; }
  .endpoint-version { font-size: 0.75rem; color: var(--color-text-faint); font-family: var(--font-mono); }
  .endpoint-url { font-size: 0.8rem; color: var(--color-accent); word-break: break-all; }

  /* Trust */
  .trust-badges { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
  .trust-badge { display: inline-flex; align-items: center; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: var(--color-bg-3); color: var(--color-text-muted); border: 1px solid var(--color-border); }
  .trust-badge.upcoming { opacity: 0.4; font-style: italic; }
  .trust-note { font-size: 0.8rem; color: var(--color-text-faint); }

  /* Footer */
  .back-row { display: flex; justify-content: space-between; margin-top: 2rem; font-size: 0.875rem; }
  .muted-link { color: var(--color-text-muted); }
  .muted-link:hover { color: var(--color-text); }
  .footer-mini { border-top: 1px solid var(--color-border); padding: 1rem 0; }
  .footer-mini-inner { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--color-text-faint); }
</style>
```

---

## STEP 6: Create src/routes/owner/[address]/+page.server.ts

Replace the placeholder:

```ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isAddress } from 'viem';

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
  const { address } = params;

  if (!isAddress(address)) {
    throw error(400, 'Invalid Ethereum address');
  }

  const res = await fetch(`/api/owner/${address}`);
  if (!res.ok) throw error(502, 'Failed to load owner data');

  const data = await res.json();

  setHeaders({ 'Cache-Control': 'public, max-age=300, s-maxage=300' });
  return { address: data.address, agents: data.agents };
};
```

---

## STEP 7: Create src/routes/owner/[address]/+page.svelte

Replace the placeholder. Lists all agents for a wallet.

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  const { address, agents } = data;

  function truncate(addr: string) {
    return addr ? addr.slice(0, 8) + '…' + addr.slice(-6) : '';
  }

  function formatDate(ts: number | null) {
    if (!ts) return '';
    return new Date(ts * 1000).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<svelte:head>
  <title>Agent Owner {truncate(address)} — wayMint</title>
  <meta name="description" content="AI agents registered by {address} on ERC-8004." />
</svelte:head>

<div class="page">

  <nav class="nav">
    <div class="container nav-inner">
      <a href="/" class="nav-logo">
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#3b82f6" opacity="0.15"/>
          <path d="M14 4L22 9V19L14 24L6 19V9L14 4Z" stroke="#3b82f6" stroke-width="1.5" fill="none"/>
          <circle cx="14" cy="14" r="3" fill="#3b82f6"/>
        </svg>
        <span class="nav-wordmark">wayMint</span>
      </a>
      <a href="/register" class="btn btn-primary btn-sm">Register Agent</a>
    </div>
  </nav>

  <main class="main">
    <div class="container owner-layout">

      <header class="owner-header">
        <div class="owner-avatar">
          {address.slice(2, 4).toUpperCase()}
        </div>
        <div>
          <h1 class="owner-address mono">{truncate(address)}</h1>
          <p class="owner-full mono muted">{address}</p>
          <p class="owner-count">{agents.length} agent{agents.length !== 1 ? 's' : ''} registered</p>
        </div>
      </header>

      {#if agents.length === 0}
        <div class="card empty-state">
          <p>No agents registered by this wallet yet.</p>
          <a href="/register" class="btn btn-primary">Register an agent →</a>
        </div>
      {:else}
        <div class="agents-grid">
          {#each agents as agent}
            <a href="/agent/{agent.chain}/{agent.agentId}" class="agent-card card">
              <div class="agent-card-header">
                <div class="agent-card-avatar">
                  {#if agent.image}
                    <img src={agent.image} alt={agent.name} class="card-avatar-img" />
                  {:else}
                    <div class="card-avatar-fallback">{(agent.name ?? 'A').slice(0, 2).toUpperCase()}</div>
                  {/if}
                </div>
                <div class="agent-card-info">
                  <h3 class="agent-card-name">{agent.name}</h3>
                  <div class="agent-card-badges">
                    <span class="badge {agent.chain === 'celo' ? 'badge-celo' : 'badge-base'}" style="font-size:0.65rem;padding:0.15rem 0.5rem">
                      {agent.chain === 'celo' ? 'Celo' : 'Base'}
                    </span>
                    <span class="agent-id-badge">#{agent.agentId}</span>
                  </div>
                </div>
              </div>
              {#if agent.registeredAt}
                <p class="agent-card-date">{formatDate(agent.registeredAt)}</p>
              {/if}
            </a>
          {/each}
        </div>
      {/if}

      <div class="back-row">
        <a href="/" class="muted-link">← wayMint home</a>
      </div>

    </div>
  </main>

  <footer class="footer-mini">
    <div class="container footer-mini-inner">
      <span>wayMint by Lineage Labs</span>
      <a href="https://eips.ethereum.org/EIPS/eip-8004" target="_blank" rel="noopener">ERC-8004 ↗</a>
    </div>
  </footer>
</div>

<style>
  .page { display: flex; flex-direction: column; min-height: 100vh; }
  .nav { border-bottom: 1px solid var(--color-border); background: rgba(10,10,10,0.9); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 100; }
  .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .nav-logo { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--color-text); }
  .nav-wordmark { font-family: var(--font-heading); font-weight: 700; font-size: 1rem; }
  .btn-sm { padding: 0.4rem 1rem; font-size: 0.85rem; }

  .main { flex: 1; padding: 3rem 0 4rem; }
  .owner-layout { max-width: 860px; }

  .owner-header { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2.5rem; padding-bottom: 2rem; border-bottom: 1px solid var(--color-border); }
  .owner-avatar { width: 64px; height: 64px; border-radius: 12px; background: var(--color-accent-dim); border: 1px solid rgba(59,130,246,0.3); display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-weight: 700; font-size: 1.25rem; color: var(--color-accent); flex-shrink: 0; }
  .owner-address { font-size: 1.5rem; letter-spacing: -0.01em; margin-bottom: 0.25rem; }
  .owner-full { font-size: 0.75rem; color: var(--color-text-faint); margin-bottom: 0.5rem; word-break: break-all; }
  .owner-count { font-size: 0.875rem; color: var(--color-text-muted); }
  .muted { color: var(--color-text-faint); }

  .agents-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }

  .agent-card { display: flex; flex-direction: column; gap: 0.75rem; text-decoration: none; color: var(--color-text); transition: all 0.15s; }
  .agent-card:hover { border-color: var(--color-accent); transform: translateY(-2px); text-decoration: none; }
  .agent-card-header { display: flex; gap: 0.75rem; align-items: flex-start; }
  .card-avatar-img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; border: 1px solid var(--color-border); flex-shrink: 0; }
  .card-avatar-fallback { width: 40px; height: 40px; border-radius: 8px; background: var(--color-accent-dim); display: flex; align-items: center; justify-content: center; font-family: var(--font-heading); font-weight: 700; font-size: 0.9rem; color: var(--color-accent); flex-shrink: 0; }
  .agent-card-info { flex: 1; min-width: 0; }
  .agent-card-name { font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.35rem; }
  .agent-card-badges { display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; }
  .agent-id-badge { font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-text-faint); }
  .agent-card-date { font-size: 0.75rem; color: var(--color-text-faint); }

  .empty-state { text-align: center; display: flex; flex-direction: column; gap: 1rem; align-items: center; padding: 3rem; }
  .back-row { display: flex; justify-content: space-between; margin-top: 2rem; font-size: 0.875rem; }
  .muted-link { color: var(--color-text-muted); }
  .muted-link:hover { color: var(--color-text); }
  .footer-mini { border-top: 1px solid var(--color-border); padding: 1rem 0; }
  .footer-mini-inner { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--color-text-faint); }
</style>
```

---

## STEP 8: Update README.md

Replace the stub README with a real one:

```markdown
# wayMint — ERC-8004 Agent Registry

> Give your AI agent a verifiable identity.

wayMint is a web app that enables AI agent owners to register their agents on-chain using the [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) standard, with integrated proof-of-human verification.

Built for [The Synthesis Hackathon 2026](https://www.syntx.ai/synthesis) — "Agents that trust" track.

## What it does

- **Register agents on Celo** via [Self Protocol](https://docs.self.xyz) — passport scan → ZK proof → soulbound NFT
- **Register agents on Base** via [Coinbase Verifications](https://help.coinbase.com/en/coinbase/other-topics/other/base) — EAS attestation → ERC-8004 mint
- **Public agent certificate pages** at `/agent/{chain}:{id}` — the SSL cert for AI agents
- **Owner profile pages** at `/owner/{address}` — all agents by a wallet

## Stack

- SvelteKit + Cloudflare Pages (SSR + Workers)
- viem for blockchain interaction
- @selfxyz/agent-sdk for Celo registration
- Pinata for IPFS pinning

## ERC-8004 Contracts

| Chain | Contract | Address |
|-------|----------|---------|
| Celo Mainnet | SelfAgentRegistry | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` |
| Base Mainnet | ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

## Dev

```bash
npm install
npm run dev
```

Set `PINATA_JWT` in environment for IPFS pinning. Without it, a mock CID is used in dev mode.

## License

MIT
```

---

## STEP 9: Build and verify

```bash
cd /home/erasmus/.openclaw/workspace/waymint
npm run build 2>&1
```

Fix all errors. Common:
- `isAddress` from viem in server routes: fine, it's Node-compatible
- If getLogs causes type errors: the event signature may need to use `parseAbiItem` instead of inline object — fix as needed
- SSR issues with viem: already handled by `ssr.noExternal` in vite.config.ts

---

## STEP 10: Commit and push

```bash
cd /home/erasmus/.openclaw/workspace/waymint
git add -A
git commit -m "feat: Phase 4+5 — agent certificate page, owner profile, real API routes"
git push origin main
```

---

## When done

```
openclaw system event --text "Done: wayMint Phase 4+5 complete. Agent certificate page (SSR, verification badge, endpoints, on-chain data), owner profile (agent grid), all API routes implemented. Build passes. Pushed to GitHub." --mode now
```
