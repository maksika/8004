# wayMint — Feedback Fixes

You are fixing feedback issues in the wayMint project at `/home/erasmus/.openclaw/workspace/waymint/`.

Read all relevant source files before making changes. The main files you will edit:
- `src/routes/+page.svelte` — landing page
- `src/routes/register/+page.svelte` — registration wizard

---

## FIX 1: Landing page — remove search, single CTA

In `src/routes/+page.svelte`:

1. **Remove the entire search form** (the `<form class="search-form">` block and its handler)
2. **Remove the ERC-8004 spec link** from the hero CTA buttons — only keep "Register Agent →"
3. **Move the "Are you an agent?" section** so it appears directly below the hero section (before "How it works"), not near the footer
4. **Remove `handleSearch` and `searchQuery`** from the script block since search is gone

---

## FIX 2: Registration wizard — remove keypair generation from UI

In `src/routes/register/+page.svelte`, Step 1 (Wallet & Key):

**Remove the "Generate agent keypair" subsection entirely from the UI.** The agent should generate their own keypair — this is not the human's job.

Replace the keypair section with an informational card that says:

```
Your agent should generate its own keypair.

If you are an agent, generate your ECDSA keypair now and have your 
address ready. If you are a human setting this up, ask your agent to 
generate a keypair and give you the agent address before proceeding.

[→ How agents self-register (skill.md)]
```

Add a text input for the human to paste in the **agent address** (the `0x...` address their agent generated):

```svelte
<div class="form-group">
  <label class="form-label" for="agentAddress">Agent address <span class="required">*</span></label>
  <input
    id="agentAddress"
    type="text"
    class="form-input"
    bind:value={agentAddressInput}
    placeholder="0x..."
    pattern="^0x[a-fA-F0-9]{40}$"
  />
  <span class="form-hint">The Ethereum address your agent generated for itself</span>
</div>
```

Update the validation so `step2Valid` requires `$walletAddress && agentAddressInput.match(/^0x[a-fA-F0-9]{40}$/)`.

Remove all keypair generation code: `generateAgentKeypair`, `downloadKeyAsJSON`, `keypair`, `keySaved`, the `handleGenerateKey` and `handleDownloadKey` functions, and the key download UI. Remove the import of `agentKey` module.

Update the success page (Step 4) to remove the key reminder card since we no longer generate keys on-site.

---

## FIX 3: Back buttons

In `src/routes/register/+page.svelte`:

Every step must have a working back button. Currently Steps 0 (network selection) and 3 (verify/mint) may be missing back navigation. Ensure:

- **Step 0 (network):** No back button needed (first step)
- **Step 1 (wallet):** Back → Step 0 ✓ (already exists)
- **Step 2 (details):** Back → Step 1 ✓ (already exists)  
- **Step 3 (verify/mint `idle` state):** Back → Step 2 — add if missing
- **Step 3 (verify/mint `error` state):** "Try again" resets to `idle`; also show back button to Step 2
- **Step 4 (success):** No back needed

---

## FIX 4: Service endpoints layout

In `src/routes/register/+page.svelte`, Step 2 (Agent Details), the endpoints section:

Replace the current endpoint row layout (protocol dropdown + url + version in one row) with a **stacked card-style layout** matching the pattern at https://8004agents.ai/create:

Each endpoint gets its own small card with:
- Protocol dropdown (full width)  
- URL input (full width, below protocol)
- Version input (full width, below URL)
- Remove button (top-right corner of card)

