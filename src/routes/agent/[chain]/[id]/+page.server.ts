import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
  const { chain, id } = params;

  if (chain !== 'celo' && chain !== 'base') {
    throw error(404, 'Unknown chain');
  }

  const res = await fetch(`/api/agent/${chain}/${id}`);
  if (res.status === 404) throw error(404, `Agent #${id} not found on ${chain}`);
  if (!res.ok) throw error(502, 'Failed to load agent data');

  const agent = await res.json();

  setHeaders({ 'Cache-Control': 'public, max-age=300, s-maxage=300' });
  return { agent, chain, id };
};
