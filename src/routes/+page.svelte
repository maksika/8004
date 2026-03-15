<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let searchQuery = '';

  function handleSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    if (q.startsWith('0x') && q.length === 42) {
      goto(`/owner/${q}`);
    } else if (/^\d+$/.test(q)) {
      goto(`/agent/celo/${q}`);
    } else if (q.includes(':')) {
      const [chain, id] = q.split(':');
      if (chain && id) goto(`/agent/${chain}/${id}`);
    }
  }

  onMount(async () => {
    const gsap = (await import('gsap')).default;
    const { ENTRANCE } = await import('$lib/animations.js');

    gsap.fromTo('.hero-title', ENTRANCE.slideInUp.from, { ...ENTRANCE.slideInUp.to, delay: 0.1 });
    gsap.fromTo('.hero-sub', ENTRANCE.fadeIn.from, { ...ENTRANCE.fadeIn.to, delay: 0.3 });
    gsap.fromTo('.hero-cta', ENTRANCE.slideInUp.from, { ...ENTRANCE.slideInUp.to, delay: 0.4 });

    gsap.fromTo('.step-card', ENTRANCE.slideInUp.from, {
      ...ENTRANCE.slideInUp.to,
      stagger: 0.12,
      delay: 0.5,
    });
  });
</script>

<svelte:head>
  <title>wayMint — Verifiable AI Agent Identity</title>
  <meta name="description" content="Register your AI agent on-chain with ERC-8004. Proof-of-human verified, permanent, and shareable." />
</svelte:head>

<!-- Nav -->
<nav class="nav">
  <div class="container nav-inner">
    <a href="/" class="nav-brand">
      <svg viewBox="0 0 100 100" width="28" height="28">
        <polygon points="50,15 82,33 82,67 50,85 18,67 18,33" stroke="var(--brand-offset-blue)" stroke-width="5" fill="none"/>
        <circle cx="50" cy="50" r="8" fill="var(--brand-offset-blue)"/>
      </svg>
      <span class="nav-wordmark">wayMint</span>
    </a>
    <a href="/register" class="btn btn-primary btn-sm">Register Agent</a>
  </div>
</nav>

<!-- Hero -->
<section class="hero">
  <div class="container hero-inner">
    <div class="hero-badge">
      <span class="badge badge-base">ERC-8004</span>
      <span class="hero-badge-text">On-chain agent identity standard</span>
    </div>
    <h1 class="hero-title will-animate">
      Give your agent a<br /><span class="accent">verifiable identity.</span>
    </h1>
    <p class="hero-sub will-animate">
      Register your AI agent on Celo or Base. Attach proof-of-human verification.
      Get a permanent, shareable certificate that other agents and protocols can trust.
    </p>
    <div class="hero-ctas hero-cta will-animate">
      <a href="/register" class="btn btn-primary btn-lg">Register Agent</a>
      <a href="https://eips.ethereum.org/EIPS/eip-8004" target="_blank" rel="noopener" class="btn btn-secondary btn-lg">ERC-8004 Spec</a>
    </div>
    <form class="hero-search" on:submit|preventDefault={handleSearch}>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search by agent ID (e.g. 42), chain:id (celo:42), or owner address (0x...)"
        class="form-input hero-search-input"
      />
      <button type="submit" class="btn btn-primary btn-sm">Search</button>
    </form>
  </div>
</section>

<!-- How it works -->
<section class="section">
  <div class="container">
    <h2 class="section-title">How it works</h2>
    <div class="steps-grid">
      <div class="step-card card will-animate">
        <div class="step-number">1</div>
        <h3>Choose your chain</h3>
        <p>Deploy on <strong>Celo</strong> with Self-protocol proof-of-human, or on <strong>Base</strong> with Coinbase Verifications. Both use the ERC-8004 standard.</p>
      </div>
      <div class="step-card card will-animate">
        <div class="step-number">2</div>
        <h3>Describe your agent</h3>
        <p>Give your agent a name, description, and capabilities. This metadata is pinned to IPFS and linked on-chain via your agent's token URI.</p>
      </div>
      <div class="step-card card will-animate">
        <div class="step-number">3</div>
        <h3>Prove you're human & mint</h3>
        <p>Complete a quick verification — passport scan via Self or Coinbase attestation — then mint your agent's on-chain identity as an NFT.</p>
      </div>
    </div>
  </div>
</section>

<!-- What you get -->
<section class="section section-alt">
  <div class="container">
    <h2 class="section-title">What you get</h2>
    <div class="features-grid">
      <div class="feature-card card">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--brand-offset-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h3>Verified Human badge</h3>
        <p>Proof that a real person stands behind your agent. Verified via passport (Self) or Coinbase attestation. Renewable and on-chain.</p>
      </div>
      <div class="feature-card card">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--brand-offset-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <h3>Shareable certificate page</h3>
        <p>Every registered agent gets a unique URL at 8004.way.je showing its identity, metadata, verification status, and on-chain history.</p>
      </div>
      <div class="feature-card card">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--brand-offset-yellow)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <h3>On-chain & permanent</h3>
        <p>Your agent's identity is an ERC-721 token on a public blockchain. It can't be revoked, censored, or lost. Metadata is pinned on IPFS.</p>
      </div>
      <div class="feature-card card">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--brand-offset-coral)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h3>Owner profile</h3>
        <p>View all agents registered by a single wallet. Track verification status, manage agent wallets, and build a reputation as an agent operator.</p>
      </div>
    </div>
  </div>
</section>

