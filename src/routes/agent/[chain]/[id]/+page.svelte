<script lang="ts">
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
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

  const avatarUrl = meta.image || null;
  const initials = (meta.name ?? `A${id}`).slice(0, 2).toUpperCase();

  const ogTitle = `${meta.name ?? `Agent #${id}`} — wayMint`;
  const ogDesc = meta.description ? meta.description.slice(0, 160) : `Verified AI agent on ${chainLabel}`;

  let badgeTooltipOpen = false;

  onMount(async () => {
    const gsap = (await import('gsap')).default;
    const { ENTRANCE } = await import('$lib/animations.js');
    gsap.fromTo('.agent-header', ENTRANCE.fadeIn.from, { ...ENTRANCE.fadeIn.to, delay: 0.1 });
  });
</script>

<svelte:head>
  <title>{ogTitle}</title>
  <meta name="description" content={ogDesc} />

  <!-- OpenGraph -->
  <meta property="og:title" content={ogTitle} />
  <meta property="og:description" content={ogDesc} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://8004.way.je/agent/{chain}/{id}" />
  <meta property="og:image" content={avatarUrl ?? 'https://8004.way.je/waymint-social-banner.png'} />

  <!-- Twitter -->
  <meta name="twitter:card" content={avatarUrl ? 'summary' : 'summary_large_image'} />
  <meta name="twitter:title" content={ogTitle} />
  <meta name="twitter:description" content={ogDesc} />
  <meta name="twitter:image" content={avatarUrl ?? 'https://8004.way.je/waymint-social-banner.png'} />

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

<main class="main">
    <div class="container cert-layout">

      <!-- Header -->
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

        <!-- Details -->
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

        <!-- Endpoints -->
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

        <!-- On-chain data -->
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

        <!-- Trust -->
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

<style>
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
    border-bottom: 1px solid var(--border);
    position: relative;
  }

  .agent-avatar-wrap { flex-shrink: 0; }
  .agent-avatar { width: 72px; height: 72px; border-radius: 12px; object-fit: cover; border: 1px solid var(--border); }
  .agent-avatar-fallback {
    width: 72px; height: 72px; border-radius: 12px;
    background: color-mix(in srgb, var(--brand-offset-blue) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--brand-offset-blue) 30%, transparent);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-heading); font-weight: 700; font-size: 1.5rem;
    color: var(--brand-offset-blue);
  }

  .agent-meta { flex: 1; min-width: 0; }
  .agent-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .agent-name { font-size: 1.75rem; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
  .agent-description { color: var(--muted-foreground); font-size: 0.9rem; line-height: 1.5; }

  /* Verified badge (interactive) */
  .verified-badge {
    cursor: pointer;
    box-shadow: 0 0 8px color-mix(in srgb, var(--brand-offset-green) 25%, transparent);
    transition: box-shadow 0.2s;
  }
  .verified-badge:hover { box-shadow: 0 0 16px color-mix(in srgb, var(--brand-offset-green) 35%, transparent); }

  /* Tooltip */
  .verification-tooltip {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    z-index: 50;
    outline-color: color-mix(in srgb, var(--brand-offset-green) 30%, transparent);
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .verification-tooltip h3 { color: var(--brand-offset-green); margin-bottom: 0.5rem; font-size: 0.95rem; }
  .verification-tooltip p { font-size: 0.85rem; color: var(--muted-foreground); margin-bottom: 0.4rem; }
  .expiry-note { color: var(--brand-offset-yellow) !important; }
  .tooltip-close { position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; color: var(--muted-foreground); cursor: pointer; font-size: 1rem; }

  /* Body */
  .cert-body { display: flex; flex-direction: column; gap: 1rem; }
  .section-heading { font-size: 0.8rem; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted-foreground); margin-bottom: 1rem; }

  /* Details */
  .detail-list { display: flex; flex-direction: column; gap: 0; }
  .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px solid var(--border); font-size: 0.875rem; gap: 1rem; }
  .detail-row:last-child { border-bottom: none; }
  .detail-row dt { color: var(--muted-foreground); flex-shrink: 0; }
  .detail-row dd { text-align: right; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end; }
  .addr-link { color: var(--foreground); font-size: 0.85rem; }
  .addr-link:hover { color: var(--brand-offset-blue); }
  .ext-link { font-size: 0.8rem; }
  .ext-link-full { font-size: 0.85rem; }
  .small { font-size: 0.75rem; }
  .expiry-inline { font-size: 0.75rem; color: var(--muted-foreground); }

  /* Endpoints */
  .endpoints-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .endpoint-card { background: var(--muted); border-radius: 8px; padding: 0.75rem 1rem; }
  .endpoint-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; }
  .endpoint-protocol { font-size: 0.7rem; }
  .endpoint-version { font-size: 0.75rem; color: var(--muted-foreground); font-family: var(--font-mono); }
  .endpoint-url { font-size: 0.8rem; word-break: break-all; }

  /* Trust */
  .trust-badges { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
  .trust-badge { display: inline-flex; align-items: center; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: var(--muted); color: var(--muted-foreground); border: 1px solid var(--border); }
  .trust-badge.upcoming { opacity: 0.4; font-style: italic; }
  .trust-note { font-size: 0.8rem; color: var(--muted-foreground); }

  /* Footer */
  .back-row { display: flex; justify-content: space-between; margin-top: 2rem; font-size: 0.875rem; }
  .muted-link { color: var(--muted-foreground); }
  .muted-link:hover { color: var(--foreground); }
</style>
