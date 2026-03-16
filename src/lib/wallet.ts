import { writable, derived } from 'svelte/store';
import { createPublicClient, http } from 'viem';
import { celo, base } from './chains';

// Public WalletConnect / Reown project ID — safe to expose in client code
const WC_PROJECT_ID = '97183c5cdb01ba7f9b8ffeeb321cd296';

export const walletAddress = writable<`0x${string}` | null>(null);
export const chainId = writable<number | null>(null);
export const isConnecting = writable(false);
export const walletError = writable<string | null>(null);
export const isConnected = derived(walletAddress, ($addr) => $addr !== null);

// Track which provider we're using so disconnect can clean up properly
let activeProvider: any = null;

export function getPublicClient(chain: 'celo' | 'base') {
  return createPublicClient({
    chain: chain === 'celo' ? celo : base,
    transport: http(),
  });
}

function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

export async function connectWallet(): Promise<`0x${string}` | null> {
  if (typeof window === 'undefined') return null;

  isConnecting.set(true);
  walletError.set(null);

  try {
    if (hasInjectedWallet()) {
      // Desktop: use injected wallet (MetaMask, Rabby, Coinbase Wallet, etc.)
      return await connectInjected();
    } else {
      // Mobile / no extension: use WalletConnect
      return await connectWalletConnect();
    }
  } catch (e: any) {
    walletError.set(e.message ?? 'Failed to connect wallet');
    return null;
  } finally {
    isConnecting.set(false);
  }
}

async function connectInjected(): Promise<`0x${string}`> {
  const accounts = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as `0x${string}`[];

  const address = accounts[0];
  const cId = await window.ethereum.request({ method: 'eth_chainId' });

  walletAddress.set(address);
  chainId.set(parseInt(cId as string, 16));
  activeProvider = window.ethereum;

  window.ethereum.on('accountsChanged', (accs: `0x${string}`[]) => {
    walletAddress.set(accs[0] ?? null);
  });
  window.ethereum.on('chainChanged', (cid: string) => {
    chainId.set(parseInt(cid, 16));
  });

  return address;
}

async function connectWalletConnect(): Promise<`0x${string}`> {
  // Dynamic import — large bundle, only load when needed
  const { default: EthereumProvider } = await import(
    '@walletconnect/ethereum-provider'
  );

  const provider = await EthereumProvider.init({
    projectId: WC_PROJECT_ID,
    chains: [1], // ETH mainnet required by WC; we switch after connect
    optionalChains: [42220, 8453], // Celo, Base
    showQrModal: true, // renders built-in QR modal
    metadata: {
      name: 'wayMint',
      description: 'Verifiable identity for AI agents',
      url: 'https://8004.way.je',
      icons: ['https://8004.way.je/favicon.svg'],
    },
  });

  await provider.connect();
  activeProvider = provider;

  const accounts = provider.accounts as `0x${string}`[];
  const address = accounts[0];
  const cId = provider.chainId;

  walletAddress.set(address);
  chainId.set(cId);

  provider.on('accountsChanged', (accs: string[]) => {
    walletAddress.set((accs[0] as `0x${string}`) ?? null);
  });
  provider.on('chainChanged', (cid: number) => {
    chainId.set(cid);
  });
  provider.on('disconnect', () => {
    walletAddress.set(null);
    chainId.set(null);
  });

  return address;
}

export function disconnectWallet() {
  walletAddress.set(null);
  chainId.set(null);

  if (!activeProvider) return;

  try {
    // Remove listeners
    activeProvider.removeAllListeners?.('accountsChanged');
    activeProvider.removeAllListeners?.('chainChanged');
    activeProvider.removeAllListeners?.('disconnect');

    // WalletConnect: close the session
    if (typeof activeProvider.disconnect === 'function') {
      activeProvider.disconnect().catch(() => {});
    }
  } catch {}

  activeProvider = null;
}

export async function switchChain(targetChainId: number) {
  const provider = activeProvider ?? window.ethereum;
  if (!provider) return;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + targetChainId.toString(16) }],
    });
  } catch (e: any) {
    if (e.code === 4902 && targetChainId === 42220) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xa4ec',
          chainName: 'Celo Mainnet',
          nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
          rpcUrls: ['https://forno.celo.org'],
          blockExplorerUrls: ['https://celoscan.io'],
        }],
      });
    }
  }
}

declare global {
  interface Window { ethereum?: any; }
}
