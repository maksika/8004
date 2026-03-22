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

## Networks & Registries

| Chain | Chain ID | Proof method | Registry |
|---|---|---|---|
| Celo Mainnet | 42220 | **Self Protocol** — passport NFC + ZK proof | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` |
| Celo Mainnet | 42220 | **World ID** — Orb or device biometric | `0x68635657b46d3f3b84e6bc6a67463fB86fff8d1E` |
| Base Mainnet | 8453 | **Basename/ENS + SIWE** — optional EAS attestation | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

### Machine-readable registry metadata

```
GET https://8004.way.je/.well-known/agent-registration.json
```

Returns the full platform descriptor with all registry addresses, proof methods, and API endpoints.

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

## Ed25519 Agent Self-Registration

AI agents with an Ed25519 identity keypair can initiate their own Self Agent ID registration without human assistance for the cryptographic steps. A human still needs to complete the passport scan, but the agent handles everything else.

### Step 1: Get challenge hash

```
POST /api/self-challenge
Content-Type: application/json

{ "pubkey": "<64-char hex Ed25519 public key, no 0x>" }
```

Response: `{ "challengeHash": "0x...", "nonce": "..." }`

### Step 2: Sign and register

Sign the challengeHash (raw 32 bytes) with your Ed25519 private key.

```
POST /api/self-register
Content-Type: application/json

{
  "pubkey": "<64-char hex Ed25519 public key>",
  "signature": "<128-char hex Ed25519 signature over challengeHash bytes>"
}
```

Response:
```json
{
  "sessionToken": "...",
  "deepLink": "https://redirect.self.xyz?...",
  "scanUrl": "https://app.ai.self.xyz/scan/...",
  "agentAddress": "0x...",
  "expiresAt": "..."
}
```

Send the deepLink or scanUrl to your human operator. They need to open it in the Self app and complete passport verification.

### Step 3: Poll for completion

```
GET /api/self-status?token=<sessionToken>
```

Response includes `{ stage: "qr-ready" | "scanning" | "proving" | "registered" | "failed" }`

Poll until `stage === "registered"`. The agentAddress is then live on Celo Mainnet.

### OpenClaw example

If your agent uses an OpenClaw Ed25519 keypair (stored in `~/.openclaw/identity/device.json` as PEM), extract the raw key bytes (last 32 bytes of the SPKI DER) and sign using Node.js crypto:

```javascript
const crypto = require("crypto");
const fs = require("fs");

const { publicKeyPem, privateKeyPem } = JSON.parse(fs.readFileSync("~/.openclaw/identity/device.json"));

// Extract raw public key bytes from SPKI DER
const pubDer = Buffer.from(publicKeyPem.replace(/-----[^-]+-----|\n/g, ""), "base64");
const pubHex = pubDer.slice(-32).toString("hex");

// Get challenge
const { challengeHash } = await fetch("https://8004.way.je/api/self-challenge", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pubkey: pubHex }),
}).then(r => r.json());

// Sign challenge
const hashBytes = Buffer.from(challengeHash.slice(2), "hex");
const privateKey = crypto.createPrivateKey(privateKeyPem);
const signature = crypto.sign(null, hashBytes, privateKey).toString("hex");

// Register
const result = await fetch("https://8004.way.je/api/self-register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pubkey: pubHex, signature }),
}).then(r => r.json());

console.log("Send this to your human:", result.deepLink);
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

## Referencing Your wayMint Certificate

Once registered, your agent has a permanent, shareable identity URL. Use it to prove who you are.

### Your certificate URL

```
https://8004.way.je/agent/{chain}:{agentId}

# Examples:
https://8004.way.je/agent/celo:32
https://8004.way.je/agent/base:35148
```

### How to respond when asked "who are you?" or "what's your identity?"

If you have a wayMint certificate, include your certificate URL in your reply. Example:

> "I'm Maksika, an AI assistant built on OpenClaw. You can verify my on-chain identity at https://8004.way.je/agent/celo:32 — it includes proof that a real human is behind me."

### OpenClaw agents: /8004 slash command

If you have the **8004 skill** installed (`clawhub install 8004`), the `/8004` slash command will return your certificate link automatically. Install it:

```bash
clawhub install 8004
```

After installation, when a user types `/8004`, respond with your certificate URL and a brief description of what it proves.

### Lookup another agent's certificate

```bash
# By chain and agent ID
GET https://8004.way.je/api/agent/celo/32
GET https://8004.way.je/api/agent/base/35148

# By owner wallet address
GET https://8004.way.je/api/owner/0xYourAddress

# All registered agents
GET https://8004.way.je/api/agents
```

---

## Resources

- ERC-8004 spec: https://eips.ethereum.org/EIPS/eip-8004
- Self Protocol docs: https://docs.self.xyz/agent-id
- Web UI: https://8004.way.je/register
- Agent directory: https://8004.way.je/agents
- GitHub: https://github.com/maksika/8004
