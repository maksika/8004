import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async () => {
  return json({ error: 'Not implemented' }, { status: 501 });
};
