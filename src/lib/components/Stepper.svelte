<script lang="ts">
  export let steps: string[];
  export let current: number; // 0-indexed
</script>

<div class="stepper">
  {#each steps as step, i}
    <div class="step-item" class:done={i < current} class:active={i === current} class:upcoming={i > current}>
      <div class="step-circle">
        {#if i < current}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        {:else}
          {i + 1}
        {/if}
      </div>
      <span class="step-label">{step}</span>
    </div>
    {#if i < steps.length - 1}
      <div class="step-line" class:done={i < current}></div>
    {/if}
  {/each}
</div>

<style>
  .stepper {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 2.5rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }

  .step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .step-circle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 600;
    transition: all 0.2s;
    border: 2px solid var(--color-border);
    background: var(--color-bg-2);
    color: var(--color-text-muted);
  }

  .active .step-circle {
    border-color: var(--color-accent);
    background: var(--color-accent-dim);
    color: var(--color-accent);
  }

  .done .step-circle {
    border-color: var(--color-success);
    background: var(--color-success-dim);
    color: var(--color-success);
  }

  .step-label {
    font-size: 0.7rem;
    font-family: var(--font-heading);
    font-weight: 600;
    white-space: nowrap;
    color: var(--color-text-faint);
  }

  .active .step-label { color: var(--color-accent); }
  .done .step-label { color: var(--color-success); }

  .step-line {
    flex: 1;
    min-width: 2rem;
    height: 2px;
    background: var(--color-border);
    margin: 0 0.25rem;
    margin-bottom: 1.4rem;
    transition: background 0.2s;
  }
  .step-line.done { background: var(--color-success); }
</style>
