// Canonical redirect — /skill.md → /.well-known/skill.md
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return new Response(null, {
    status: 301,
    headers: {
      Location: '/.well-known/skill.md',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
