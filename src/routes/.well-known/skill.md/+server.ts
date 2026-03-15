import type { RequestHandler } from './$types';

// Serves SKILL.md for AI agents discovering registration capabilities.
// The static file is at /static/skill.md — served via Cloudflare Pages CDN.
// This route exists to add correct headers and also support /.well-known path.
export const GET: RequestHandler = async ({ fetch }) => {
  const res = await fetch('/skill.md');
  const content = await res.text();

  return new Response(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
