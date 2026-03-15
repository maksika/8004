// Generate a fresh ECDSA keypair in the browser using viem.
// The private key is shown once and never stored by the dApp.

export interface AgentKeypair {
  address: `0x${string}`;
  privateKeyHex: string; // 0x-prefixed hex, 64 chars
  publicKeyHex: string;
}

export async function generateAgentKeypair(): Promise<AgentKeypair> {
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
