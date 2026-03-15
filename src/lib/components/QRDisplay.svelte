<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';

  export let value: string;
  export let size: number = 260;
  export let status: 'waiting' | 'connected' | 'generating' | 'done' | 'error' = 'waiting';

  let canvas: HTMLCanvasElement;
  let QRCode: any;

  async function renderQR() {
    if (!canvas || !value || !QRCode) return;
    try {
      await QRCode.toCanvas(canvas, value, {
        width: size,
        margin: 2,
        color: { dark: '#e8e5de', light: '#1a1f44' },
      });
    } catch (e) {
      console.error('[QRDisplay] render error:', e);
    }
  }

  onMount(async () => {
    QRCode = (await import('qrcode')).default;
    await renderQR();
  });

  afterUpdate(async () => {
    if (QRCode && canvas && value) await renderQR();
  });

  const statusLabels: Record<string, string> = {
    waiting: '⏳ Waiting for Self app scan...',
    connected: '📱 Phone connected — follow prompts in app',
    generating: '🔄 Generating ZK proof...',
    done: '✅ Verified!',
    error: '❌ Verification failed',
  };

  const statusColors: Record<string, string> = {
    waiting: 'var(--muted-foreground)',
    connected: 'var(--brand-offset-yellow)',
    generating: 'var(--brand-offset-blue)',
    done: 'var(--brand-offset-green)',
    error: 'var(--destructive)',
  };
</script>

<div class="qr-wrapper">
  <div class="qr-canvas-wrap" class:verified={status === 'done'} class:errored={status === 'error'}>
    {#if status === 'done'}
      <div class="state-overlay done-overlay">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--brand-offset-green)" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
      </div>
    {:else if status === 'error'}
      <div class="state-overlay error-overlay">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--destructive)" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
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
    border: 1px solid var(--border);
    position: relative;
    background: #1a1f44;
  }

  .qr-canvas-wrap.verified {
    border-color: var(--brand-offset-green);
    box-shadow: 0 0 20px color-mix(in srgb, var(--brand-offset-green) 25%, transparent);
  }

  .qr-canvas-wrap.errored {
    border-color: var(--destructive);
  }

  .state-overlay {
    width: 260px;
    height: 260px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--card);
  }

  .qr-status {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .qr-hint {
    font-size: 0.8rem;
    color: var(--muted-foreground);
    text-align: center;
  }
</style>