<!-- For Agents section -->
<section class="agents-section">
  <div class="container">
    <div class="agents-inner card">
      <div class="agents-text">
        <div class="agents-eyebrow">🤖 For AI agents</div>
        <h2>Are you an agent?</h2>
        <p>wayMint is designed to be navigated by AI agents without human assistance. Read the <code>skill.md</code> at the root of this site for a complete API reference — registration flow, metadata pinning, on-chain lookup, and request signing.</p>
        <div class="agents-links">
          <a href="/skill.md" class="btn btn-primary btn-sm">Read skill.md →</a>
          <a href="/.well-known/agent-registration.json" class="btn btn-secondary btn-sm">agent-registration.json</a>
        </div>
      </div>
      <pre class="agents-code"><code>curl https://8004.way.je/skill.md</code></pre>
    </div>
  </div>
</section>

<!-- Footer -->
<footer class="footer">
  <div class="container footer-inner">
    <div class="footer-brand">
      <svg viewBox="0 0 100 100" width="20" height="20">
        <polygon points="50,15 82,33 82,67 50,85 18,67 18,33" stroke="var(--brand-offset-blue)" stroke-width="5" fill="none"/>
        <circle cx="50" cy="50" r="8" fill="var(--brand-offset-blue)"/>
      </svg>
      <span>wayMint</span>
    </div>
    <div class="footer-links">
      <a href="https://eips.ethereum.org/EIPS/eip-8004" target="_blank" rel="noopener">ERC-8004 Spec</a>
      <a href="https://docs.self.xyz" target="_blank" rel="noopener">Self Docs</a>
      <a href="https://www.coinbase.com/onchain-verify" target="_blank" rel="noopener">Coinbase Verifications</a>
      <a href="https://thesynthesis.ai" target="_blank" rel="noopener">The Synthesis</a>
      <a href="https://8004agents.ai" target="_blank" rel="noopener">8004agents.ai</a>
    </div>
  </div>
</footer>

<style>
  /* Nav */
  .nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: color-mix(in srgb, var(--background) 85%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
  }
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    color: var(--foreground);
  }
  .nav-brand:hover { text-decoration: none; }
  .nav-wordmark {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 1.15rem;
    letter-spacing: -0.02em;
  }

  /* Hero */
  .hero {
    padding: 5rem 0 4rem;
    text-align: center;
    background: radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--brand-offset-blue) 8%, transparent) 0%, transparent 60%);
  }
  .hero-inner { max-width: 720px; margin: 0 auto; }
  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .hero-badge-text {
    font-size: 0.85rem;
    color: var(--muted-foreground);
    font-family: var(--font-heading);
  }
  .hero-title {
    font-size: clamp(2.2rem, 5vw, 3.2rem);
    letter-spacing: -0.03em;
    margin-bottom: 1.25rem;
  }
  .accent { color: var(--brand-offset-blue); }
  .hero-sub {
    font-size: 1.1rem;
    color: var(--muted-foreground);
    max-width: 560px;
    margin: 0 auto 2rem;
    line-height: 1.7;
  }
  .hero-ctas {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 2.5rem;
  }
  .hero-search {
    display: flex;
    gap: 0.5rem;
    max-width: 560px;
    margin: 0 auto;
  }
  .hero-search-input {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  /* Sections */
  .section { padding: 4rem 0; }
  .section-alt { background: var(--card); }
  .section-title {
    text-align: center;
    font-size: 1.75rem;
    margin-bottom: 2.5rem;
    letter-spacing: -0.02em;
  }

  /* Steps grid */
  .steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.25rem;
  }
  .step-card { text-align: center; }
  .step-card h3 {
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
  }
  .step-card p {
    color: var(--muted-foreground);
    font-size: 0.9rem;
    line-height: 1.6;
  }
  .step-number {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--brand-offset-blue) 15%, transparent);
    color: var(--brand-offset-blue);
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
  }

  /* Features grid */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.25rem;
  }
  .feature-card h3 {
    font-size: 1rem;
    margin-bottom: 0.4rem;
  }
  .feature-card p {
    color: var(--muted-foreground);
    font-size: 0.88rem;
    line-height: 1.6;
  }
  .feature-icon { margin-bottom: 0.75rem; }

  /* Footer */
  .footer {
    border-top: 1px solid var(--border);
    padding: 2rem 0;
  }
  .footer-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .footer-brand {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--muted-foreground);
  }
  .footer-links {
    display: flex;
    gap: 1.25rem;
    flex-wrap: wrap;
  }
  .footer-links a {
    font-size: 0.85rem;
    color: var(--muted-foreground);
    transition: color 150ms ease;
  }
  .footer-links a:hover { color: var(--foreground); text-decoration: none; }

  /* For agents */
  .agents-section {
    padding: 4rem 0;
    border-top: 1px solid var(--border);
  }
  .agents-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    flex-wrap: wrap;
  }
  .agents-text { flex: 1; min-width: 280px; }
  .agents-eyebrow {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted-foreground);
    margin-bottom: 0.6rem;
    letter-spacing: 0.03em;
  }
  .agents-text h2 { margin-bottom: 0.75rem; }
  .agents-text p {
    color: var(--muted-foreground);
    font-size: 0.9rem;
    line-height: 1.6;
    margin-bottom: 1.25rem;
    max-width: 460px;
  }
  .agents-text p code {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    padding: 0.1em 0.35em;
    border-radius: 4px;
  }
  .agents-links { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .agents-code {
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 0.75);
    padding: 1rem 1.5rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--brand-offset-green);
    white-space: nowrap;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .hero { padding: 3rem 0 2.5rem; }
    .hero-search { flex-direction: column; }
    .footer-inner { flex-direction: column; text-align: center; }
    .footer-links { justify-content: center; }
    .agents-code { display: none; }
  }
</style>
