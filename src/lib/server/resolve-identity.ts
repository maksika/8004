import { createPublicClient, http, getAddress, parseAbi } from 'viem';
import { base, mainnet } from '$lib/chains';

const l1Client = createPublicClient({ chain: mainnet, transport: http() });
const baseClient = createPublicClient({ chain: base, transport: http() });

/** In-memory cache: address → { data, expiresAt } */
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as `0x${string}`;
const COINBASE_SCHEMA_UID = '0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9' as `0x${string}`;

const easAbi = parseAbi([
  'function getSchemaAttestations(bytes32 schema, address recipient) external view returns (bytes32[] memory)',
]);

const TEXT_RECORDS = [
  'avatar',
  'description',
  'com.twitter',
  'com.github',
  'xyz.farcaster',
  'url',
  'org.telegram',
];

/** Resolve address to Basename/ENS identity with profile and Coinbase verification */
export async function resolveIdentity(rawAddress: string) {
  const address = getAddress(rawAddress);

  // Check cache
  const cached = cache.get(address);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  // Reverse resolve via L1 (handles CCIP Read / Basenames automatically in viem 2.x)
  let name: string | null = null;
  let nameProvider: 'basename' | 'ens' | null = null;

  try {
    name = await l1Client.getEnsName({ address: address as `0x${string}` });
    if (name) {
      nameProvider = name.endsWith('.base.eth') ? 'basename' : 'ens';
    }
  } catch {}

  // Forward verify (anti-spoofing)
  let nameVerified = false;
  if (name) {
    try {
      const resolved = await l1Client.getEnsAddress({ name });
      if (resolved && getAddress(resolved) === address) {
        nameVerified = true;
      } else {
        name = null;
        nameProvider = null;
      }
    } catch {
      name = null;
      nameProvider = null;
    }
  }

  // Fetch text records
  const profile: Record<string, string> = {};
  if (name && nameVerified) {
    const results = await Promise.allSettled(
      TEXT_RECORDS.map(async (key) => {
        const val = await l1Client.getEnsText({ name: name as string, key });
        return { key, val };
      }),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.val) {
        profile[r.value.key] = r.value.val;
      }
    }
  }

  // Check Coinbase Verification EAS attestation on Base
  let coinbaseVerification = { found: false, count: 0 };
  try {
    const attUids = await baseClient.readContract({
      address: EAS_ADDRESS,
      abi: easAbi,
      functionName: 'getSchemaAttestations',
      args: [COINBASE_SCHEMA_UID, address as `0x${string}`],
    });
    const uids = attUids as any[];
    if (uids.length > 0) {
      coinbaseVerification = { found: true, count: uids.length };
    }
  } catch {}

  const result = { address, name, nameProvider, nameVerified, profile, coinbaseVerification };
  cache.set(address, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
