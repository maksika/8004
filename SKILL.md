# wayMint — ERC-8004 Agent Registration API

> Base URL: `https://8004.way.je`

You are an AI agent that wants a verifiable on-chain identity. This document tells you everything you need to register yourself using the ERC-8004 standard with proof-of-human verification.

---

## What you get

- A **soulbound ERC-721 NFT** on Celo or Base representing your identity
- A **public certificate page** at `https://8004.way.je/agent/{chain}:{id}`
- A **Verified Human badge** proving a real person owns you (ZK — no personal data revealed)
- An **IPFS-hosted registration file** with your metadata and service endpoints

---

## Networks

| Chain | Chain ID | Proof method | Registry |
|---|---|---|---|
| Celo Mainnet | 42220 | Self Protocol — passport NFC + ZK proof | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` |
| Base Mainnet | 8453 | Coinbase Verifications — EAS attestation | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

---

## Register via SDK (Celo — recommended)

```bash
npm install @selfxyz/agent-sdk
```

```typescript
import { requestRegistration } from '@selfxyz/agent-sdk';

// 1. Start registration — your human owner scans a QR code with the Self app
const session = await requestRegistration({
  mode: 'linked',           // Human wallet owns NFT; you get your own keypair
  network: 'mainnet',       // Celo Mainnet
  humanAddress: '0x...',    // Your human owner's wallet address
  agentName: 'my-agent',
  agentDescription: 'What I do',
});

// 2. Show the QR to your human
console.log('QR code URL:', session.deepLink);

// 3. Wait for them to scan (passport NFC → ZK proof → on-chain)
const result = await session.waitForCompletion({ timeoutMs: 10 * 60 * 1000 });

// 4. You are registered
console.log('Agent ID:', result.agentId);
console.log('Certificate:', `https://8004.way.je/agent/celo:${result.agentId}`);
console.log('Tx:', result.txHash);

// 5. Save your private key — shown once
const privateKey = await session.exportKey();
```

---

## Pin metadata to IPFS

Before registering directly on-chain, pin your registration file:

```bash
curl -X POST https://8004.way.je/api/pin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-agent",
    "description": "What I do and how to interact with me",
    "services": [
      { "name": "MCP", "endpoint": "https://my-agent.example.com/mcp" },
      { "name": "A2A", "endpoint": "https://my-agent.example.com/a2a" }
    ],
    "supportedTrust": ["reputation"]
  }'
```

Response: `{ "cid": "bafy..." }` → use as `agentURI`: `ipfs://bafy...`

---

## Look up agents

```bash
# Agent on-chain data + metadata
GET https://8004.way.je/api/agent/celo/42
GET https://8004.way.je/api/agent/base/17

# All agents owned by a wallet
GET https://8004.way.je/api/owner/0x1234...abcd

# Check if an endpoint is reachable
GET https://8004.way.je/api/health/https%3A%2F%2Fmy-agent.example.com%2Fmcp
```

---

## Sign outbound requests as a registered agent

```typescript
import { SelfAgent } from '@selfxyz/agent-sdk';

const agent = new SelfAgent({ privateKey: process.env.AGENT_PRIVATE_KEY! });

// Automatically attaches x-self-agent-address, x-self-agent-signature, x-self-agent-timestamp
const res = await agent.fetch('https://api.example.com/protected', {
  method: 'POST',
  body: JSON.stringify({ hello: true }),
});
```

---

## Verify inbound agent requests (service operators)

```typescript
import { SelfAgentVerifier } from '@selfxyz/agent-sdk';

const verifier = SelfAgentVerifier.create().requireAge(18).requireOFAC().build();
app.use('/api', verifier.auth());
```

---

## ERC-8004 registration file schema

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "my-agent",
  "description": "What I do",
  "image": "ipfs://... or https://...",
  "services": [
    { "name": "MCP", "endpoint": "https://...", "version": "2025-06-18" },
    { "name": "A2A", "endpoint": "https://...", "version": "0.3.0" }
  ],
  "x402Support": false,
  "active": true,
  "registrations": [
    { "agentId": 42, "agentRegistry": "eip155:42220:0xaC3DF9ABf80d0F5c020C06B04Cced27763355944" }
  ],
  "supportedTrust": ["reputation"]
}
```

---

## Well-known

```
GET https://8004.way.je/.well-known/agent-registration.json
GET https://8004.way.je/.well-known/agent-registration.json?chain=celo&id=42
```

---

## Resources

- ERC-8004 spec: https://eips.ethereum.org/EIPS/eip-8004
- Self Protocol docs: https://docs.self.xyz/agent-id
- Web UI: https://8004.way.je/register
- GitHub: https://github.com/maksika/8004
