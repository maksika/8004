import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const endpoint = decodeURIComponent(params.endpoint ?? '');

  if (!endpoint || !endpoint.startsWith('http')) {
    return json({ status: 'unknown', error: 'Invalid endpoint' });
  }

  try {
    const url = new URL(endpoint);
    // Block internal addresses
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname)) {
      return json({ status: 'unknown', error: 'Internal addresses not allowed' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(endpoint, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'wayMint/1.0 (health-check)' },
    });
    clearTimeout(timeout);

    return json({ status: res.ok || res.status < 500 ? 'reachable' : 'unreachable', statusCode: res.status });
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return json({ status: 'unreachable', error: 'Timeout' });
    }
    return json({ status: 'unknown', error: 'Probe failed' });
  }
};
