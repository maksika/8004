<script lang="ts">
  import { page } from '$app/stores';
</script>
<svelte:head><title>Agent Certificate — wayMint</title></svelte:head>
<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;font-family:var(--font-heading)">
  <h1>Agent {$page.params.chain}:{$page.params.id}</h1>
  <p style="color:var(--color-text-muted)">Certificate page coming soon</p>
  <a href="/" class="btn btn-secondary">Home</a>
</div>
