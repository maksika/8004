---
name: waymint-register
description: Register an AI agent on-chain with ERC-8004 and proof-of-human verification using wayMint. Use this skill when an agent needs a verifiable on-chain identity, wants to register on Celo (via Self passport ZK proof) or Base (via Coinbase Verifications), or needs to produce a public agent certificate page.
homepage: https://8004.way.je
api: https://8004.way.je/api
spec: https://eips.ethereum.org/EIPS/eip-8004
---

# waymint-register

Register your AI agent on-chain at **8004.way.je** using the ERC-8004 standard, bound to a verified human owner.

## What this produces

- A **soulbound ERC-721 NFT** on Celo or Base representing your agent's identity
- A **public certificate page** at `8004.way.je/agent/{chain}:{agentId}`
- An **IPFS-hosted registration file** with your agent's metadata and endpoints
- A **Verified Human badge** proving a real person owns this agent (ZK — no personal data revealed)

---

## Networks

| Chain | Proof method | Contract |
|---|---|---|
| Celo Mainnet (42220) | Self Protocol — passport NFC + ZK proof | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` |
| Base Mainnet (8453) | Coinbase Verifications — EAS attestation | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

---

## Agent-guided registration flow (programmatic)

Use `@selfxyz/agent-sdk` to register without the browser UI.

### 1. Install

```bash
npm install @selfxyz/agent-sdk
```

### 2. Initiate registration session

```typescript
import { requestRegistration } from '@selfxyz/agent-sdk';

const session = await requestRegistration({
  mode: 'linked',         // Human wallet owns NFT; agent has its own keypair
  network: 'mainnet',     // 'mainnet' (Celo) or 'testnet' (Celo Sepolia)
  humanAddress: '0x...',  // The human owner's wallet address
  agentName: 'my-agent',
  agentDescription: 'What this agent does',
  disclosures: {
    minimumAge: 18,        // Optional: require owner to be 18+
    ofac: true,            // Optional: OFAC screening
  },
});

// session.deepLink → QR code URL — show to the human to scan with Self app
// session.agentAddress → the agent's generated Ethereum address
console.log('QR:', session.deepLink);
console.log('Agent address:', session.agentAddress);
```

### 3. Wait for human to scan passport

The human scans the QR code with the Self app (iOS/Android). The app scans their passport NFC chip, generates a ZK proof locally, and submits it on-chain.

### 4. Poll for completion

```typescript
const result = await session.waitForCompletion({
  timeoutMs: 10 * 60 * 1000, // 10 minutes
});

console.log('Agent ID:', result.agentId);     // On-chain token ID
console.log('Tx hash:', result.txHash);
console.log('Certificate:', `https://8004.way.je/agent/celo:${result.agentId}`);
```

### 5. Export and store the agent private key

```typescript
const privateKey = await session.exportKey();
// Store securely — this is the agent's operational signing key
```

---

## Pin agent metadata to IPFS (optional, for custom registration files)

Before calling a registry directly, pin your ERC-8004 registration file:

```bash
curl -X POST https://8004.way.je/api/pin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-agent",
    "description": "What this agent does and how to interact with it",
    "services": [
      { "name": "MCP", "endpoint": "https://my-agent.example.com/mcp" },
      { "name": "A2A", "endpoint": "https://my-agent.example.com/a2a" }
    ],
    "supportedTrust": ["reputation"]
  }'
# Returns: { "cid": "bafy..." }
# Use as agentURI: "ipfs://bafy..."
```

---

## Look up an agent

```bash
# Get agent on-chain data + metadata
curl https://8004.way.je/api/agent/celo/42
curl https://8004.way.je/api/agent/base/17

# Get all agents owned by a wallet
curl https://8004.way.je/api/owner/0x1234...abcd

# Check endpoint reachability
curl "https://8004.way.je/api/health/https%3A%2F%2Fmy-agent.example.com%2Fmcp"
```

---

## Check proof freshness (Celo agents)

Agent proofs expire (default: 1 year or passport expiry, whichever is sooner). Check status:

```typescript
import { SelfAgent } from '@selfxyz/agent-sdk';

const agent = new SelfAgent({
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  network: 'mainnet',
});

const info = await agent.getInfo();
console.log('Is registered:', info.isVerified);
console.log('Proof expires:', new Date(info.proofExpiresAt * 1000));
```

When `isProofFresh()` returns false on-chain, deregister and re-register with a fresh passport scan.

---

## Sign outbound requests as a registered agent

Once registered, use the SDK to sign API requests with your agent identity:

```typescript
import { SelfAgent } from '@selfxyz/agent-sdk';

const agent = new SelfAgent({
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  network: 'mainnet',
});

// Signs with x-self-agent-address, x-self-agent-signature, x-self-agent-timestamp
const res = await agent.fetch('https://api.example.com/protected', {
  method: 'POST',
  body: JSON.stringify({ action: 'hello' }),
});
```

---

## ERC-8004 registration file schema

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "{agent-name}",
  "description": "{what this agent does}",
  "image": "{optional ipfs:// or https:// avatar URL}",
  "services": [
    { "name": "MCP", "endpoint": "https://...", "version": "2025-06-18" },
    { "name": "A2A", "endpoint": "https://...", "version": "0.3.0" },
    { "name": "web", "endpoint": "https://..." }
  ],
  "x402Support": false,
  "active": true,
  "registrations": [
    {
      "agentId": 42,
      "agentRegistry": "eip155:42220:0xaC3DF9ABf80d0F5c020C06B04Cced27763355944"
    }
  ],
  "supportedTrust": ["reputation"]
}
```

---

## Verify an agent (service operators)

To verify inbound requests from a registered agent:

```typescript
import { SelfAgentVerifier } from '@selfxyz/agent-sdk';

const verifier = SelfAgentVerifier.create()
  .requireAge(18)
  .requireOFAC()
  .maxAgentsPerHuman(1)
  .build();

// Express/Hono/etc middleware
app.use('/api', verifier.auth());
```

---

## Well-known endpoint

The platform's identity is discoverable at:

```
GET https://8004.way.je/.well-known/agent-registration.json
```

A specific agent's registration file:

```
GET https://8004.way.je/.well-known/agent-registration.json?chain=celo&id=42
```

---

## Resources

- **ERC-8004 spec:** https://eips.ethereum.org/EIPS/eip-8004
- **Self Protocol docs:** https://docs.self.xyz/agent-id
- **Coinbase Verifications:** https://help.coinbase.com/en/coinbase/other-topics/other/base
- **8004agents.ai** (reference implementation): https://8004agents.ai
- **Web UI:** https://8004.way.je/register
- **GitHub:** https://github.com/maksika/8004
