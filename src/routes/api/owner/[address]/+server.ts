import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params }) => {
  return json({ error: 'Not implemented', address: params.address }, { status: 501 });
};
