import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params }) => {
  return json({ error: 'Not implemented', endpoint: params.endpoint }, { status: 501 });
};
