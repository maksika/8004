<script lang="ts">
  import { onMount } from 'svelte';

  type Agent = {
    agentId: number;
    chain: 'celo' | 'base';
    owner: string;
    name: string;
    description: string | null;
    image: string | null;
    registeredAt: number | null;
  };

  let agents: Agent[] = [];
  let loading = true;
  let error = '';
  let filter: 'all' | 'celo' | 'base' = 'all';

  $: filtered = filter === 'all' ? agents : agents.filter(a => a.chain === filter);

  function truncate(addr: string) {
    return addr ? addr.slice(0, 8) + '…' + addr.slice(-6) : '';
  }

  function formatDate(ts: number | null) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function initials(name: string) {
    return name.slice(0, 2).toUpperCase();
  }

  onMount(async () => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      agents = data.agents ?? [];
    } catch (e: any) {
      error = e.message ?? 'Failed to load agents';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>All Agents — wayMint</title>
  <meta name="description" content="Browse all AI agents registered on wayMint across Celo and Base chains." />
</svelte:head>

<main class="main">
  <div class="container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Registered Agents</h1>
        <p class="page-sub">All AI agents with verified on-chain identity across Celo and Base.</p>
      </div>
      <a href="/register" class="btn btn-primary">Register Agent &rarr;</a>
    </div>

    <!-- Filter tabs -->
    <div class="filter-tabs">
      <button class="filter-tab" class:active={filter === 'all'} on:click={() => filter = 'all'}>
        All {#if !loading}<span class="tab-count">{agents.length}</span>{/if}
      </button>
      <button class="filter-tab" class:active={filter === 'celo'} on:click={() => filter = 'celo'}>
        <span class="chain-dot chain-dot-celo"></span>Celo
        {#if !loading}<span class="tab-count">{agents.filter(a => a.chain === 'celo').length}</span>{/if}
      </button>
      <button class="filter-tab" class:active={filter === 'base'} on:click={() => filter = 'base'}>
        <span class="chain-dot chain-dot-base"></span>Base
        {#if !loading}<span class="tab-count">{agents.filter(a => a.chain === 'base').length}</span>{/if}
      </button>
    </div>

    <!-- States -->
    {#if loading}
      <div class="state-block">
        <div class="spinner"></div>
        <p>Fetching agents from chain…</p>
      </div>
    {:else if error}
      <div class="error-card card">
        <p>Failed to load agents: {error}</p>
        <button class="btn btn-secondary btn-sm" on:click={() => { loading = true; error = ''; onMount(() => {}); }}>
          Retry
        </button>
      </div>
    {:else if filtered.length === 0}
      <div class="state-block">
        <p class="muted">No agents registered yet{filter !== 'all' ? ` on ${filter}` : ''}.</p>
        <a href="/register" class="btn btn-primary btn-sm" style="margin-top: 1rem">Be the first →</a>
      </div>
    {:else}
      <div class="agents-grid">
        {#each filtered as agent (agent.chain + ':' + agent.agentId)}
          <a href="/agent/{agent.chain}/{agent.agentId}" class="agent-card card">
            <div class="agent-card-top">
              <div class="agent-avatar">
                {#if agent.image}
                  <img src={agent.image.startsWith('ipfs://') ? 'https://ipfs.io/ipfs/' + agent.image.slice(7) : agent.image}
                    alt={agent.name} class="avatar-img"
                    on:error={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                {:else}
                  <span class="avatar-initials">{initials(agent.name)}</span>
                {/if}
              </div>
              <div class="agent-meta">
                <div class="agent-id">#{agent.agentId}</div>
                <span class="badge {agent.chain === 'celo' ? 'badge-celo' : 'badge-base'}">
                  {agent.chain === 'celo' ? 'Celo' : 'Base'}
                </span>
              </div>
            </div>

            <h3 class="agent-name">{agent.name}</h3>
            {#if agent.description}
              <p class="agent-desc">{agent.description.length > 100 ? agent.description.slice(0, 97) + '…' : agent.description}</p>
            {/if}

            <div class="agent-footer">
              <span class="agent-owner" title={agent.owner}>{truncate(agent.owner)}</span>
              <span class="agent-date">{formatDate(agent.registeredAt)}</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</main>

<style>
  .main { flex: 1; padding: 3rem 0 5rem; }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }
  .page-title {
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    letter-spacing: -0.03em;
    margin-bottom: 0.35rem;
  }
  .page-sub { color: var(--muted-foreground); font-size: 0.95rem; }

  /* Filter tabs */
  .filter-tabs {
    display: flex;
    gap: 0.35rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0;
  }
  .filter-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-family: var(--font-heading);
    font-weight: 500;
    color: var(--muted-foreground);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: -1px;
    transition: color 150ms ease, border-color 150ms ease;
  }
  .filter-tab:hover { color: var(--foreground); }
  .filter-tab.active {
    color: var(--foreground);
    border-bottom-color: var(--foreground);
  }
  .tab-count {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }
  .chain-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    display: inline-block;
  }
  .chain-dot-celo { background: #fcff52; }
  .chain-dot-base { background: var(--brand-offset-blue); }

  /* Grid */
  .agents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.25rem;
  }

  /* Card */
  .agent-card {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    text-decoration: none;
    color: var(--card-foreground);
    transition: transform 150ms ease, box-shadow 150ms ease;
  }
  .agent-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px oklch(0 0 0 / 20%);
    text-decoration: none;
  }

  .agent-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .agent-avatar {
    width: 44px; height: 44px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--brand-offset-blue) 12%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .avatar-img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-initials {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 1rem;
    color: var(--brand-offset-blue);
  }
  .agent-meta { display: flex; align-items: center; gap: 0.5rem; }
  .agent-id {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--muted-foreground);
  }

  .agent-name {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.3;
    margin: 0;
  }
  .agent-desc {
    font-size: 0.83rem;
    color: var(--muted-foreground);
    line-height: 1.5;
    flex: 1;
    margin: 0;
  }

  .agent-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }
  .agent-owner {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }
  .agent-date {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  /* States */
  .state-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 4rem 2rem;
    color: var(--muted-foreground);
    font-size: 0.95rem;
  }
  .muted { color: var(--muted-foreground); }
  .error-card {
    max-width: 480px;
    margin: 2rem auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: var(--destructive);
    font-size: 0.875rem;
  }
</style>