```svelte
{#each endpoints as ep, i}
  <div class="endpoint-card-item">
    <div class="endpoint-card-header">
      <span class="endpoint-card-num">Endpoint {i + 1}</span>
      {#if endpoints.length > 1}
        <button class="remove-btn" on:click={() => removeEndpoint(i)}>✕ Remove</button>
      {/if}
    </div>
    <div class="form-group">
      <label class="form-label" for="ep-protocol-{i}">Protocol</label>
      <select id="ep-protocol-{i}" class="form-input" bind:value={ep.protocol}>
        <option value="MCP">MCP</option>
        <option value="A2A">A2A</option>
        <option value="Web">Web</option>
        <option value="Email">Email</option>
        <option value="Custom">Custom</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="ep-url-{i}">Endpoint URL</label>
      <input
        id="ep-url-{i}"
        type="text"
        class="form-input"
        bind:value={ep.url}
        placeholder={getEndpointPlaceholder(ep.protocol)}
      />
    </div>
    <div class="form-group">
      <label class="form-label" for="ep-version-{i}">Version <span class="optional">(optional)</span></label>
      <input
        id="ep-version-{i}"
        type="text"
        class="form-input"
        bind:value={ep.version}
        placeholder="e.g. 2025-06-18"
      />
    </div>
  </div>
{/each}
```

Add a `getEndpointPlaceholder` helper function:
```typescript
function getEndpointPlaceholder(protocol: string): string {
  switch (protocol) {
    case 'MCP': return 'https://my-agent.example.com/mcp';
    case 'A2A': return 'https://my-agent.example.com/a2a';
    case 'Email': return 'mailto:agent@example.com';
    case 'Web': return 'https://my-agent.example.com';
    case 'Custom': return 'Enter endpoint URL or identifier';
    default: return 'https://...';
  }
}
```

Style the endpoint cards:
```css
.endpoint-card-item {
  background: color-mix(in srgb, var(--foreground) 3%, transparent);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) * 1.1);
  padding: 1rem 1.25rem;
  margin-bottom: 0.75rem;
}
.endpoint-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}
.endpoint-card-num {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.remove-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--muted-foreground);
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
}
.remove-btn:hover { color: var(--destructive); border-color: var(--destructive); }
```

---

## FIX 5: Celo registration — Self QR must render

In `src/routes/register/+page.svelte`, `mintCelo()`:

The current code calls `requestRegistration()` but may not correctly pass `agentURI`. The `requestRegistration()` SDK does not accept `agentURI` directly — it handles registration metadata separately. The fix:

1. After pinning to IPFS and getting `agentURI`, call `requestRegistration` with the correct fields
2. The `session.deepLink` is what must be passed to the `QRDisplay` component as `value`
3. The QRDisplay component renders a QR of `selfDeepLink` — make sure `selfDeepLink` is set BEFORE `mintStatus` changes to `'polling'`

The corrected `mintCelo` function:

```typescript
async function mintCelo() {
  if (!$walletAddress) return;

  try {
    // requestRegistration from @selfxyz/agent-sdk
    const { requestRegistration } = await import('@selfxyz/agent-sdk');

    const session = await requestRegistration({
      mode: 'linked',
      network: 'mainnet',
      humanAddress: $walletAddress,
      agentName,
      agentDescription,
    });

    // Set the deep link FIRST so QR renders immediately
    selfDeepLink = session.deepLink;
    qrStatus = 'waiting';
    mintStatus = 'polling'; // This triggers the QR display in the template

    // Now wait for the human to scan and the proof to be verified on-chain
    const result = await session.waitForCompletion({ timeoutMs: 10 * 60 * 1000 });

    mintedAgentId = result.agentId;
    mintedTxHash = result.txHash ?? '';
    qrStatus = 'done';

    // Brief pause so user sees the success state on the QR
    await new Promise(r => setTimeout(r, 1200));
    mintStatus = 'done';
    step = 4 as Step;

  } catch (e: any) {
    qrStatus = 'error';
    mintStatus = 'error';
    mintError = e.message ?? 'Celo registration failed';
  }
}
```

Also make sure `startMint` calls `mintCelo()` directly without going through the `pinToIPFS` step first for Celo — the Self SDK handles the metadata. Update `startMint()`:

