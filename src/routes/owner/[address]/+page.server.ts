import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isAddress } from 'viem';

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
  const { address } = params;

  if (!isAddress(address)) {
    throw error(400, 'Invalid Ethereum address');
  }

  const res = await fetch(`/api/owner/${address}`);
  if (!res.ok) throw error(502, 'Failed to load owner data');

  const data = await res.json();

  setHeaders({ 'Cache-Control': 'public, max-age=300, s-maxage=300' });
  return { address: data.address, agents: data.agents };
};
