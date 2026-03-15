# wayMint — Phase 1 + 2 Build Task

You are building **wayMint** — a SvelteKit dApp at 8004.way.je for registering AI agents on-chain (ERC-8004 standard) with proof-of-human verification.

Your task is to build Phase 1 (Foundation) and Phase 2 (Landing Page). Do not leave stubs or TODOs in the parts I ask you to complete — implement everything properly.

---

## STEP 1: Create the SvelteKit project

The directory already exists and has a git repo. Run:

```bash
npm create svelte@latest . -- --template skeleton --types typescript --no-prettier --no-eslint --no-vitest --no-playwright 2>&1 || true
```

If that fails or is interactive, create these files manually instead:

**package.json:**
```json
{
  "name": "waymint",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@sveltejs/adapter-cloudflare": "^4.0.0",
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "svelte": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "@cloudflare/workers-types": "^4.0.0"
  },
  "dependencies": {
    "viem": "^2.0.0",
    "@selfxyz/agent-sdk": "^0.2.0",
    "qrcode": "^1.5.0",
    "lottie-web": "^5.12.0",
    "uuid": "^11.0.0"
  },
  "type": "module"
}
```

---

## STEP 2: Install dependencies

```bash
npm install
npm install -D @sveltejs/adapter-cloudflare @cloudflare/workers-types
npm install viem @selfxyz/agent-sdk qrcode lottie-web uuid
npm install -D @types/uuid @types/qrcode
```

---

## STEP 3: Create svelte.config.js

```js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>'],
      },
    }),
  },
};
```

---

## STEP 4: Create vite.config.ts

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
});
```

---

## STEP 5: Create wrangler.toml

```toml
name = "waymint"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "CACHE"
id = "placeholder_kv_id"
preview_id = "placeholder_preview_id"
```

---

## STEP 6: Create src/app.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

---

## STEP 7: Create src/app.d.ts

```ts
import type { KVNamespace } from '@cloudflare/workers-types';

declare global {
  namespace App {
    interface Platform {
      env: {
        CACHE: KVNamespace;
        PINATA_JWT: string;
      };
    }
  }
}

export {};
```

---

## STEP 8: Create src/app.css

```css
/* Fonts */
:root {
  --font-heading: 'Space Grotesk', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

/* Colours */
:root {
  --color-bg: #0a0a0a;
  --color-bg-2: #111111;
  --color-bg-3: #1a1a1a;
  --color-border: #222222;
  --color-border-hover: #333333;
  --color-text: #e0e0e0;
  --color-text-muted: #888888;
  --color-text-faint: #555555;
  --color-accent: #3b82f6;
  --color-accent-hover: #2563eb;
  --color-accent-dim: rgba(59, 130, 246, 0.15);
  --color-success: #22c55e;
  --color-success-dim: rgba(34, 197, 94, 0.15);
  --color-warning: #f59e0b;
  --color-warning-dim: rgba(245, 158, 11, 0.15);
  --color-danger: #ef4444;
  --color-danger-dim: rgba(239, 68, 68, 0.15);
  --color-celo: #fcff52;
  --color-celo-bg: rgba(252, 255, 82, 0.1);
  --color-base: #3b82f6;
  --color-base-bg: rgba(59, 130, 246, 0.1);
}

/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { color-scheme: dark; }
body {
  font-family: var(--font-body);
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  line-height: 1.2;
  font-weight: 700;
}
a { color: var(--color-accent); text-decoration: none; }
a:hover { text-decoration: underline; }
code, pre, .mono { font-family: var(--font-mono); }

/* Layout */
.container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: var(--font-heading);
}
.badge-celo { background: var(--color-celo-bg); color: var(--color-celo); border: 1px solid rgba(252,255,82,0.3); }
.badge-base { background: var(--color-base-bg); color: var(--color-base); border: 1px solid rgba(59,130,246,0.3); }
.badge-verified { background: var(--color-success-dim); color: var(--color-success); border: 1px solid rgba(34,197,94,0.3); }
.badge-unverified { background: rgba(255,255,255,0.05); color: var(--color-text-muted); border: 1px solid var(--color-border); }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  text-decoration: none;
}
.btn-primary { background: var(--color-accent); color: #fff; }
.btn-primary:hover { background: var(--color-accent-hover); text-decoration: none; }
.btn-secondary { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
.btn-secondary:hover { border-color: var(--color-border-hover); background: var(--color-bg-2); text-decoration: none; }
.btn-lg { padding: 0.75rem 1.75rem; font-size: 1rem; }
.btn-sm { padding: 0.4rem 1rem; font-size: 0.85rem; }

/* Cards */
.card { background: var(--color-bg-2); border: 1px solid var(--color-border); border-radius: 12px; padding: 1.5rem; }
.card:hover { border-color: var(--color-border-hover); }
```

---

## STEP 9: Create src/lib/chains.ts

```ts
import { defineChain } from 'viem';

export const celo = defineChain({
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: ['https://forno.celo.org'] } },
  blockExplorers: { default: { name: 'Celoscan', url: 'https://celoscan.io' } },
});

