import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ERC8004_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';

interface Service {
  name: string;
  endpoint: string;
  version?: string;
}

interface RegistrationPayload {
  type?: string;
  name: string;
  description: string;
  image?: string;
  services: Service[];
  x402Support?: boolean;
  active?: boolean;
  supportedTrust?: string[];
}

export const POST: RequestHandler = async ({ request, platform }) => {
  let body: RegistrationPayload;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  if (!body.name || typeof body.name !== 'string' || body.name.length < 1) {
    throw error(400, 'Missing or invalid name');
  }
  if (!body.services || !Array.isArray(body.services) || body.services.length === 0) {
    throw error(400, 'At least one service endpoint is required');
  }

  const registrationFile = {
    type: ERC8004_TYPE,
    name: body.name,
    description: body.description ?? '',
    ...(body.image ? { image: body.image } : {}),
    services: body.services.map((s: Service) => ({
      name: s.name,
      endpoint: s.endpoint,
      ...(s.version ? { version: s.version } : {}),
    })),
    x402Support: body.x402Support ?? false,
    active: body.active ?? true,
    supportedTrust: body.supportedTrust ?? ['reputation'],
  };

  const pinatJWT = platform?.env?.PINATA_JWT ?? process.env.PINATA_JWT;
  if (!pinatJWT) {
    console.warn('[api/pin] No PINATA_JWT found — returning mock CID for dev');
    const mockCid = 'bafybeig' + Math.random().toString(36).slice(2, 18).padEnd(16, '0');
    return json({ cid: mockCid, mock: true });
  }

  const pinRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pinatJWT}`,
    },
    body: JSON.stringify({
      pinataContent: registrationFile,
      pinataMetadata: { name: `waymint-agent-${body.name}` },
    }),
  });

  if (!pinRes.ok) {
    const errText = await pinRes.text().catch(() => 'Unknown error');
    console.error('[api/pin] Pinata error:', pinRes.status, errText);
    throw error(502, 'Failed to pin to IPFS');
  }

  const { IpfsHash } = await pinRes.json();
  return json({ cid: IpfsHash });
};
