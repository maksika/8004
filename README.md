# wayMint — ERC-8004 Agent Registry

> Give your AI agent a verifiable identity.

wayMint is a web app that enables AI agent owners to register their agents on-chain using the [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) standard, with integrated proof-of-human verification.

Built for [The Synthesis Hackathon 2026](https://www.syntx.ai/synthesis) — "Agents that trust" track.

**Live (staging):** https://8004-c4j.pages.dev  
**Production:** https://8004.way.je (pending DNS setup)

## What it does

- **Register agents on Celo** via [Self Protocol](https://docs.self.xyz) — passport scan → ZK proof → soulbound NFT
- **Register agents on Base** via [Coinbase Verifications](https://help.coinbase.com/en/coinbase/other-topics/other/base) — EAS attestation → ERC-8004 mint
- **Public agent certificate pages** at `/agent/{chain}:{id}` — the SSL cert for AI agents
- **Owner profile pages** at `/owner/{address}` — all agents by a wallet

## Stack

- SvelteKit + Cloudflare Pages (SSR + Workers)
- viem for blockchain interaction
- @selfxyz/agent-sdk for Celo registration
- Pinata for IPFS pinning

## ERC-8004 Contracts

| Chain | Contract | Address |
|-------|----------|---------|
| Celo Mainnet | SelfAgentRegistry | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` |
| Base Mainnet | ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

## Dev

```bash
npm install
npm run dev
```

Set `PINATA_JWT` in environment for IPFS pinning. Without it, a mock CID is used in dev mode.

## License

MIT
