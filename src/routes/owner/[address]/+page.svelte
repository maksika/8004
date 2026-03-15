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
