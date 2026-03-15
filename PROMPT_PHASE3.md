# wayMint — Phase 3: Registration Wizard

You are continuing to build **wayMint**, a SvelteKit dApp for registering AI agents on-chain with proof-of-human verification.

The project is already set up at `/home/erasmus/.openclaw/workspace/waymint/`. Phase 1+2 are done (scaffold, design system, landing page). Your job is Phase 3: the full registration wizard at `/register`.

Read the existing files first to understand the codebase before writing anything.

---

## What you are building

A multi-step wizard at `src/routes/register/+page.svelte` with these 5 steps:

1. **Choose Network** — Celo or Base card selector
2. **Connect Wallet & Generate Agent Key** — wallet connect + ECDSA keypair generation
3. **Agent Details** — name, description, image URL, service endpoints
4. **Verify & Mint** — Celo: QR code + Self SDK flow | Base: EAS attestation check + viem tx
5. **Success** — agentId, links, key export

---

## STEP 1: Install additional dependencies

```bash
cd /home/erasmus/.openclaw/workspace/waymint
npm install @selfxyz/agent-sdk qrcode
npm install -D @types/qrcode
```

(These may already be installed — that is fine.)

---

## STEP 2: Create src/lib/ipfs.ts — IPFS pinning helper

```ts
// Client-side helper to pin agent registration JSON via the server-side proxy
export interface AgentRegistrationFile {
  type: string;
  name: string;
  description: string;
  image?: string;
  services: Array<{
    name: string;
    endpoint: string;
    version?: string;
  }>;
  x402Support: boolean;
  active: boolean;
  supportedTrust: string[];
}

export async function pinToIPFS(data: AgentRegistrationFile): Promise<string> {
  const res = await fetch('/api/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Pin failed: ${res.status}`);
  }
  const { cid } = await res.json();
  return `ipfs://${cid}`;
}
```

---

## STEP 3: Create src/lib/agentKey.ts — browser-side ECDSA keypair

```ts
// Generate a fresh ECDSA keypair in the browser using the Web Crypto API.
// The private key is shown once and never stored by the dApp.

export interface AgentKeypair {
  address: `0x${string}`;
  privateKeyHex: string; // 0x-prefixed hex, 64 chars
  publicKeyHex: string;
}

export async function generateAgentKeypair(): Promise<AgentKeypair> {
  // Use viem's generatePrivateKey + privateKeyToAddress
  const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts');
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    address: account.address,
    privateKeyHex: privateKey,
    publicKeyHex: account.publicKey,
  };
}

