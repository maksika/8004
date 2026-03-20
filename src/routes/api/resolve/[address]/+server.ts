import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAddress } from 'viem';
import { resolveIdentity } from '$lib/server/resolve-identity';

export const GET: RequestHandler = async ({ params, setHeaders }) => {
  let address: string;

  try {
    address = getAddress(params.address);
  } catch {
    throw error(400, 'Invalid Ethereum address');
  }

  const result = await resolveIdentity(address);

  setHeaders({ 'Cache-Control': 'public, max-age=60, s-maxage=300' });
  return json(result);
};
