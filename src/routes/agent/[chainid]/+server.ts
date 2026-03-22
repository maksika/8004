// Redirect /agent/base:35148 → /agent/base/35148
// Supports ERC-8004 CAIP-10 style URLs (chain:id notation)
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
  const { chainid } = params;
  const colonIdx = chainid.lastIndexOf(':');
  if (colonIdx === -1) {
    throw redirect(301, '/agents');
  }
  const chain = chainid.slice(0, colonIdx);
  const id = chainid.slice(colonIdx + 1);
  throw redirect(301, `/agent/${chain}/${id}`);
};
