<script lang="ts">
  import QRCode from 'qrcode';

  export let value: string;
  export let size: number = 260;
  export let status: 'waiting' | 'connected' | 'generating' | 'done' | 'error' = 'waiting';

  let canvas: HTMLCanvasElement;

  $: if (canvas && value) {
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 2,
      color: { dark: '#e0e0e0', light: '#111111' },
    }).catch(console.error);
  }

  const statusLabels: Record<string, string> = {
    waiting: 'Waiting for Self app scan...',
    connected: 'Phone connected — follow prompts in the app',
    generating: 'Generating ZK proof...',
    done: 'Verified!',
    error: 'Verification failed',
  };

  const statusColors: Record<string, string> = {
    waiting: 'var(--color-text-muted)',
    connected: 'var(--color-warning)',
    generating: 'var(--color-accent)',
    done: 'var(--color-success)',
    error: 'var(--color-danger)',
  };
</script>

<div class="qr-wrapper">
  <div class="qr-canvas-wrap" class:verified={status === 'done'}>
    {#if status === 'done'}
      <div class="done-overlay">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
      </div>
    {:else}
      <canvas bind:this={canvas} width={size} height={size}></canvas>
    {/if}
  </div>
  <p class="qr-status" style="color: {statusColors[status]}">{statusLabels[status]}</p>
  {#if status === 'waiting'}
    <p class="qr-hint">Open the Self app on your phone and scan this code</p>
  {/if}
</div>

<style>
  .qr-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .qr-canvas-wrap {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    position: relative;
  }

  .qr-canvas-wrap.verified {
    border-color: var(--color-success);
    box-shadow: 0 0 20px var(--color-success-dim);
  }

  .done-overlay {
    width: 260px;
    height: 260px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-2);
  }

  .qr-status {
    font-family: var(--font-heading);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .qr-hint {
    font-size: 0.8rem;
    color: var(--color-text-faint);
    text-align: center;
  }
</style>