export const base = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://basescan.org' } },
});

export const CHAINS = { celo, base } as const;
export type ChainKey = keyof typeof CHAINS;
```

---

## STEP 10: Create src/lib/contracts.ts

```ts
export const CONTRACTS = {
  celo: {
    registry: '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944' as `0x${string}`,
    proofProvider: '0x4b036aFD959B457A208F676cf44Ea3ef73Ea3E3d' as `0x${string}`,
  },
  base: {
    registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`,
  },
} as const;

export const ERC8004_ABI = [
  { name: 'register', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ name: 'agentId', type: 'uint256' }] },
  { name: 'setAgentWallet', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'newWallet', type: 'address' }, { name: 'deadline', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
  { name: 'tokenURI', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }] },
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
] as const;

export const SELF_REGISTRY_ABI = [
  ...ERC8004_ABI,
  { name: 'hasHumanProof', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'isProofFresh', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'proofExpiresAt', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

export const COINBASE_VERIFICATION_SCHEMA = '0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9' as `0x${string}`;
export const EAS_CONTRACT_BASE = '0x4200000000000000000000000000000000000021' as `0x${string}`;
```

---

## STEP 11: Create src/lib/wallet.ts

```ts
import { writable, derived } from 'svelte/store';
import { createPublicClient, http } from 'viem';
import { celo, base } from './chains';

export const walletAddress = writable<`0x${string}` | null>(null);
export const chainId = writable<number | null>(null);
export const isConnecting = writable(false);
export const walletError = writable<string | null>(null);
export const isConnected = derived(walletAddress, ($addr) => $addr !== null);

export function getPublicClient(chain: 'celo' | 'base') {
  return createPublicClient({
    chain: chain === 'celo' ? celo : base,
    transport: http(),
  });
}

export async function connectWallet(): Promise<`0x${string}` | null> {
  if (typeof window === 'undefined' || !window.ethereum) {
    walletError.set('No Web3 wallet found. Please install MetaMask or Coinbase Wallet.');
    return null;
  }
  isConnecting.set(true);
  walletError.set(null);
  try {
    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as `0x${string}`[];
    const address = accounts[0];
    walletAddress.set(address);
    const cId = await window.ethereum.request({ method: 'eth_chainId' });
    chainId.set(parseInt(cId as string, 16));
    window.ethereum.on('accountsChanged', (accs: `0x${string}`[]) => { walletAddress.set(accs[0] ?? null); });
    window.ethereum.on('chainChanged', (cid: string) => { chainId.set(parseInt(cid, 16)); });
    return address;
  } catch (e: any) {
    walletError.set(e.message ?? 'Failed to connect wallet');
    return null;
  } finally {
    isConnecting.set(false);
  }
}

export function disconnectWallet() {
  walletAddress.set(null);
  chainId.set(null);
}

export async function switchChain(targetChainId: number) {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + targetChainId.toString(16) }] });
  } catch (e: any) {
    if (e.code === 4902 && targetChainId === 42220) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: '0xa4ec', chainName: 'Celo Mainnet', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: ['https://forno.celo.org'], blockExplorerUrls: ['https://celoscan.io'] }],
      });
    }
  }
}

declare global {
  interface Window { ethereum?: any; }
}
```

---

## STEP 12: Create src/routes/+layout.svelte

```svelte
<script>
  import '../app.css';
</script>

<slot />
```

---

## STEP 13: Create src/routes/+page.svelte (FULL landing page)

This is the complete landing page. Create it exactly as specified below.

The file contents are in /home/erasmus/.openclaw/workspace/waymint/LANDING_PAGE.svelte — copy that file to src/routes/+page.svelte.

(I will create LANDING_PAGE.svelte separately.)

Actually, create src/routes/+page.svelte directly with this content:

The landing page should have:
1. A sticky nav with wayMint logo/wordmark and "Register Agent" button
2. A hero section: large "Give your agent a verifiable identity." headline with "verifiable identity" in blue accent, subtitle text, two CTA buttons (Register Agent, ERC-8004 Spec), and a search form that routes to /agent/[chain]/[id] or /owner/[address]
3. A "How it works" section with 3 steps: Choose your chain, Describe your agent, Prove you are human & mint
4. A "What you get" section with 4 feature cards: Verified Human badge, Shareable certificate page, On-chain & permanent, Owner profile
5. A footer with brand name and links to: ERC-8004 Spec, Self Docs, Coinbase Verifications, The Synthesis, 8004agents.ai

Use the CSS variables from app.css throughout. Make it visually polished with the dark theme.

---

## STEP 14: Create route placeholders

**src/routes/register/+page.svelte:**
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
</script>
<svelte:head><title>Register Agent — wayMint</title></svelte:head>
<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;font-family:var(--font-heading)">
  <h1>Registration wizard</h1>
  <p style="color:var(--color-text-muted)">Coming soon</p>
  <a href="/" class="btn btn-secondary">Back to home</a>
</div>
```

**src/routes/agent/[chain]/[id]/+page.svelte:**
```svelte
<script lang="ts">
  import { page } from '$app/stores';
</script>
<svelte:head><title>Agent Certificate — wayMint</title></svelte:head>
<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;font-family:var(--font-heading)">
  <h1>Agent {$page.params.chain}:{$page.params.id}</h1>
  <p style="color:var(--color-text-muted)">Certificate page coming soon</p>
  <a href="/" class="btn btn-secondary">Home</a>
</div>
```

**src/routes/agent/[chain]/[id]/+page.server.ts:**
```ts
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params }) => {
  return { chain: params.chain, id: params.id };
};
```

**src/routes/owner/[address]/+page.svelte:**
```svelte
<script lang="ts">
  import { page } from '$app/stores';