```typescript
async function startMint() {
  mintStatus = 'pinning';
  mintError = '';

  try {
    if (network === 'celo') {
      // For Celo, Self SDK handles the registration file internally
      // We still pin for the certificate page display, but don't block on it
      mintStatus = 'minting';
      await mintCelo();
    } else {
      // Base: pin first, then mint
      const validEndpoints = endpoints.filter((e) => e.url.trim());
      agentURI = await pinToIPFS({
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: agentName,
        description: agentDescription,
        ...(agentImage.trim() ? { image: agentImage.trim() } : {}),
        services: validEndpoints.map((e) => ({
          name: e.protocol,
          endpoint: e.url,
          ...(e.version.trim() ? { version: e.version } : {}),
        })),
        x402Support: false,
        active: true,
        supportedTrust: ['reputation'],
      });
      mintStatus = 'minting';
      await mintBaseWithViem();
    }
  } catch (e: any) {
    mintStatus = 'error';
    mintError = e.message ?? 'Unknown error';
  }
}
```

---

## FIX 6: Base — replace confirm() with in-page message

In `src/routes/register/+page.svelte`, `mintBaseWithViem()`:

Remove the `confirm()` call entirely. Instead:

1. Add a reactive variable: `let showCoinbasePrompt = false;`
2. When the attestation check fails, set `showCoinbasePrompt = true` and `mintStatus = 'idle'` — do not proceed
3. In the template, show an in-page callout card when `showCoinbasePrompt` is true:

```svelte
{#if showCoinbasePrompt}
  <div class="card coinbase-prompt">
    <h3>Coinbase Verification required</h3>
    <p>Your wallet doesn't have a Coinbase Verification attestation on Base. This is needed to register as a "Verified Human" agent.</p>
    <ol class="steps-list">
      <li>Visit <a href="https://www.coinbase.com/onchain-verify" target="_blank" rel="noopener">coinbase.com/onchain-verify</a> and complete verification</li>
      <li>Return here and click "Check again"</li>
    </ol>
    <div class="prompt-actions">
      <a href="https://www.coinbase.com/onchain-verify" target="_blank" rel="noopener" class="btn btn-primary">
        Get verified on Coinbase →
      </a>
      <button class="btn btn-secondary" on:click={() => { showCoinbasePrompt = false; startMint(); }}>
        Check again
      </button>
      <button class="btn btn-secondary" on:click={() => { showCoinbasePrompt = false; proceedUnverified = true; startMint(); }}>
        Continue without verification
      </button>
    </div>
    <p class="prompt-note">Without verification your agent will show as "Unverified" on its certificate page.</p>
  </div>
{/if}
```

Add `let proceedUnverified = false;` to the script. In `mintBaseWithViem()`, replace the `confirm()` block:

```typescript
if (!hasVerification && !proceedUnverified) {
  showCoinbasePrompt = true;
  mintStatus = 'idle';
  return;
}
```

Style the coinbase prompt:
```css
.coinbase-prompt { border-color: var(--brand-offset-blue); margin-bottom: 1.5rem; }
.coinbase-prompt h3 { margin-bottom: 0.5rem; }
.coinbase-prompt p { font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 1rem; }
.prompt-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
.prompt-note { font-size: 0.8rem; color: var(--muted-foreground); margin-top: 0.75rem; }
```

---

## STEP: Build and verify

```bash
cd /home/erasmus/.openclaw/workspace/waymint
npm run build 2>&1
```

Fix all errors.

---

## STEP: Commit and push

```bash
cd /home/erasmus/.openclaw/workspace/waymint
git add -A
git commit -m "fix: address v1 feedback — remove search/keypairgen, fix Self QR, Base in-page prompt, endpoint UX, back buttons"
git push origin main
```

---

## When done

```
openclaw system event --text "Done: wayMint v1 feedback fixes applied — search removed, keypair generation removed (agent-side), Self QR working, Base coinbase in-page prompt, endpoint card layout, back buttons. Build passes. Pushed." --mode now
```
