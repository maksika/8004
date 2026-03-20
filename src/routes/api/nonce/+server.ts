import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createNonce } from '$lib/server/nonce-store';

export const GET: RequestHandler = async () => {
  const nonce = createNonce();
  return json({ nonce });
};
