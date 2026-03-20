<script lang="ts">
  import { tick } from 'svelte';
  import Stepper from '$lib/components/Stepper.svelte';
  import QRDisplay from '$lib/components/QRDisplay.svelte';
  import { connectWallet, walletAddress, walletError, isConnecting } from '$lib/wallet';
  import { pinToIPFS } from '$lib/ipfs';
  import type QRCodeLib from 'qrcode';

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

  // Celo proof method sub-selector
  let celoProofMethod: 'self' | 'worldid' | null = null;

  // World ID state
  let worldIdStatus: 'idle' | 'pending' | 'verified' | 'error' = 'idle';
  let worldIdError = '';

  // Celo / Self QR state
  type QRStatus = 'waiting' | 'connected' | 'generating' | 'done' | 'error';
  let qrStatus: QRStatus = 'waiting';
  let selfDeepLink = '';

  // Base Coinbase verification prompt
  let showCoinbasePrompt = false;
  let proceedUnverified = false;

  // ── Base identity flow state ────────────────────────────────────────────
  let baseQRUri = '';
  let qrCanvas: HTMLCanvasElement;
  let siweVerified = false;
  let siweLoading = false;
  let siweError = '';
  let identityLoading = false;
  let identity: any = null;
  let hasEnoughForEas = false;
  let wantEasAttestation = false;
  let coinbaseProvider: any = null;

  function getIdentityAvatarFallback(addr: string): string {
    return (addr || '??').slice(2, 4).toUpperCase();
  }

  async function connectBaseWallet() {
    isConnecting.set(true);
    try {
      const { CoinbaseWalletSDK } = await import('@coinbase/wallet-sdk');
      const QRCode = (await import('qrcode')).default as typeof QRCodeLib;

      const sdk = new CoinbaseWalletSDK({
        appName: 'wayMint',
        appLogoUrl: 'https://8004.way.je/logo.png',
        appChainIds: [8453],
      });
      coinbaseProvider = sdk.makeWeb3Provider({ options: 'all' });

      // Listen for QR URI events
      coinbaseProvider.on('message', (msg: any) => {
        if (msg.type === 'qrUrl') {
          baseQRUri = msg.data;
          tick().then(() => {
            if (qrCanvas) QRCode.toCanvas(qrCanvas, baseQRUri, { width: 220 });
          });
        }
      });

      const accounts = await coinbaseProvider.request({ method: 'eth_requestAccounts' });
      if (accounts[0]) {
        walletAddress.set(accounts[0]);
        await resolveBaseIdentity(accounts[0]);
        await checkEasBalance(accounts[0]);
      }
    } catch (e: any) {
      walletError.set(e.message ?? 'Connection failed');
    } finally {
      isConnecting.set(false);
    }
  }

  async function resolveBaseIdentity(address: string) {
    identityLoading = true;
    try {
      const res = await fetch('/api/resolve/' + address);
      if (res.ok) identity = await res.json();
    } finally {
      identityLoading = false;
    }
  }

  async function checkEasBalance(address: string) {
    try {
      if (!coinbaseProvider) return;
      const balance = await coinbaseProvider.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });
      hasEnoughForEas = BigInt(balance) >= 50000000000000n;
    } catch {}
  }

  async function doSiwe() {
    siweLoading = true;
    siweError = '';
    try {
      const nonceRes = await fetch('/api/nonce');
      const { nonce } = await nonceRes.json();

      const address = $walletAddress;
      const name = identity?.name;

      const statement = name
        ? 'Verify ownership of ' + name + ' for wayMint agent registration.'
        : 'Verify wallet ownership for wayMint agent registration.';

      const issuedAt = new Date().toISOString();
      const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Format as EIP-4361 message string
      const msgStr = [
        '8004.way.je wants you to sign in with your Ethereum account:',
        address,
        '',
        statement,
        '',
        'URI: https://8004.way.je',
        'Version: 1',
        'Chain ID: 8453',
        'Nonce: ' + nonce,
        'Issued At: ' + issuedAt,
        'Expiration Time: ' + expirationTime,
      ].join('\n');

      const provider = coinbaseProvider || window.ethereum;
      const signature = await provider.request({
        method: 'personal_sign',
        params: [msgStr, address],
      });

      const verifyRes = await fetch('/api/verify-siwe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgStr, signature, claimedName: name || null }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error ?? 'Verification failed');
      }

      const verifiedIdentity = await verifyRes.json();
      identity = { ...identity, ...verifiedIdentity };
      siweVerified = true;
    } catch (e: any) {
      siweError = e.message ?? 'Signing failed';
    } finally {
      siweLoading = false;
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function goNext() { step = (step + 1) as Step; }
  function goBack() { step = (step - 1) as Step; }

  // ── Step 1: Network ───────────────────────────────────────────────────────
  function selectNetwork(n: Network) {
    network = n;
    if (n === 'base') {
      goNext();
      // If Base and already connected via a non-Coinbase provider, resolve identity gracefully
      if ($walletAddress && !coinbaseProvider) {
        resolveBaseIdentity($walletAddress);
        if (typeof window !== 'undefined' && window.ethereum) {
          window.ethereum.request({ method: 'eth_getBalance', params: [$walletAddress, 'latest'] })
            .then((bal: string) => { hasEnoughForEas = BigInt(bal) >= 50000000000000n; })
            .catch(() => {});
        }
      }
    }
    // For "celo": stay on step 0, show sub-selector
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

  // ── World ID flow ────────────────────────────────────────────────────────
  // World ID bridge: manual implementation since IDKit v4 requires rp_context
  // (server-side signing key) which we don't have. We use the bridge HTTP protocol directly.
  const WORLDID_BRIDGE = 'https://bridge.worldcoin.org';
  let worldIdBridgeUrl = '';

  async function startWorldIdVerification() {
    worldIdStatus = 'pending';
    worldIdError = '';
    try {
      // Pin metadata first
      mintStatus = 'pinning';
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
        supportedTrust: ['reputation', 'worldid'],
        verificationProvider: 'worldid',
      });
      mintStatus = 'idle';

      // hashSignal: keccak256 of the signal, with the top byte zeroed (World ID spec)
      // Implemented inline to avoid @worldcoin/idkit-core WASM bundling issues on CF
      async function hashSignal(value: string): Promise<string> {
        const { keccak256, toBytes } = await import('viem');
        const hash = keccak256(toBytes(value));
        // Zero the top byte (shift right 8 bits)
        const bytes = Array.from({ length: 32 }, (_, i) => parseInt(hash.slice(2 + i * 2, 4 + i * 2), 16));
        bytes[0] = 0;
        return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      // Generate bridge request key pair (random 32 bytes)
      const keyBytes = crypto.getRandomValues(new Uint8Array(32));
      const requestId = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      // Create the bridge session by initializing the request
      const signal = $walletAddress || '';
      const signalHash = await hashSignal(signal);
      const actionHash = await hashSignal('register-agent');

      // Build the verification request payload
      const verificationRequest = {
        app_id: 'app_9b41324bf599d95f63504dc568fa1533',
        action: actionHash,
        signal_hash: signalHash,
        action_description: 'Register AI agent on wayMint',
        verification_level: 'device',
        credential_types: ['device', 'orb'],
      };

      // POST to bridge to create session
      const bridgeRes = await fetch(WORLDID_BRIDGE + '/request/' + requestId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationRequest),
      });
      if (!bridgeRes.ok) {
        throw new Error('Failed to initialize World ID bridge session');
      }

      // Generate World App deep link
      const deepLinkParams = new URLSearchParams({
        t: 'wld',
        i: requestId,
        b: WORLDID_BRIDGE,
        k: requestId,
      });
      worldIdBridgeUrl = 'https://worldcoin.org/verify?' + deepLinkParams.toString();

      // Poll bridge for result (up to 5 minutes)
      const maxPolls = 60;
      let pollCount = 0;
      let result: any = null;

      while (pollCount < maxPolls) {
        await new Promise(r => setTimeout(r, 5000));
        pollCount++;

        try {
          const pollRes = await fetch(WORLDID_BRIDGE + '/response/' + requestId);
          if (pollRes.status === 200) {
            result = await pollRes.json();
            break;
          }
          // 202 = still pending, 404 = expired
          if (pollRes.status === 404) {
            throw new Error('World ID session expired. Please try again.');
          }
        } catch (pollErr: any) {
          if (pollErr.message?.includes('expired')) throw pollErr;
        }
      }

      if (!result) {
        throw new Error('World ID verification timed out. Please try again.');
      }

      worldIdStatus = 'verified';

      // Verify server-side
      const verifyRes = await fetch('/api/verify-worldid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nullifier_hash: result.nullifier_hash,
          merkle_root: result.merkle_root,
          proof: result.proof,
          verification_level: result.verification_level ?? result.credential_type ?? 'device',
          action: 'register-agent',
          signal: signal,
        }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error ?? 'World ID verification failed');
      }
      const verified = await verifyRes.json();

      // Mint on Celo using vanilla ERC-8004 registry
      await mintWorldIdOnCelo(verified.nullifier_hash, verified.verification_level);
    } catch (e: any) {
      worldIdStatus = 'error';
      worldIdError = e.message ?? 'World ID verification failed';
      mintStatus = 'idle';
    }
  }

  async function mintWorldIdOnCelo(nullifierHash: string, verificationLevel: string) {
    if (!$walletAddress || typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Wallet not connected');
    }

    // Switch to Celo if needed
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (parseInt(currentChainId as string, 16) !== 42220) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa4ec' }],
        });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xa4ec',
              chainName: 'Celo Mainnet',
              nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
              rpcUrls: ['https://forno.celo.org'],
              blockExplorerUrls: ['https://celoscan.io'],
            }],
          });
        } else {
          throw switchErr;
        }
      }
    }

    const { createPublicClient, createWalletClient, custom, http, parseAbi, parseEventLogs, toBytes } = await import('viem');
    const { celo } = await import('$lib/chains');

    const REGISTRY = '0x68635657b46d3f3b84e6bc6a67463fB86fff8d1E' as `0x${string}`;
    const registryAbi = parseAbi([
      'function register(string calldata agentURI) external returns (uint256 agentId)',
      'function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external',
      'function setAgentWallet(uint256 agentId, address agentWallet) external',
      'event Registered(uint256 indexed agentId, address indexed owner, string agentURI)',
    ]);

    const publicClient = createPublicClient({ chain: celo, transport: http() });
    const walletClient = createWalletClient({
      chain: celo,
      transport: custom(window.ethereum),
    });
    const account = $walletAddress as `0x${string}`;

    mintStatus = 'minting';

    // Step 1: register
    const hash = await walletClient.writeContract({
      address: REGISTRY,
      abi: registryAbi,
      functionName: 'register',
      args: [agentURI],
      account,
    });

    mintStatus = 'polling';
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({ abi: registryAbi, logs: receipt.logs });
    const ev = logs.find((l: any) => l.eventName === 'Registered') as any;
    if (!ev) throw new Error('Registration event not found');
    mintedAgentId = Number(ev.args.agentId);
    mintedTxHash = hash;

    const agentIdBig = BigInt(mintedAgentId);

    // Step 2: setMetadata — store nullifier hash and verification level
    const nullifierBytes = toBytes(nullifierHash);
    await walletClient.writeContract({
      address: REGISTRY,
      abi: registryAbi,
      functionName: 'setMetadata',
      args: [agentIdBig, 'worldid-nullifier', nullifierBytes as unknown as `0x${string}`],
      account,
    });

    const levelBytes = toBytes(verificationLevel);
    await walletClient.writeContract({
      address: REGISTRY,
      abi: registryAbi,
      functionName: 'setMetadata',
      args: [agentIdBig, 'worldid-level', levelBytes as unknown as `0x${string}`],
      account,
    });

    // Step 3: setAgentWallet if agent address provided
    if (agentAddressInput && /^0x[a-fA-F0-9]{40}$/.test(agentAddressInput)) {
      await walletClient.writeContract({
        address: REGISTRY,
        abi: registryAbi,
        functionName: 'setAgentWallet',
        args: [agentIdBig, agentAddressInput as `0x${string}`],
        account,
      });
    }

    mintStatus = 'done';
    step = 4 as Step;
  }

  // Validation helpers
  $: step2Valid = !!$walletAddress && /^0x[a-fA-F0-9]{40}$/.test(agentAddressInput) && (network !== 'base' || siweVerified);
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

