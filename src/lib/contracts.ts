export const CONTRACTS = {
  celo: {
    registry: '0xaC3DF9ABf80d0F5c020C06B04Cced27763355944' as `0x${string}`,
    worldIdRegistry: '0x68635657b46d3f3b84e6bc6a67463fB86fff8d1E' as `0x${string}`,
    proofProvider: '0x4b036aFD959B457A208F676cf44Ea3ef73Ea3E3d' as `0x${string}`,
  },
  base: {
    registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`,
  },
} as const;

export const ERC8004_ABI = [
  { name: 'register', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ name: 'agentId', type: 'uint256' }] },
  { name: 'setAgentWallet', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'newWallet', type: 'address' }, { name: 'deadline', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
  { name: 'tokenURI', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }] },
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
] as const;

export const SELF_REGISTRY_ABI = [
  ...ERC8004_ABI,
  { name: 'hasHumanProof', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'isProofFresh', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'proofExpiresAt', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

export const COINBASE_VERIFICATION_SCHEMA = '0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9' as `0x${string}`;
export const EAS_CONTRACT_BASE = '0x4200000000000000000000000000000000000021' as `0x${string}`;
