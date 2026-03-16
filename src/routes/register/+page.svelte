<script lang="ts">
  import { tick } from 'svelte';
  import Stepper from '$lib/components/Stepper.svelte';
  import QRDisplay from '$lib/components/QRDisplay.svelte';
  import WalletButton from '$lib/components/WalletButton.svelte';
  import { connectWallet, walletAddress, walletError, isConnecting } from '$lib/wallet';
  import { pinToIPFS } from '$lib/ipfs';

  // ── Wizard state ──────────────────────────────────────────────────────────
  type Network = 'celo' | 'base';
  type Step = 0 | 1 | 2 | 3 | 4;

  const STEPS = ['Network', 'Wallet & Key', 'Agent Details', 'Verify & Mint', 'Success'];

  let step: Step = 0;
  let network: Network | null = null;
  let agentAddressInput = '';

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

  // Base Coinbase verification prompt
  let showCoinbasePrompt = false;
  let proceedUnverified = false;

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

  // ── Step 3: Endpoints ─────────────────────────────────────────────────────
  function addEndpoint() {
    endpoints = [...endpoints, { protocol: 'Web', url: '', version: '' }];
  }

  function removeEndpoint(i: number) {
    endpoints = endpoints.filter((_, idx) => idx !== i);
  }

  function getEndpointPlaceholder(protocol: string): string {
    switch (protocol) {
      case 'MCP': return 'https://my-agent.example.com/mcp';
      case 'A2A': return 'https://my-agent.example.com/a2a';
      case 'Email': return 'name@email.com';
      case 'Web': return 'https://my-agent.example.com';
      case 'Custom': return 'Enter endpoint URL or identifier';
      default: return 'https://...';
    }
  }

  // ── Step 4: Mint ──────────────────────────────────────────────────────────
  async function startMint() {
    mintStatus = 'pinning';
    mintError = '';

    try {
      if (network === 'celo') {
        // For Celo, Self SDK handles the registration file internally
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
      mintError = e.message ?? 'Unknown error during minting';
    }
  }

  async function mintCelo() {
    if (!$walletAddress) return;

    try {
      // Step 1: Call Self Agent ID API to get a session + deepLink
      const res = await fetch('https://app.ai.self.xyz/api/agent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'linked',
          network: 'mainnet',
          humanAddress: $walletAddress,
          agentName,
          agentDescription,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Registration API error: ${res.status}`);
      }
      const session = await res.json();

      if (!session.deepLink) throw new Error('No deepLink in registration response');

      // Extract sessionId from the deepLink
      const deepLinkUrl = new URL(session.deepLink);
      const selfAppParam = deepLinkUrl.searchParams.get('selfApp');
      if (!selfAppParam) throw new Error('No selfApp param in deepLink');
      const selfAppData = JSON.parse(decodeURIComponent(selfAppParam));
      const sessionId: string = selfAppData.sessionId;

      // Step 2: Show QR — update state and flush DOM before connecting socket
      selfDeepLink = session.deepLink;
      qrStatus = 'waiting';
      mintStatus = 'polling';
      await tick();

      // Step 3: Connect to Self WebSocket relay and wait for proof_verified
      await new Promise<void>((resolve, reject) => {
        // Dynamic import to avoid SSR issues
        import('socket.io-client').then(({ io }) => {
          const socket = io('wss://websocket.self.xyz/websocket', {
            path: '/',
            query: { sessionId, clientType: 'web' },
            transports: ['websocket'],
          });

          const timeout = setTimeout(() => {
            socket.disconnect();
            reject(new Error('Self verification timed out (10 min). Please try again.'));
          }, 10 * 60 * 1000);

          socket.on('connect', () => {
            console.log('[Self WS] Connected, sessionId:', sessionId);
          });

          socket.on('connect_error', (err) => {
            console.error('[Self WS] Connection error:', err.message);
          });

          socket.on('mobile_status', async (data: { status: string; [k: string]: any }) => {
            console.log('[Self WS] mobile_status:', data.status);
            switch (data.status) {
              case 'mobile_connected':
                qrStatus = 'connected';
                await tick();
                // Tell the relay what app/config to send to the phone
                socket.emit('self_app', { ...selfAppData, sessionId });
                break;
              case 'mobile_disconnected':
                qrStatus = 'waiting';
                await tick();
                break;
              case 'proof_generation_started':
              case 'proof_generated':
                qrStatus = 'generating';
                await tick();
                break;
              case 'proof_generation_failed':
                clearTimeout(timeout);
                socket.disconnect();
                reject(new Error('ZK proof generation failed on the Self app. Please try again.'));
                break;
              case 'proof_verified':
                clearTimeout(timeout);
                qrStatus = 'done';
                await tick();

                // The WS event doesn't include agentId — query the chain for the
                // most recent Transfer (mint) event to the owner's wallet
                try {
                  const { createPublicClient, http, parseAbi } = await import('viem');
                  const { celo } = await import('$lib/chains');
                  const client = createPublicClient({ chain: celo, transport: http() });
                  const REGISTRY = '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944' as `0x${string}`;
                  const transferAbi = parseAbi([
                    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
                  ]);
                  // Fetch last ~2000 blocks (Celo ~5s blocks ≈ ~3h window, plenty)
                  const latestBlock = await client.getBlockNumber();
                  const logs = await client.getLogs({
                    address: REGISTRY,
                    event: transferAbi[0],
                    args: {
                      from: '0x0000000000000000000000000000000000000000',
                      to: ($walletAddress as `0x${string}`),
                    },
                    fromBlock: latestBlock - 2000n > 0n ? latestBlock - 2000n : 0n,
                    toBlock: 'latest',
                  });
                  if (logs.length > 0) {
                    // Most recent mint is the last log
                    const lastLog = logs[logs.length - 1];
                    mintedAgentId = Number(lastLog.args.tokenId);
                    mintedTxHash = lastLog.transactionHash ?? '';
                  }
                } catch (chainErr) {
                  console.warn('[Celo] Could not fetch agentId from chain:', chainErr);
                }

                socket.disconnect();
                resolve();
                break;
            }
          });

          socket.on('disconnect', (reason) => {
            console.log('[Self WS] Disconnected:', reason);
          });
        }).catch(reject);
      });

      await new Promise(r => setTimeout(r, 1200));
      mintStatus = 'done';
      step = 4 as Step;

    } catch (e: any) {
      qrStatus = 'error';
      mintStatus = 'error';
      mintError = e.message ?? `Celo registration failed: ${String(e)}`;
    }
  }

  async function mintBaseWithViem() {
    if (!$walletAddress || typeof window === 'undefined' || !window.ethereum) {
      mintError = 'Wallet not connected';
      mintStatus = 'error';
      return;
    }

    try {
      // Switch to Base if needed
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (parseInt(currentChainId as string, 16) !== 8453) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
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
      const { createPublicClient, createWalletClient, custom, http, parseAbi, parseEventLogs } = await import('viem');
      const { base } = await import('$lib/chains');

      const publicClient = createPublicClient({ chain: base, transport: http() });

      const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as `0x${string}`;
      const SCHEMA_UID = '0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9' as `0x${string}`;

      const easAbi = parseAbi([
        'function getAttestation(bytes32 uid) external view returns ((bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address recipient, address attester, bool revocable, bytes data))',
        'function getSchemaAttestations(bytes32 schema, address recipient) external view returns (bytes32[] memory)',
      ]);

      let hasVerification = false;
      try {
        const attUids = await publicClient.readContract({
          address: EAS_ADDRESS,
          abi: easAbi,
          functionName: 'getSchemaAttestations',
          args: [SCHEMA_UID, $walletAddress as `0x${string}`],
        });
        hasVerification = (attUids as any[]).length > 0;
      } catch {
        hasVerification = false;
      }

      if (!hasVerification && !proceedUnverified) {
        showCoinbasePrompt = true;
        mintStatus = 'idle';
        return;
      }

      // Call register(agentURI) via viem walletClient
      const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`;
      const registryAbi = parseAbi([
        'function register(string calldata agentURI) external returns (uint256 agentId)',
        'event Registered(uint256 indexed agentId, address indexed owner, string agentURI)',
      ]);

      const walletClient = createWalletClient({
        chain: base,
        transport: custom(window.ethereum),
      });

      const hash = await walletClient.writeContract({
        address: REGISTRY,
        abi: registryAbi,
        functionName: 'register',
        args: [agentURI],
        account: $walletAddress as `0x${string}`,
      });

      mintedTxHash = hash;
      mintStatus = 'polling';

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({ abi: registryAbi, logs: receipt.logs });
      const ev = logs.find((l: any) => l.eventName === 'Registered') as any;
      if (ev) mintedAgentId = Number(ev.args.agentId);

      mintStatus = 'done';
      step = 4 as Step;
    } catch (e: any) {
      mintStatus = 'error';
      mintError = e.message ?? 'Base mint failed';
    }
  }

  // Validation helpers
  $: step2Valid = !!$walletAddress && /^0x[a-fA-F0-9]{40}$/.test(agentAddressInput);
  $: step3Valid = agentName.trim().length >= 3 && endpoints.some((e) => e.url.trim());
  $: agentCertUrl = mintedAgentId !== null ? `/agent/${network}:${mintedAgentId}` : '';
  $: ownerUrl = $walletAddress ? `/owner/${$walletAddress}` : '';

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
  <nav class="nav">
    <div class="container nav-inner">
      <a href="/" class="nav-logo">
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="var(--brand-offset-blue)" opacity="0.15"/>
          <path d="M14 4L22 9V19L14 24L6 19V9L14 4Z" stroke="var(--brand-offset-blue)" stroke-width="1.5" fill="none"/>
          <circle cx="14" cy="14" r="3" fill="var(--brand-offset-blue)"/>
        </svg>
        <span class="nav-wordmark">wayMint</span>
      </a>
      <div class="nav-actions">
        <WalletButton />
        <span class="nav-step-label">Register Agent</span>
      </div>
    </div>
  </nav>

  <main class="main">
    <div class="wizard-wrap">
      <Stepper steps={STEPS} current={step} />

      <!-- Step 0: Choose Network -->
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
                <li>Real passport NFC scan</li>
                <li>ZK privacy — no data revealed</li>
                <li>Sybil-resistant via nullifier</li>
                <li>~3 min registration</li>
              </ul>
              <div class="network-req">Requires: Self app (iOS/Android) + passport</div>
              <div class="network-cta btn btn-primary">Select Celo</div>
            </button>

            <button class="network-card" on:click={() => selectNetwork('base')}>
              <div class="network-badge badge badge-base">Base Mainnet</div>
              <h3>Coinbase Verifications</h3>
              <p>EAS attestation via Coinbase identity verification. No passport scan needed — just a verified Coinbase account.</p>
              <ul class="network-features">
                <li>Coinbase identity check</li>
                <li>On-chain EAS attestation</li>
                <li>ERC-8004 Identity Registry</li>
                <li>~2 min registration</li>
              </ul>
              <div class="network-req">Requires: Verified Coinbase account</div>
              <div class="network-cta btn btn-secondary">Select Base</div>
            </button>
          </div>
        </div>

      <!-- Step 1: Wallet & Key -->
      {:else if step === 1}
        <div class="step-content">
          <h2 class="step-title">Connect wallet &amp; agent address</h2>
          <p class="step-sub">Your wallet establishes ownership of the agent NFT. Your agent should generate its own keypair.</p>

          <div class="card section-card">
            <h3 class="section-label">1. Connect your wallet</h3>
            {#if $walletAddress}
              <div class="wallet-connected">
                <span class="badge badge-verified">Connected</span>
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

          <div class="card section-card info-card" class:disabled={!$walletAddress}>
            <h3 class="section-label">2. Agent address</h3>
            <p class="muted-text">Your agent should generate its own keypair.</p>
            <p class="muted-text">If you are an agent, generate your ECDSA keypair now and have your address ready. If you are a human setting this up, ask your agent to generate a keypair and give you the agent address before proceeding.</p>
            <a href="/skill.md" class="muted-link">&rarr; How agents self-register (skill.md)</a>
            <div class="form-group" style="margin-top: 1rem;">
              <label class="form-label" for="agentAddress">Agent address <span class="required">*</span></label>
              <input
                id="agentAddress"
                type="text"
                class="form-input"
                bind:value={agentAddressInput}
                placeholder="0x..."
                pattern="^0x[a-fA-F0-9]{'{'}40{'}'}"
              />
              <span class="form-hint">The Ethereum address your agent generated for itself</span>
            </div>
          </div>

          <div class="step-nav">
            <button class="btn btn-secondary" on:click={goBack}>Back</button>
            <button class="btn btn-primary" on:click={goNext} disabled={!step2Valid}>
              Continue
            </button>
          </div>
        </div>

      <!-- Step 2: Agent Details -->
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
              />
              <span class="form-hint">3-32 chars, alphanumeric and hyphens</span>
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

          <div class="card section-card">
            <h3 class="section-label">Service endpoints <span class="required">*</span></h3>
            <p class="muted-text">At least one endpoint is required.</p>

            {#each endpoints as ep, i}
              <div class="endpoint-card-item">
                <div class="endpoint-card-header">
                  <span class="endpoint-card-num">Endpoint {i + 1}</span>
                  {#if endpoints.length > 1}
                    <button class="remove-btn" on:click={() => removeEndpoint(i)}>&#x2715; Remove</button>
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

            <button class="btn btn-secondary btn-sm add-ep-btn" on:click={addEndpoint}>
              + Add endpoint
            </button>
          </div>

          <div class="step-nav">
            <button class="btn btn-secondary" on:click={goBack}>Back</button>
            <button class="btn btn-primary" on:click={goNext} disabled={!step3Valid}>
              Continue
            </button>
          </div>
        </div>

      <!-- Step 3: Verify & Mint -->
      {:else if step === 3}
        <div class="step-content">
          <h2 class="step-title">
            {network === 'celo' ? 'Scan passport & mint' : 'Verify & mint on Base'}
          </h2>

          <div class="card summary-card">
            <div class="summary-row"><span>Network</span> <span class="badge {network === 'celo' ? 'badge-celo' : 'badge-base'}">{network === 'celo' ? 'Celo Mainnet' : 'Base Mainnet'}</span></div>
            <div class="summary-row"><span>Agent name</span> <strong>{agentName}</strong></div>
            <div class="summary-row"><span>Owner wallet</span> <code class="mono">{truncate($walletAddress ?? '')}</code></div>
            <div class="summary-row"><span>Agent address</span> <code class="mono">{truncate(agentAddressInput)}</code></div>
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
              </div>
            {/if}

            <div class="step-nav">
              <button class="btn btn-secondary" on:click={goBack}>Back</button>
              <button class="btn btn-primary btn-lg" on:click={startMint}>
                {network === 'celo' ? 'Start passport verification' : 'Register on Base'}
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
                <a href={selfDeepLink} target="_blank" rel="noopener">Open Self app</a>
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
              <h3>Registration failed</h3>
              <p>{mintError}</p>
              <div class="step-nav" style="border-top: none; padding-top: 0; margin-top: 1rem;">
                <button class="btn btn-secondary" on:click={goBack}>Back</button>
                <button class="btn btn-secondary" on:click={() => { mintStatus = 'idle'; }}>Try again</button>
              </div>
            </div>
          {/if}

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
                  Get verified on Coinbase &rarr;
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
        </div>

      <!-- Step 4: Success -->
      {:else if step === 4}
        <div class="step-content success-step">
          <div class="success-icon">&#x1f389;</div>
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
            <a href={agentCertUrl} class="btn btn-primary btn-lg">View Agent Certificate</a>
            <a href={ownerUrl} class="btn btn-secondary">View Owner Profile</a>
          </div>

          <div class="register-another">
            <a href="/register" class="muted-link" on:click|preventDefault={() => {
              step = 0; network = null; agentAddressInput = '';
              agentName = ''; agentDescription = ''; agentImage = '';
              endpoints = [{ protocol: 'MCP', url: '', version: '' }];
              mintStatus = 'idle'; mintedAgentId = null; mintedTxHash = '';
              showCoinbasePrompt = false; proceedUnverified = false;
            }}>Register another agent</a>
          </div>
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .page { display: flex; flex-direction: column; min-height: 100vh; }

  .nav {
    position: sticky; top: 0; z-index: 100;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--background) 90%, transparent);
    backdrop-filter: blur(12px);
  }
  .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .nav-actions { display: flex; align-items: center; gap: 0.5rem; }
  .nav-logo { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--foreground); }
  .nav-wordmark { font-family: var(--font-heading); font-weight: 700; font-size: 1rem; }
  .nav-step-label { font-size: 0.85rem; color: var(--muted-foreground); font-family: var(--font-heading); }

  .main { flex: 1; padding: 2.5rem 0 4rem; }
  .wizard-wrap { max-width: 680px; margin: 0 auto; padding: 0 1.5rem; }

  .step-content { animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .step-title { font-size: 1.75rem; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
  .step-sub { color: var(--muted-foreground); margin-bottom: 2rem; }

  .network-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 560px) { .network-cards { grid-template-columns: 1fr; } }

  .network-card {
    background: var(--card);
    outline: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    outline-offset: -1px;
    border-radius: calc(var(--radius) * 1.3);
    border: none;
    padding: 1.5rem;
    text-align: left;
    cursor: pointer;
    transition: all 150ms ease-out;
    display: flex; flex-direction: column; gap: 0.75rem;
    color: var(--card-foreground);
  }
  .network-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px oklch(0 0 0 / 20%); outline-color: var(--brand-offset-blue); }
  .network-card h3 { font-size: 1.1rem; }
  .network-card p { font-size: 0.85rem; color: var(--muted-foreground); line-height: 1.5; }
  .network-features { list-style: none; display: flex; flex-direction: column; gap: 0.3rem; }
  .network-features li { font-size: 0.8rem; color: var(--muted-foreground); }
  .network-req { font-size: 0.75rem; color: var(--muted-foreground); border-top: 1px solid var(--border); padding-top: 0.5rem; margin-top: 0.25rem; }
  .network-cta { margin-top: 0.5rem; }

  .section-card { margin-bottom: 1rem; }
  .section-card.disabled { opacity: 0.4; pointer-events: none; }
  .section-label { font-family: var(--font-heading); font-size: 0.9rem; font-weight: 600; margin-bottom: 0.75rem; }

  .wallet-connected { display: flex; align-items: center; gap: 0.75rem; }
  .addr { font-size: 0.9rem; }
  .muted-text { font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 1rem; }
  .error-text { font-size: 0.875rem; color: var(--destructive); margin-bottom: 0.75rem; }

  .form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.25rem; }
  .form-label { font-size: 0.85rem; font-weight: 600; font-family: var(--font-heading); }
  .required { color: var(--destructive); }
  .optional { color: var(--muted-foreground); font-weight: 400; }
  .form-hint { font-size: 0.75rem; color: var(--muted-foreground); }

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
  .add-ep-btn { margin-top: 0.5rem; }

  .summary-card { margin-bottom: 1.5rem; }
  .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border); font-size: 0.875rem; }
  .summary-row:last-child { border-bottom: none; }
  .tx-link { font-size: 0.8rem; }

  .info-card { margin-bottom: 1.5rem; }
  .info-card h3 { font-size: 1rem; margin-bottom: 0.75rem; }
  .steps-list { list-style: decimal; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 0.75rem; }

  .status-block { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 2rem; }

  .qr-section { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem 0; }
  .mt { margin-top: 0.5rem; }

  .error-card { outline-color: var(--destructive); }
  .error-card h3 { color: var(--destructive); margin-bottom: 0.5rem; }
  .error-card p { font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 1rem; }

  .success-step { text-align: center; }
  .success-icon { font-size: 3rem; margin-bottom: 1rem; }
  .success-links { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; margin: 1.5rem 0; }
  .register-another { margin-top: 1.5rem; }

  .coinbase-prompt { border-color: var(--brand-offset-blue); margin-bottom: 1.5rem; }
  .coinbase-prompt h3 { margin-bottom: 0.5rem; }
  .coinbase-prompt p { font-size: 0.875rem; color: var(--muted-foreground); margin-bottom: 1rem; }
  .prompt-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
  .prompt-note { font-size: 0.8rem; color: var(--muted-foreground); margin-top: 0.75rem; }
  .muted-link { color: var(--muted-foreground); font-size: 0.875rem; cursor: pointer; }
  .muted-link:hover { color: var(--foreground); }

  .step-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
</style>