<main class="main">
    <div class="wizard-wrap">
      <Stepper steps={STEPS} current={step} />

      <!-- Step 0: Choose Network -->
      {#if step === 0}
        <div class="step-content">
          <h2 class="step-title">Choose your network</h2>
          <p class="step-sub">Where do you want to register your agent? Both produce an ERC-8004 identity NFT.</p>

          <div class="network-cards">
            {#if network === null || network === 'celo'}
            <button class="network-card" class:network-card-selected={network === 'celo'} on:click={() => selectNetwork('celo')}>
              <div class="network-card-logos">
                <img src="/logos/Celo_Wordmark_PMS_ProsperityYellow.svg" alt="Celo" class="card-wordmark card-wordmark-celo" />
              </div>
              <div class="network-badge badge badge-celo">Celo Mainnet</div>
              <h3>Celo — Proof of Human</h3>
              <p>Register with verified proof-of-human on Celo. Choose Self Protocol (passport NFC) or World ID (biometric/device).</p>
              <ul class="network-features">
                <li>Sybil-resistant via cryptographic proof</li>
                <li>ZK privacy — no personal data revealed</li>
                <li>Soulbound NFT with on-chain credentials</li>
              </ul>
              {#if network !== 'celo'}
                <div class="network-cta btn btn-primary">Select Celo</div>
              {/if}

              {#if network === 'celo'}
                <div class="proof-sub-selector">
                  <p class="step-sub" style="margin-bottom:1rem">Choose your proof-of-human method:</p>
                  <div class="proof-options">
                    <button class="proof-option-card" on:click|stopPropagation={() => { celoProofMethod = 'self'; goNext(); }}>
                      <div class="proof-option-logo">
                        <img src="/logos/self-logo-white.svg" alt="Self" style="height:18px" />
                      </div>
                      <div class="proof-option-body">
                        <strong>Self Protocol</strong>
                        <span>Passport NFC scan. ZK proof. ~3 min.</span>
                        <span class="proof-req">Requires: Self app + passport</span>
                      </div>
                    </button>
                    <button class="proof-option-card" on:click|stopPropagation={() => { celoProofMethod = 'worldid'; goNext(); }}>
                      <div class="proof-option-logo">🌍</div>
                      <div class="proof-option-body">
                        <strong>World ID</strong>
                        <span>Biometric or device verification. ~1 min.</span>
                        <span class="proof-req">Requires: World App with World ID</span>
                      </div>
                    </button>
                  </div>
                </div>
              {/if}
            </button>
            {/if}

            {#if network === null || network === 'base'}
            <button class="network-card" on:click={() => selectNetwork('base')}>
              <div class="network-card-logos">
                <img src="/logos/Base_lockup_white.svg" alt="Base" class="card-wordmark card-wordmark-base" />
                <img src="/logos/Coinbase_Wordmark_White.svg" alt="Coinbase" class="card-wordmark card-wordmark-coinbase" />
              </div>
              <div class="network-badge badge badge-base">Base Mainnet</div>
              <h3>Base Identity</h3>
              <p>Basename/ENS identity via the Base App. QR scan on desktop, deep-link on mobile. Optional EAS attestation.</p>
              <ul class="network-features">
                <li>Basename / ENS resolution</li>
                <li>SIWE wallet verification</li>
                <li>Optional on-chain EAS attestation</li>
                <li>~2 min registration</li>
              </ul>
              <div class="network-req">Requires: Base App or Coinbase Wallet</div>
              <div class="network-cta btn btn-secondary">Select Base</div>
            </button>
            {/if}
          </div>
        </div>

      <!-- Step 1: Wallet & Key -->
      {:else if step === 1}
        <div class="step-content">
          <h2 class="step-title">Connect wallet &amp; agent address</h2>
          <p class="step-sub">Your wallet establishes ownership of the agent NFT. Your agent should generate its own keypair.</p>

          <!-- Base: Coinbase Wallet SDK QR connection -->
          {#if network === 'base'}
            <div class="card section-card">
              <h3 class="section-label">1. Connect via Base App</h3>
              {#if !$walletAddress}
                <p class="muted-text">Scan with the Base App on your phone, or connect via Coinbase Wallet browser extension.</p>
                {#if $walletError}
                  <p class="error-text">{$walletError}</p>
                {/if}
                <button class="btn btn-primary" on:click={connectBaseWallet} disabled={$isConnecting}>
                  {$isConnecting ? 'Connecting...' : 'Connect with Base App'}
                </button>
                {#if baseQRUri}
                  <div class="qr-container">
                    <canvas bind:this={qrCanvas} class="qr-canvas"></canvas>
                    <p class="qr-hint">Scan with Base App — tap the scan icon</p>
                  </div>
                {/if}
              {:else if !coinbaseProvider}
                <!-- Already connected via header/MetaMask — graceful fallback -->
                <div class="wallet-connected">
                  <span class="badge badge-verified">Connected</span>
                  <code class="mono addr">{truncate($walletAddress)}</code>
                </div>
                <p class="muted-text" style="margin-top:0.5rem;font-size:0.8rem">
                  Connected via your browser wallet. Basename resolution will work if your address has one registered. You can still sign to verify ownership below.
                </p>
                {#if identityLoading}
                  <div class="status-block" style="padding:0.75rem 0"><div class="spinner"></div><p style="font-size:0.85rem">Resolving identity...</p></div>
                {:else if identity?.name}
                  <div class="identity-card" style="margin-top:0.5rem">
                    {#if identity.profile?.avatar}
                      <img src={identity.profile.avatar} alt="avatar" class="identity-avatar" />
                    {:else}
                      <div class="identity-avatar identity-avatar-fallback">{getIdentityAvatarFallback($walletAddress)}</div>
                    {/if}
                    <div class="identity-info">
                      <div class="identity-name">{identity.name}</div>
                      {#if identity.profile?.description}<div class="identity-desc">{identity.profile.description}</div>{/if}
                    </div>
                  </div>
                {/if}
              {:else}
                <!-- Identity card after connection -->
                <div class="wallet-connected">
                  <span class="badge badge-verified">Connected</span>
                  <code class="mono addr">{truncate($walletAddress)}</code>
                </div>
                {#if identityLoading}
                  <div class="status-block"><div class="spinner"></div><p>Resolving identity...</p></div>
                {:else if identity}
                  <div class="identity-card">
                    {#if identity.profile?.avatar}
                      <img src={identity.profile.avatar} alt="avatar" class="identity-avatar" />
                    {:else}
                      <div class="identity-avatar identity-avatar-fallback">{getIdentityAvatarFallback($walletAddress)}</div>
                    {/if}
                    <div class="identity-info">
                      {#if identity.name}
                        <div class="identity-name">{identity.name}</div>
                      {/if}
                      {#if identity.profile?.description}
                        <div class="identity-desc">{identity.profile.description}</div>
                      {/if}
                      {#if identity.coinbaseVerification?.found}
                        <span class="badge badge-verified" style="font-size:0.7rem">Coinbase Verified</span>
                      {/if}
                    </div>
                  </div>
                {/if}
              {/if}
            </div>

            <!-- SIWE signing step -->
            {#if $walletAddress && !siweVerified}
              <div class="card section-card">
                <h3 class="section-label">2. Verify ownership</h3>
                <p class="muted-text">Sign a message to prove you control this wallet. No gas required.</p>
                {#if siweError}
                  <p class="error-text">{siweError}</p>
                {/if}
                <button class="btn btn-primary" on:click={doSiwe} disabled={siweLoading}>
                  {siweLoading ? 'Waiting for signature...' : 'Sign to Verify'}
                </button>
              </div>
            {/if}

            <!-- EAS attestation toggle -->
            {#if siweVerified}
              <div class="card section-card">
                <div class="eas-toggle-row">
                  <div>
                    <div class="section-label">On-chain identity attestation (EAS)</div>
                    <div class="muted-text" style="font-size:0.8rem">
                      {#if hasEnoughForEas}
                        Records your verified identity on Base. ~$0.01 gas.
                      {:else}
                        Requires ~0.00005 ETH on Base for gas. <a href="https://docs.base.org" target="_blank">Fund via Base App</a>
                      {/if}
                    </div>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" bind:checked={wantEasAttestation} disabled={!hasEnoughForEas} />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
            {/if}
          {:else}
            <!-- Existing EOA/WalletConnect flow for non-Base -->
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
          {/if}

          <div class="card section-card info-card" class:disabled={!$walletAddress}>
            <h3 class="section-label">{network === 'base' ? '3' : '2'}. Agent address</h3>
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
            {network === 'celo' && celoProofMethod === 'worldid' ? 'World ID verify & mint' : network === 'celo' ? 'Scan passport & mint' : 'Verify & mint on Base'}
          </h2>

          <div class="card summary-card">
            <div class="summary-row"><span>Network</span> <span class="badge {network === 'celo' ? 'badge-celo' : 'badge-base'}">{network === 'celo' ? 'Celo Mainnet' : 'Base Mainnet'}</span></div>
            <div class="summary-row"><span>Agent name</span> <strong>{agentName}</strong></div>
            <div class="summary-row"><span>Owner wallet</span> <code class="mono">{truncate($walletAddress ?? '')}</code></div>
            <div class="summary-row"><span>Agent address</span> <code class="mono">{truncate(agentAddressInput)}</code></div>
            <div class="summary-row"><span>Endpoints</span> <span>{endpoints.filter(e => e.url.trim()).length}</span></div>
          </div>

          {#if network === 'celo' && celoProofMethod === 'worldid'}
            <!-- World ID verification UI -->
            {#if worldIdStatus === 'idle'}
              <div class="card info-card">
                <h3>Verify with World ID</h3>
                <p>Open the World App and scan to prove you are a unique human.</p>
                <ol class="steps-list">
                  <li>Click "Verify with World ID" below</li>
                  <li>Scan the QR code with the World App (or tap the link on mobile)</li>
                  <li>Approve the verification in the World App</li>
                  <li>Your agent will be minted automatically</li>
                </ol>
              </div>
              <div class="step-nav">
                <button class="btn btn-secondary" on:click={goBack}>Back</button>
                <button class="btn btn-primary btn-lg" on:click={startWorldIdVerification}>
                  Verify with World ID
                </button>
              </div>
            {:else if worldIdStatus === 'pending'}
              <div class="status-block">
                <div class="spinner"></div>
                <p>Waiting for World App verification…</p>
                {#if worldIdBridgeUrl}
                  <p class="muted-text mt">
                    Open in World App:
                    <a href={worldIdBridgeUrl} target="_blank" rel="noopener">Verify in World App</a>
                  </p>
                {/if}
              </div>
            {:else if worldIdStatus === 'verified'}
              <div class="status-block">
                <div class="spinner"></div>
                <p>World ID verified! Minting agent on Celo…</p>
              </div>
            {:else if worldIdStatus === 'error'}
              <div class="card error-card">
                <h3>Verification failed</h3>
                <p>{worldIdError}</p>
                <div class="step-nav" style="border-top:none;padding-top:0;margin-top:1rem">
                  <button class="btn btn-secondary" on:click={goBack}>Back</button>
                  <button class="btn btn-secondary" on:click={() => { worldIdStatus = 'idle'; }}>Try again</button>
                </div>
              </div>
            {/if}
          {:else if mintStatus === 'idle'}
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
              siweVerified = false; siweError = ''; identity = null;
              baseQRUri = ''; wantEasAttestation = false; hasEnoughForEas = false;
              coinbaseProvider = null;
              celoProofMethod = null; worldIdStatus = 'idle'; worldIdError = '';
            }}>Register another agent</a>
          </div>
        </div>
      {/if}
    </div>
  </main>

<style>
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
  .network-card-logos {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .card-wordmark {
    height: 18px;
    width: auto;
    object-fit: contain;
    opacity: 0.9;
  }
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

  /* Base identity flow */
  .identity-card {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    padding: 0.75rem 0;
  }
  .identity-avatar {
    width: 48px; height: 48px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .identity-avatar-fallback {
    background: color-mix(in srgb, var(--brand-offset-blue) 15%, transparent);
    color: var(--brand-offset-blue);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-heading);
    font-weight: 700;
  }
  .identity-name {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }
  .identity-desc {
    font-size: 0.8rem;
    color: var(--muted-foreground);
    margin-bottom: 0.4rem;
  }
  .identity-info { display: flex; flex-direction: column; }
  .qr-container {
    display: flex; flex-direction: column; align-items: center;
    gap: 0.75rem; margin-top: 1rem;
  }
  .qr-canvas { border-radius: 12px; }
  .qr-hint { font-size: 0.8rem; color: var(--muted-foreground); text-align: center; }
  .eas-toggle-row {
    display: flex; justify-content: space-between; align-items: center; gap: 1rem;
  }
  .toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle-slider {
    position: absolute; inset: 0;
    background: var(--border); border-radius: 999px; cursor: pointer;
    transition: 0.2s;
  }
  .toggle input:checked + .toggle-slider { background: var(--brand-offset-blue); }
  .toggle input:disabled + .toggle-slider { opacity: 0.4; cursor: not-allowed; }
  .toggle-slider::before {
    content: ''; position: absolute;
    height: 18px; width: 18px;
    left: 3px; bottom: 3px;
    background: white; border-radius: 50%;
    transition: 0.2s;
  }
  .toggle input:checked + .toggle-slider::before { transform: translateX(20px); }

  /* Proof sub-selector */
  .network-card-selected { outline-color: var(--brand-offset-blue); }
  .proof-sub-selector { margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1.5rem; }
  .proof-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  @media (max-width: 480px) { .proof-options { grid-template-columns: 1fr; } }
  .proof-option-card {
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 1.2);
    padding: 1rem;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    color: var(--card-foreground);
    transition: border-color 150ms, background 150ms;
  }
  .proof-option-card:hover { border-color: var(--brand-offset-blue); background: color-mix(in srgb, var(--brand-offset-blue) 6%, transparent); }
  .proof-option-logo { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .proof-option-body { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.85rem; }
  .proof-option-body strong { font-size: 0.95rem; font-family: var(--font-heading); }
  .proof-option-body span { color: var(--muted-foreground); }
  .proof-req { font-size: 0.75rem; color: var(--muted-foreground); border-top: 1px solid var(--border); padding-top: 0.3rem; margin-top: 0.25rem; }
</style>