export function downloadKeyAsJSON(keypair: AgentKeypair, agentName: string) {
  const payload = {
    agentName,
    agentAddress: keypair.address,
    privateKey: keypair.privateKeyHex,
    warning: 'Keep this private key secret. Anyone with this key controls your agent.',
    generatedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `waymint-agent-key-${agentName.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## STEP 4: Update src/routes/api/pin/+server.ts — real Pinata proxy

Replace the 501 stub with a real implementation:

```ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ERC8004_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';

interface Service {
  name: string;
  endpoint: string;
  version?: string;
}

interface RegistrationPayload {
  type?: string;
  name: string;
  description: string;
  image?: string;
  services: Service[];
  x402Support?: boolean;
  active?: boolean;
  supportedTrust?: string[];
}

export const POST: RequestHandler = async ({ request, platform }) => {
  // Validate payload
  let body: RegistrationPayload;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  if (!body.name || typeof body.name !== 'string' || body.name.length < 1) {
    throw error(400, 'Missing or invalid name');
  }
  if (!body.services || !Array.isArray(body.services) || body.services.length === 0) {
    throw error(400, 'At least one service endpoint is required');
  }

  const registrationFile = {
    type: ERC8004_TYPE,
    name: body.name,
    description: body.description ?? '',
    ...(body.image ? { image: body.image } : {}),
    services: body.services.map((s: Service) => ({
      name: s.name,
      endpoint: s.endpoint,
      ...(s.version ? { version: s.version } : {}),
    })),
    x402Support: body.x402Support ?? false,
    active: body.active ?? true,
    supportedTrust: body.supportedTrust ?? ['reputation'],
  };

  // Get Pinata JWT from Cloudflare env or process.env fallback
  const pinatJWT = platform?.env?.PINATA_JWT ?? process.env.PINATA_JWT;
  if (!pinatJWT) {
    // Dev mode: return a fake CID so the wizard can be tested locally
    console.warn('[api/pin] No PINATA_JWT found — returning mock CID for dev');
    const mockCid = 'bafybeig' + Math.random().toString(36).slice(2, 18).padEnd(16, '0');
    return json({ cid: mockCid, mock: true });
  }

  // Pin to Pinata
  const pinRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pinatJWT}`,
    },
    body: JSON.stringify({
      pinataContent: registrationFile,
      pinataMetadata: { name: `waymint-agent-${body.name}` },
    }),
  });

  if (!pinRes.ok) {
    const errText = await pinRes.text().catch(() => 'Unknown error');
    console.error('[api/pin] Pinata error:', pinRes.status, errText);
    throw error(502, 'Failed to pin to IPFS');
  }

  const { IpfsHash } = await pinRes.json();
  return json({ cid: IpfsHash });
};
```

---

## STEP 5: Create src/lib/components/Stepper.svelte

```svelte
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
```

---

## STEP 6: Create src/lib/components/QRDisplay.svelte

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
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

  const statusLabels = {
    waiting: '⏳ Waiting for Self app scan...',
    connected: '📱 Phone connected — follow prompts in the app',
    generating: '🔄 Generating ZK proof...',
    done: '✅ Verified!',
    error: '❌ Verification failed',
  };

  const statusColors = {
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
```

---

## STEP 7: Create the full registration wizard — src/routes/register/+page.svelte

This is the main file. Build it completely with all 5 steps.

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import Stepper from '$lib/components/Stepper.svelte';
  import QRDisplay from '$lib/components/QRDisplay.svelte';
  import { connectWallet, walletAddress, walletError, isConnecting } from '$lib/wallet';
  import { generateAgentKeypair, downloadKeyAsJSON } from '$lib/agentKey';
  import { pinToIPFS } from '$lib/ipfs';
  import type { AgentKeypair } from '$lib/agentKey';
  import { requestRegistration } from '@selfxyz/agent-sdk';

  // ── Wizard state ──────────────────────────────────────────────────────────
  type Network = 'celo' | 'base';
  type Step = 0 | 1 | 2 | 3 | 4;

  const STEPS = ['Network', 'Wallet & Key', 'Agent Details', 'Verify & Mint', 'Success'];

  let step: Step = 0;
  let network: Network | null = null;
  let keypair: AgentKeypair | null = null;
  let keySaved = false;

  // Agent details form
  let agentName = '';
  let agentDescription = '';
  let agentImage = '';
  type Protocol = 'MCP' | 'A2A' | 'Web' | 'Email' | 'Custom';
  let endpoints: Array<{ protocol: Protocol; url: string; version: string }> = [
    { protocol: 'MCP', url: '', version: '' },
  ];

  // Mint state
  let agentURI = '';
  let mintStatus: 'idle' | 'pinning' | 'minting' | 'polling' | 'done' | 'error' = 'idle';
  let mintError = '';
  let mintedAgentId: number | null = null;
  let mintedTxHash = '';

  // Celo / Self QR state
  type QRStatus = 'waiting' | 'connected' | 'generating' | 'done' | 'error';
  let qrStatus: QRStatus = 'waiting';
  let selfDeepLink = '';

  // ── Navigation ────────────────────────────────────────────────────────────
  function goNext() { step = (step + 1) as Step; }
  function goBack() { step = (step - 1) as Step; }

  // ── Step 1: Network ───────────────────────────────────────────────────────
  function selectNetwork(n: Network) {
    network = n;
    goNext();
  }

  // ── Step 2: Wallet & Key ──────────────────────────────────────────────────
  async function handleConnect() {
    await connectWallet();
  }

  async function handleGenerateKey() {
    keypair = await generateAgentKeypair();
    keySaved = false;
  }

  function handleDownloadKey() {
    if (keypair) {
      downloadKeyAsJSON(keypair, agentName || 'my-agent');
      keySaved = true;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // ── Step 3: Endpoints ─────────────────────────────────────────────────────
  function addEndpoint() {
    endpoints = [...endpoints, { protocol: 'Web', url: '', version: '' }];
  }

  function removeEndpoint(i: number) {
    endpoints = endpoints.filter((_, idx) => idx !== i);
  }

  // ── Step 4: Mint ──────────────────────────────────────────────────────────
  async function startMint() {
    mintStatus = 'pinning';
    mintError = '';

    try {
      // Build and pin the registration file
      const validEndpoints = endpoints.filter((e) => e.url.trim());
      const registrationData = {
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
      };

      agentURI = await pinToIPFS(registrationData);
      mintStatus = 'minting';

      if (network === 'celo') {
        await mintCelo();
      } else {
        await mintBase();
      }
    } catch (e: any) {
      mintStatus = 'error';
      mintError = e.message ?? 'Unknown error during minting';
    }
  }

  async function mintCelo() {
    if (!$walletAddress || !keypair) return;

    // Use @selfxyz/agent-sdk to initiate registration
    const session = await requestRegistration({
      mode: 'linked',
      network: 'mainnet',
      humanAddress: $walletAddress,
      agentName,
      agentDescription,
    });

    selfDeepLink = session.deepLink;
    qrStatus = 'waiting';
    mintStatus = 'polling';

    // Poll for completion
    try {
      const result = await session.waitForCompletion({ timeoutMs: 10 * 60 * 1000 });
      mintedAgentId = result.agentId;
      mintedTxHash = result.txHash ?? '';
      qrStatus = 'done';
      mintStatus = 'done';
      step = 4 as Step;
    } catch (e: any) {
      qrStatus = 'error';
      mintStatus = 'error';
      mintError = e.message ?? 'Celo registration failed';
    }
  }

  async function mintBase() {
    if (!$walletAddress || !keypair || !window.ethereum) {
      mintError = 'Wallet not connected';
      mintStatus = 'error';
      return;
    }

    try {
      // Switch to Base if needed
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (parseInt(currentChainId, 16) !== 8453) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }], // Base mainnet
          });
        } catch (switchErr: any) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base Mainnet',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org'],
              }],
            });
          } else {
            throw switchErr;
          }
        }
      }

      // Check Coinbase Verification attestation
      const { createPublicClient, http, parseAbi } = await import('viem');
      const { base } = await import('$lib/chains');

      const publicClient = createPublicClient({ chain: base, transport: http() });

      const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as `0x${string}`;
      const SCHEMA_UID = '0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9' as `0x${string}`;

      const easAbi = parseAbi([
        'function getAttestation(bytes32 uid) external view returns ((bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address recipient, address attester, bool revocable, bytes data))',
        'function getSchemaAttestations(bytes32 schema, address recipient) external view returns (bytes32[] memory)',
      ]);

      // Check if the wallet has a Coinbase Verification
      let hasVerification = false;
      try {
        // Try to find an attestation via schema
        const attUids = await publicClient.readContract({
          address: EAS_ADDRESS,
          abi: easAbi,
          functionName: 'getSchemaAttestations',
          args: [SCHEMA_UID, $walletAddress as `0x${string}`],
        });
        hasVerification = attUids.length > 0;
      } catch {
        // EAS may not support this call — treat as no verification
        hasVerification = false;
      }

      if (!hasVerification) {
        // Show prompt to get verified, but allow proceeding as "basic" tier
        const proceed = confirm(
          'Your wallet does not have a Coinbase Verification attestation.\n\n' +
          'You can still register, but your agent will show as "Unverified" instead of "Verified Human".\n\n' +
          'To get verified: visit coinbase.com/onchain-verify and return here.\n\n' +
          'Proceed without verification?'
        );
        if (!proceed) {
          mintStatus = 'idle';
          return;
        }
      }

      // Call register(agentURI) on the ERC-8004 Identity Registry
      const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`;
      const registryAbi = parseAbi([
        'function register(string calldata agentURI) external returns (uint256 agentId)',
        'event Registered(uint256 indexed agentId, address indexed owner, string agentURI)',
      ]);

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: $walletAddress,
          to: REGISTRY,
          data: encodeFunctionData(registryAbi, 'register', [agentURI]),
        }],
      });

      // Wait for receipt and parse agentId from event
      mintStatus = 'polling';
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      mintedTxHash = txHash;

      // Parse Registered event to get agentId
      const { parseEventLogs } = await import('viem');
      const logs = parseEventLogs({ abi: registryAbi, logs: receipt.logs });
      const registeredEvent = logs.find((l: any) => l.eventName === 'Registered');
      if (registeredEvent) {
        mintedAgentId = Number((registeredEvent as any).args.agentId);
      }

      mintStatus = 'done';
      step = 4 as Step;
    } catch (e: any) {
      mintStatus = 'error';
      mintError = e.message ?? 'Base mint failed';
    }
  }

  // Helper to encode function data using viem (inline to avoid SSR issues)
  function encodeFunctionData(abi: any[], functionName: string, args: any[]): `0x${string}` {
    // Simple ABI encoder for register(string)
    // Using viem's encodeFunctionData would be cleaner but may have SSR issues
    // For now, use window.ethereum + MetaMask to handle encoding
    // This placeholder will be replaced by a proper viem import below
    return '0x' as `0x${string}`;
  }

  // Proper Base mint using viem walletClient
  async function mintBaseWithViem() {
    const { createWalletClient, createPublicClient, custom, http, parseAbi, parseEventLogs, encodeFunctionData } = await import('viem');
    const { base } = await import('$lib/chains');

    const walletClient = createWalletClient({
      chain: base,
      transport: custom(window.ethereum),
    });

    const publicClient = createPublicClient({ chain: base, transport: http() });

    const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`;
    const registryAbi = parseAbi([
      'function register(string calldata agentURI) external returns (uint256 agentId)',
      'event Registered(uint256 indexed agentId, address indexed owner, string agentURI)',
    ]);

    const hash = await walletClient.writeContract({
      address: REGISTRY,
      abi: registryAbi,
      functionName: 'register',
      args: [agentURI],
      account: $walletAddress as `0x${string}`,
    });

    mintedTxHash = hash;
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({ abi: registryAbi, logs: receipt.logs });
    const ev = logs.find((l: any) => l.eventName === 'Registered') as any;
    if (ev) mintedAgentId = Number(ev.args.agentId);

    mintStatus = 'done';
    step = 4 as Step;
  }

  // Validation helpers
  $: step2Valid = !!$walletAddress && !!keypair;
  $: step3Valid = agentName.trim().length >= 3 && endpoints.some((e) => e.url.trim());
  $: agentCertUrl = mintedAgentId !== null ? `/agent/${network}:${mintedAgentId}` : '';
  $: ownerUrl = $walletAddress ? `/owner/${$walletAddress}` : '';

  // Truncate address
  function truncate(addr: string) {
    return addr ? addr.slice(0, 8) + '...' + addr.slice(-6) : '';
  }
</script>

<svelte:head>
  <title>Register Agent — wayMint</title>
  <meta name="description" content="Register your AI agent on-chain with ERC-8004 and proof-of-human verification." />
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
  <!-- Nav -->
  <nav class="nav">
    <div class="container nav-inner">
      <a href="/" class="nav-logo">
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#3b82f6" opacity="0.15"/>
          <path d="M14 4L22 9V19L14 24L6 19V9L14 4Z" stroke="#3b82f6" stroke-width="1.5" fill="none"/>
          <circle cx="14" cy="14" r="3" fill="#3b82f6"/>
        </svg>
        <span class="nav-wordmark">wayMint</span>
      </a>
      <span class="nav-step-label">Register Agent</span>
    </div>
  </nav>

  <main class="main">
    <div class="wizard-wrap">
      <Stepper steps={STEPS} current={step} />

      <!-- ── Step 0: Choose Network ── -->
      {#if step === 0}
        <div class="step-content">
          <h2 class="step-title">Choose your network</h2>
          <p class="step-sub">Where do you want to register your agent? Both produce an ERC-8004 identity NFT.</p>

          <div class="network-cards">
            <button class="network-card" on:click={() => selectNetwork('celo')}>
              <div class="network-badge badge badge-celo">Celo Mainnet</div>
              <h3>Self Protocol</h3>
              <p>Passport scan via the Self app. Zero-knowledge proof on-chain. Soulbound NFT with ZK-attested credentials.</p>
              <ul class="network-features">
                <li>✦ Real passport NFC scan</li>
                <li>✦ ZK privacy — no data revealed</li>
                <li>✦ Sybil-resistant via nullifier</li>
                <li>✦ ~3 min registration</li>
              </ul>
              <div class="network-req">Requires: Self app (iOS/Android) + passport</div>
              <div class="network-cta btn btn-primary">Select Celo →</div>
            </button>

            <button class="network-card" on:click={() => selectNetwork('base')}>
              <div class="network-badge badge badge-base">Base Mainnet</div>
              <h3>Coinbase Verifications</h3>
              <p>EAS attestation via Coinbase identity verification. No passport scan needed — just a verified Coinbase account.</p>
              <ul class="network-features">
                <li>✦ Coinbase identity check</li>
                <li>✦ On-chain EAS attestation</li>
                <li>✦ ERC-8004 Identity Registry</li>
                <li>✦ ~2 min registration</li>
              </ul>
              <div class="network-req">Requires: Verified Coinbase account</div>
              <div class="network-cta btn btn-secondary">Select Base →</div>
            </button>
          </div>
        </div>

      <!-- ── Step 1: Wallet & Key ── -->
      {:else if step === 1}
        <div class="step-content">
          <h2 class="step-title">Connect wallet &amp; generate agent key</h2>
          <p class="step-sub">Your wallet establishes ownership of the agent NFT. A separate agent keypair is generated for the agent's operational identity.</p>

          <!-- Wallet -->
          <div class="card section-card">
            <h3 class="section-label">1. Connect your wallet</h3>
            {#if $walletAddress}
              <div class="wallet-connected">
                <span class="badge badge-verified">✓ Connected</span>
                <code class="mono addr">{truncate($walletAddress)}</code>
              </div>
            {:else}
              <p class="muted-text">Connect the wallet that will own the agent NFT.</p>
              {#if $walletError}
                <p class="error-text">{$walletError}</p>
              {/if}
              <button class="btn btn-primary" on:click={handleConnect} disabled={$isConnecting}>
                {$isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            {/if}
          </div>

          <!-- Agent Key -->
          <div class="card section-card" class:disabled={!$walletAddress}>
            <h3 class="section-label">2. Generate agent keypair</h3>
            <p class="muted-text">A fresh ECDSA keypair is generated in your browser. The private key is shown once — save it now.</p>

            {#if keypair}
              <div class="key-display">
                <div class="key-row">
                  <span class="key-label">Agent address</span>
                  <div class="key-value-row">
                    <code class="mono key-val">{keypair.address}</code>
                    <button class="copy-btn" on:click={() => copyToClipboard(keypair!.address)} title="Copy">⎘</button>
                  </div>
                </div>
                <div class="key-row">
                  <span class="key-label">Private key <span class="warning-tag">⚠ Show once</span></span>
                  <div class="key-value-row">
                    <code class="mono key-val pk">{keypair.privateKeyHex}</code>
                    <button class="copy-btn" on:click={() => copyToClipboard(keypair!.privateKeyHex)} title="Copy">⎘</button>
                  </div>
                </div>
                <div class="key-actions">
                  <button class="btn btn-primary" on:click={handleDownloadKey}>
                    ⬇ Download JSON
                  </button>
                  {#if keySaved}
                    <span class="badge badge-verified">Saved ✓</span>
                  {/if}
                </div>
                <p class="warning-text">⚠ Anyone with this private key controls your agent. Store it securely.</p>
              </div>
            {:else}
              <button class="btn btn-secondary" on:click={handleGenerateKey} disabled={!$walletAddress}>
                Generate Keypair
              </button>
            {/if}
          </div>

          <div class="step-nav">
            <button class="btn btn-secondary" on:click={goBack}>← Back</button>
            <button class="btn btn-primary" on:click={goNext} disabled={!step2Valid}>
              Continue →
            </button>
          </div>
        </div>

      <!-- ── Step 2: Agent Details ── -->
      {:else if step === 2}
        <div class="step-content">
          <h2 class="step-title">Describe your agent</h2>
          <p class="step-sub">This metadata is pinned to IPFS and forms your agent's ERC-8004 registration file.</p>

          <div class="card section-card">
            <div class="form-group">
              <label class="form-label" for="agentName">Agent name <span class="required">*</span></label>
              <input
                id="agentName"
                type="text"
                class="form-input"
                bind:value={agentName}
                placeholder="my-agent"
                maxlength="32"
                pattern="[a-zA-Z0-9\-]+"
              />
              <span class="form-hint">3–32 chars, alphanumeric and hyphens</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="agentDesc">Description <span class="required">*</span></label>
              <textarea
                id="agentDesc"
                class="form-input form-textarea"
                bind:value={agentDescription}
                placeholder="What this agent does and how to interact with it..."
                maxlength="500"
                rows="3"
              ></textarea>
              <span class="form-hint">{agentDescription.length}/500 chars</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="agentImage">Avatar image URL <span class="optional">(optional)</span></label>
              <input
                id="agentImage"
                type="url"
                class="form-input"
                bind:value={agentImage}
                placeholder="https://... or ipfs://..."
              />
              <span class="form-hint">HTTPS or IPFS URL. Leave blank to use a generated identicon.</span>
            </div>
          </div>

          <!-- Endpoints -->
          <div class="card section-card">
            <h3 class="section-label">Service endpoints <span class="required">*</span></h3>
            <p class="muted-text">At least one endpoint is required.</p>

            {#each endpoints as ep, i}
              <div class="endpoint-row">
                <select class="form-input ep-protocol" bind:value={ep.protocol}>
                  <option value="MCP">MCP</option>
                  <option value="A2A">A2A</option>
                  <option value="Web">Web</option>
                  <option value="Email">Email</option>
                  <option value="Custom">Custom</option>
                </select>
                <input
                  type="url"
                  class="form-input ep-url"
                  bind:value={ep.url}
                  placeholder="https://..."
                />
                <input
                  type="text"
                  class="form-input ep-version"
                  bind:value={ep.version}
                  placeholder="version (opt)"
                />
                {#if endpoints.length > 1}
                  <button class="remove-btn" on:click={() => removeEndpoint(i)} title="Remove">✕</button>
                {/if}
              </div>
            {/each}

            <button class="btn btn-secondary btn-sm add-ep-btn" on:click={addEndpoint}>
              + Add endpoint
            </button>
          </div>

          <div class="step-nav">
            <button class="btn btn-secondary" on:click={goBack}>← Back</button>
            <button class="btn btn-primary" on:click={goNext} disabled={!step3Valid}>
              Continue →
            </button>
          </div>
        </div>

      <!-- ── Step 3: Verify & Mint ── -->
      {:else if step === 3}
        <div class="step-content">
          <h2 class="step-title">
            {network === 'celo' ? 'Scan passport & mint' : 'Verify & mint on Base'}
          </h2>

          <!-- Summary card -->
          <div class="card summary-card">
            <div class="summary-row"><span>Network</span> <span class="badge {network === 'celo' ? 'badge-celo' : 'badge-base'}">{network === 'celo' ? 'Celo Mainnet' : 'Base Mainnet'}</span></div>
            <div class="summary-row"><span>Agent name</span> <strong>{agentName}</strong></div>
            <div class="summary-row"><span>Owner wallet</span> <code class="mono">{truncate($walletAddress ?? '')}</code></div>
            <div class="summary-row"><span>Agent address</span> <code class="mono">{truncate(keypair?.address ?? '')}</code></div>
            <div class="summary-row"><span>Endpoints</span> <span>{endpoints.filter(e => e.url.trim()).length}</span></div>
          </div>

          {#if mintStatus === 'idle'}
            {#if network === 'celo'}
              <div class="card info-card">
                <h3>What happens next</h3>
                <ol class="steps-list">
                  <li>We pin your agent metadata to IPFS</li>
                  <li>A QR code appears — scan it with the Self app</li>
                  <li>The Self app scans your passport NFC chip and generates a ZK proof</li>
                  <li>Hub V2 verifies the proof and mints your soulbound NFT</li>
                </ol>
                <p class="muted-text">Requires: Self app installed with a passport already scanned.</p>
              </div>
            {:else}
              <div class="card info-card">
                <h3>What happens next</h3>
                <ol class="steps-list">
                  <li>We check your wallet for a Coinbase Verification attestation</li>
                  <li>We pin your agent metadata to IPFS</li>
                  <li>Your wallet signs the <code>register(agentURI)</code> transaction</li>
                  <li>The ERC-8004 Identity Registry mints your agent NFT</li>
                </ol>
                <p class="muted-text">No Coinbase Verification? Get one at <a href="https://coinbase.com/onchain-verify" target="_blank" rel="noopener">coinbase.com/onchain-verify</a></p>
              </div>
            {/if}

            <div class="step-nav">
              <button class="btn btn-secondary" on:click={goBack}>← Back</button>
              <button class="btn btn-primary btn-lg" on:click={startMint}>
                {network === 'celo' ? '🛂 Start passport verification' : '⛓ Register on Base'}
              </button>
            </div>

          {:else if mintStatus === 'pinning'}
            <div class="status-block">
              <div class="spinner"></div>
              <p>Pinning metadata to IPFS...</p>
            </div>

          {:else if mintStatus === 'minting' && network === 'celo'}
            <div class="status-block">
              <div class="spinner"></div>
              <p>Initiating Self verification session...</p>
            </div>

          {:else if mintStatus === 'polling' && network === 'celo' && selfDeepLink}
            <div class="qr-section">
              <QRDisplay value={selfDeepLink} status={qrStatus} />
              <p class="muted-text mt">
                Or open directly on your phone:
                <a href={selfDeepLink} target="_blank" rel="noopener">Open Self app →</a>
              </p>
            </div>

          {:else if mintStatus === 'minting' && network === 'base'}
            <div class="status-block">
              <div class="spinner"></div>
              <p>Approve the transaction in your wallet...</p>
            </div>

          {:else if mintStatus === 'polling' && network === 'base'}
            <div class="status-block">
              <div class="spinner"></div>
              <p>Waiting for transaction confirmation...</p>
            </div>

          {:else if mintStatus === 'error'}
            <div class="card error-card">
              <h3>❌ Registration failed</h3>
              <p>{mintError}</p>
              <button class="btn btn-secondary" on:click={() => { mintStatus = 'idle'; }}>Try again</button>
            </div>
          {/if}
        </div>

      <!-- ── Step 4: Success ── -->
      {:else if step === 4}
        <div class="step-content success-step">
          <div class="success-icon">🎉</div>
          <h2 class="step-title">Agent registered!</h2>
          <p class="step-sub">Your agent has an on-chain identity. Here are your details:</p>

          <div class="card summary-card">
            <div class="summary-row">
              <span>Agent ID</span>
              <strong class="mono">#{mintedAgentId}</strong>
            </div>
            <div class="summary-row">
              <span>Network</span>
              <span class="badge {network === 'celo' ? 'badge-celo' : 'badge-base'}">{network === 'celo' ? 'Celo' : 'Base'}</span>
            </div>
            {#if mintedTxHash}
              <div class="summary-row">
                <span>Transaction</span>
                <a
                  href="{network === 'celo' ? 'https://celoscan.io/tx/' : 'https://basescan.org/tx/'}{mintedTxHash}"
                  target="_blank" rel="noopener"
                  class="mono tx-link"
                >{truncate(mintedTxHash)}</a>
              </div>
            {/if}
          </div>

          <div class="success-links">
            <a href={agentCertUrl} class="btn btn-primary btn-lg">View Agent Certificate →</a>
            <a href={ownerUrl} class="btn btn-secondary">View Owner Profile</a>
          </div>

          {#if keypair && !keySaved}
            <div class="card key-reminder">
              <h3>⚠ Save your agent private key</h3>
              <p>You have not downloaded your agent private key yet. Save it now — it cannot be recovered.</p>
              <button class="btn btn-primary" on:click={handleDownloadKey}>⬇ Download Agent Key</button>
            </div>
          {/if}

          <div class="register-another">
            <a href="/register" class="muted-link" on:click|preventDefault={() => {
              step = 0; network = null; keypair = null; keySaved = false;
              agentName = ''; agentDescription = ''; agentImage = '';
              endpoints = [{ protocol: 'MCP', url: '', version: '' }];
              mintStatus = 'idle'; mintedAgentId = null; mintedTxHash = '';
            }}>Register another agent</a>
          </div>
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .page { display: flex; flex-direction: column; min-height: 100vh; }

  /* Nav */
  .nav {
    position: sticky; top: 0; z-index: 100;
    border-bottom: 1px solid var(--color-border);
    background: rgba(10, 10, 10, 0.9);
    backdrop-filter: blur(12px);
  }
  .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .nav-logo { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--color-text); }
  .nav-wordmark { font-family: var(--font-heading); font-weight: 700; font-size: 1rem; }
  .nav-step-label { font-size: 0.85rem; color: var(--color-text-muted); font-family: var(--font-heading); }

  /* Main */
  .main { flex: 1; padding: 2.5rem 0 4rem; }
  .wizard-wrap { max-width: 680px; margin: 0 auto; padding: 0 1.5rem; }

  /* Steps */
  .step-content { animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .step-title { font-size: 1.75rem; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
  .step-sub { color: var(--color-text-muted); margin-bottom: 2rem; }

  /* Network cards */
  .network-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 560px) { .network-cards { grid-template-columns: 1fr; } }

  .network-card {
    background: var(--color-bg-2);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 1.5rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex; flex-direction: column; gap: 0.75rem;
  }
  .network-card:hover { border-color: var(--color-accent); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
  .network-card h3 { font-size: 1.1rem; }
  .network-card p { font-size: 0.85rem; color: var(--color-text-muted); line-height: 1.5; }
  .network-features { list-style: none; display: flex; flex-direction: column; gap: 0.3rem; }
  .network-features li { font-size: 0.8rem; color: var(--color-text-muted); }
  .network-req { font-size: 0.75rem; color: var(--color-text-faint); border-top: 1px solid var(--color-border); padding-top: 0.5rem; margin-top: 0.25rem; }
  .network-cta { margin-top: 0.5rem; }

  /* Sections */
  .section-card { margin-bottom: 1rem; }
  .section-card.disabled { opacity: 0.4; pointer-events: none; }
  .section-label { font-family: var(--font-heading); font-size: 0.9rem; font-weight: 600; margin-bottom: 0.75rem; }

  /* Wallet */
  .wallet-connected { display: flex; align-items: center; gap: 0.75rem; }
  .addr { font-size: 0.9rem; }
  .muted-text { font-size: 0.875rem; color: var(--color-text-muted); margin-bottom: 1rem; }
  .error-text { font-size: 0.875rem; color: var(--color-danger); margin-bottom: 0.75rem; }

  /* Key display */
  .key-display { display: flex; flex-direction: column; gap: 1rem; }
  .key-row { display: flex; flex-direction: column; gap: 0.35rem; }
  .key-label { font-size: 0.75rem; font-weight: 600; color: var(--color-text-muted); display: flex; align-items: center; gap: 0.5rem; }
  .warning-tag { background: var(--color-warning-dim); color: var(--color-warning); border-radius: 4px; padding: 0.1rem 0.35rem; font-size: 0.7rem; }
  .key-value-row { display: flex; align-items: center; gap: 0.5rem; }
  .key-val { font-size: 0.75rem; background: var(--color-bg-3); padding: 0.4rem 0.6rem; border-radius: 6px; word-break: break-all; flex: 1; }
  .pk { color: var(--color-warning); }
  .copy-btn { background: none; border: 1px solid var(--color-border); border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer; color: var(--color-text-muted); font-size: 0.9rem; flex-shrink: 0; }
  .copy-btn:hover { background: var(--color-bg-3); color: var(--color-text); }
  .key-actions { display: flex; align-items: center; gap: 0.75rem; }
  .warning-text { font-size: 0.8rem; color: var(--color-warning); }

  /* Form */
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.25rem; }
  .form-label { font-size: 0.85rem; font-weight: 600; font-family: var(--font-heading); }
  .required { color: var(--color-danger); }
  .optional { color: var(--color-text-faint); font-weight: 400; }
  .form-input {
    background: var(--color-bg-3);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 0.9rem;
    width: 100%;
    transition: border-color 0.15s;
  }
  .form-input:focus { outline: none; border-color: var(--color-accent); }
  .form-textarea { resize: vertical; min-height: 80px; }
  .form-hint { font-size: 0.75rem; color: var(--color-text-faint); }

  /* Endpoints */
  .endpoint-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; }
  .ep-protocol { width: 90px; flex-shrink: 0; }
  .ep-url { flex: 1; min-width: 0; }
  .ep-version { width: 110px; flex-shrink: 0; }
  .remove-btn { background: none; border: 1px solid var(--color-border); color: var(--color-text-muted); border-radius: 6px; padding: 0.4rem 0.6rem; cursor: pointer; flex-shrink: 0; }
  .remove-btn:hover { color: var(--color-danger); border-color: var(--color-danger); }
  .add-ep-btn { margin-top: 0.5rem; }

  /* Summary */
  .summary-card { margin-bottom: 1.5rem; }
  .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border); font-size: 0.875rem; }
  .summary-row:last-child { border-bottom: none; }
  .tx-link { font-size: 0.8rem; color: var(--color-accent); }

  /* Info card */
  .info-card { margin-bottom: 1.5rem; }
  .info-card h3 { font-size: 1rem; margin-bottom: 0.75rem; }
  .steps-list { list-style: decimal; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.875rem; color: var(--color-text-muted); margin-bottom: 0.75rem; }

  /* Status */
  .status-block { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 2rem; }
  .spinner {
    width: 36px; height: 36px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* QR */
  .qr-section { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem 0; }
  .mt { margin-top: 0.5rem; }

  /* Error card */
  .error-card { border-color: var(--color-danger); }
  .error-card h3 { color: var(--color-danger); margin-bottom: 0.5rem; }
  .error-card p { font-size: 0.875rem; color: var(--color-text-muted); margin-bottom: 1rem; }

  /* Success */
  .success-step { text-align: center; }
  .success-icon { font-size: 3rem; margin-bottom: 1rem; }
  .success-links { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; margin: 1.5rem 0; }
  .key-reminder { text-align: left; border-color: var(--color-warning); margin-bottom: 1rem; }
  .key-reminder h3 { color: var(--color-warning); margin-bottom: 0.5rem; }
  .key-reminder p { font-size: 0.875rem; color: var(--color-text-muted); margin-bottom: 1rem; }
  .register-another { margin-top: 1.5rem; }
  .muted-link { color: var(--color-text-muted); font-size: 0.875rem; cursor: pointer; }
  .muted-link:hover { color: var(--color-text); }

  /* Nav */
  .step-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border); }
</style>
```

---

## STEP 8: Fix the Base mint

The `encodeFunctionData` helper inside `mintBase()` is a placeholder. Remove `mintBase()` entirely and replace all references to it with a call to `mintBaseWithViem()`. The `mintBaseWithViem()` function at the bottom of the script is the correct implementation using viem's `walletClient.writeContract()`.

Update `startMint()` to call `mintBaseWithViem()` instead of `mintBase()` for Base. Remove the `mintBase()` function and the `encodeFunctionData` helper entirely.

---

## STEP 9: Handle SSR for viem imports

In `vite.config.ts`, add SSR config to prevent viem from being processed server-side (it uses browser crypto):

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  ssr: {
    noExternal: ['viem'],
  },
});
```

---

## STEP 10: Build and verify

```bash
cd /home/erasmus/.openclaw/workspace/waymint
npm run build 2>&1
```

Fix all errors. Common issues:
- If `@selfxyz/agent-sdk` causes SSR issues: add it to `ssr.noExternal` in vite.config.ts
- TypeScript errors in .svelte files about `window.ethereum`: the `declare global { interface Window { ethereum?: any } }` in wallet.ts covers this — if still failing, add `// @ts-ignore` on that line
- If `qrcode` has issues: also add to `ssr.noExternal`
- The `mintBase()` and `encodeFunctionData` dead code must be removed before the build will pass

---

## STEP 11: Commit

```bash
cd /home/erasmus/.openclaw/workspace/waymint
git add -A
git commit -m "feat: Phase 3 — full registration wizard (network, wallet, details, verify, success)"
```

---

## When done

```
openclaw system event --text "Done: wayMint Phase 3 complete. Registration wizard built — all 5 steps, Celo Self SDK flow, Base viem flow, QR display, agent key generation, IPFS pin proxy. Build passes." --mode now
```
