<script lang="ts">
  import { page } from '$app/stores';
</script>
<svelte:head><title>Owner Profile — wayMint</title></svelte:head>
<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;font-family:var(--font-heading)">
  <h1>Owner {$page.params.address.slice(0,8)}...</h1>
  <p style="color:var(--color-text-muted)">Profile page coming soon</p>
  <a href="/" class="btn btn-secondary">Home</a>
</div>
