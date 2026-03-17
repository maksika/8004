<script lang="ts">
  import '../app.css';
  import WalletButton from '$lib/components/WalletButton.svelte';
</script>

<div class="site-shell">

  <div class="beta-banner">
    <span class="beta-badge">Public Beta</span>
    wayMint is in early development. Use on mainnet at your own risk.
  </div>

  <header class="site-header">
    <div class="container header-inner">
      <a href="/" class="header-brand">
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="var(--brand-offset-blue)" opacity="0.15"/>
          <path d="M14 4L22 9V19L14 24L6 19V9L14 4Z" stroke="var(--brand-offset-blue)" stroke-width="1.5" fill="none"/>
          <circle cx="14" cy="14" r="3" fill="var(--brand-offset-blue)"/>
        </svg>
        <span class="header-wordmark">wayMint</span>
      </a>
      <nav class="header-nav">
        <a href="/register" class="btn btn-primary btn-sm">Register Agent</a>
        <WalletButton />
      </nav>
    </div>
  </header>

  <main class="site-main">
    <slot />
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <span class="footer-wordmark">wayMint</span>
        <span class="footer-sub">by Lineage Labs · <a href="https://lineage.fyi" target="_blank" rel="noopener">lineage.fyi</a></span>
      </div>
      <div class="footer-links">
        <a href="https://eips.ethereum.org/EIPS/eip-8004" target="_blank" rel="noopener">ERC-8004 Spec</a>
        <a href="https://docs.self.xyz" target="_blank" rel="noopener">Self Docs</a>
        <a href="https://www.coinbase.com/onchain-verify" target="_blank" rel="noopener">Coinbase Verifications</a>
        <a href="https://thesynthesis.ai" target="_blank" rel="noopener">The Synthesis</a>
        <a href="/skill.md" target="_blank">skill.md</a>
      </div>
    </div>
  </footer>

</div>

<style>
  .site-shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  /* ── Beta banner ── */
  .beta-banner {
    background: color-mix(in srgb, var(--brand-offset-yellow) 12%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--brand-offset-yellow) 30%, transparent);
    color: var(--brand-offset-yellow);
    text-align: center;
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
    font-family: var(--font-body);
    line-height: 1.4;
  }
  .beta-badge {
    display: inline-block;
    background: var(--brand-offset-yellow);
    color: var(--background);
    font-size: 0.65rem;
    font-weight: 700;
    font-family: var(--font-heading);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    margin-right: 0.5rem;
    vertical-align: middle;
  }

  /* ── Header ── */
  .site-header {
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--background) 85%, transparent);
    backdrop-filter: blur(12px);
    flex-shrink: 0;
  }
  .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    color: var(--foreground);
  }
  .header-brand:hover { text-decoration: none; }
  .header-wordmark {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: -0.01em;
  }
  .header-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ── Main ── */
  .site-main {
    flex: 1;
  }

  /* ── Footer ── */
  .site-footer {
    border-top: 1px solid var(--border);
    padding: 1.5rem 0;
    flex-shrink: 0;
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
    flex-direction: column;
    gap: 0.15rem;
  }
  .footer-wordmark {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--foreground);
  }
  .footer-sub {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }
  .footer-sub a { color: var(--muted-foreground); }
  .footer-sub a:hover { color: var(--foreground); }
  .footer-links {
    display: flex;
    gap: 1.25rem;
    flex-wrap: wrap;
  }
  .footer-links a {
    font-size: 0.82rem;
    color: var(--muted-foreground);
    transition: color 150ms;
  }
  .footer-links a:hover { color: var(--foreground); text-decoration: none; }

  @media (max-width: 600px) {
    .footer-inner { flex-direction: column; }
    .footer-links { gap: 0.75rem; }
  }
</style>
