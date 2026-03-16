<script lang="ts">
  import { connectWallet, disconnectWallet, walletAddress, isConnecting } from '$lib/wallet';

  function truncate(addr: string) {
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

  let dropdownOpen = false;

  function toggle() { dropdownOpen = !dropdownOpen; }
  function close() { dropdownOpen = false; }

  function handleDisconnect() {
    disconnectWallet();
    dropdownOpen = false;
  }

  function copyAddress() {
    if ($walletAddress) navigator.clipboard.writeText($walletAddress);
    dropdownOpen = false;
  }
</script>

<svelte:window on:click|capture={close} />

{#if $walletAddress}
  <div class="wallet-connected">
    <a href="/owner/{$walletAddress}" class="btn btn-secondary btn-sm">My Profile</a>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="wallet-pill" on:click|stopPropagation={toggle}>
      <span class="wallet-dot"></span>
      <span class="wallet-addr">{truncate($walletAddress)}</span>
      <svg class="chevron" class:open={dropdownOpen} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
    {#if dropdownOpen}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="dropdown" on:click|stopPropagation>
        <button class="dropdown-item" on:click={copyAddress}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy address
        </button>
        <button class="dropdown-item disconnect" on:click={handleDisconnect}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Disconnect
        </button>
      </div>
    {/if}
  </div>
{:else}
  <button class="btn btn-secondary btn-sm" on:click={connectWallet} disabled={$isConnecting}>
    {#if $isConnecting}
      Connecting…
    {:else}
      Connect Wallet
    {/if}
  </button>
{/if}

<style>
  .wallet-connected {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: relative;
  }

  .wallet-pill {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-family: var(--font-mono);
    color: var(--foreground);
    transition: border-color 150ms;
    user-select: none;
  }
  .wallet-pill:hover { border-color: color-mix(in srgb, var(--foreground) 30%, transparent); }

  .wallet-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--brand-offset-green);
    flex-shrink: 0;
  }

  .wallet-addr { letter-spacing: 0.02em; }

  .chevron { color: var(--muted-foreground); transition: transform 150ms; }
  .chevron.open { transform: rotate(180deg); }

  .dropdown {
    position: absolute;
    top: calc(100% + 0.4rem);
    right: 0;
    min-width: 160px;
    background: var(--popover);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 0.8);
    box-shadow: 0 8px 24px oklch(0 0 0 / 25%);
    z-index: 200;
    overflow: hidden;
    animation: dropIn 0.1s ease;
  }

  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: none; }
  }

  .dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.9rem;
    font-size: 0.85rem;
    font-family: var(--font-body);
    color: var(--foreground);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 100ms;
  }
  .dropdown-item:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); }
  .dropdown-item.disconnect { color: var(--destructive); }
  .dropdown-item.disconnect:hover { background: color-mix(in srgb, var(--destructive) 10%, transparent); }
</style>
