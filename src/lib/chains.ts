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

export const mainnet = defineChain({
  id: 1,
  name: 'Ethereum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://cloudflare-eth.com'] } },
  blockExplorers: { default: { name: 'Etherscan', url: 'https://etherscan.io' } },
});

export const CHAINS = { celo, base } as const;
export type ChainKey = keyof typeof CHAINS;
