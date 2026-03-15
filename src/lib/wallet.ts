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