</script>
<svelte:head><title>Owner Profile — wayMint</title></svelte:head>
<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;font-family:var(--font-heading)">
  <h1>Owner {$page.params.address.slice(0,8)}...</h1>
  <p style="color:var(--color-text-muted)">Profile page coming soon</p>
  <a href="/" class="btn btn-secondary">Home</a>
</div>
```

**src/routes/owner/[address]/+page.server.ts:**
```ts
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params }) => {
  return { address: params.address };
};
```

---

## STEP 15: Create API route stubs

**src/routes/api/pin/+server.ts:**
```ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async () => {
  return json({ error: 'Not implemented' }, { status: 501 });
};
```

**src/routes/api/agent/[chain]/[id]/+server.ts:**
```ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params }) => {
  return json({ error: 'Not implemented', chain: params.chain, id: params.id }, { status: 501 });
};
```

**src/routes/api/owner/[address]/+server.ts:**
```ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params }) => {
  return json({ error: 'Not implemented', address: params.address }, { status: 501 });
};
```

**src/routes/api/health/[...endpoint]/+server.ts:**
```ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params }) => {
  return json({ error: 'Not implemented', endpoint: params.endpoint }, { status: 501 });
};
```

---

## STEP 16: Create .gitignore

```
node_modules/
.svelte-kit/
build/
dist/
.wrangler/
.env
.env.*
!.env.example
```

---

## STEP 17: Create static/favicon.svg

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#0a0a0a"/>
  <polygon points="50,15 82,33 82,67 50,85 18,67 18,33" stroke="#3b82f6" stroke-width="4" fill="none"/>
  <circle cx="50" cy="50" r="10" fill="#3b82f6"/>
</svg>
```

---

## STEP 18: Build and verify

Run:
```bash
npm run build 2>&1
```

Fix any errors. Common issues:
- If `@sveltejs/adapter-cloudflare` has peer dep issues, try `npm install --legacy-peer-deps`
- If there are type errors in .svelte files, they are usually fine — SvelteKit types may not be generated until after first build
- If viem imports cause issues in SSR context, add `ssr: { noExternal: ['viem'] }` to vite.config.ts

The build MUST complete successfully.

---

## STEP 19: Commit

```bash
git add -A
git commit -m "feat: Phase 1+2 — scaffold, design system, landing page, route skeleton"
```

---

## When done

Run this exact command when everything is complete and the build passes:
```
openclaw system event --text "Done: wayMint Phase 1+2 complete. SvelteKit scaffold built, design system created, landing page done, all routes stubbed, build passes." --mode now
```
