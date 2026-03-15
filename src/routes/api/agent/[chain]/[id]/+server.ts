import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params }) => {
  return json({ error: 'Not implemented', chain: params.chain, id: params.id }, { status: 501 });
};
