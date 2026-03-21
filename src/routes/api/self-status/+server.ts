import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const token = url.searchParams.get('token');

  if (!token) {
    throw error(400, 'Missing required query parameter: token');
  }

  const res = await fetch(
    `https://app.ai.self.xyz/api/agent/register/status?token=${encodeURIComponent(token)}`,
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ message: 'Self API error' }));
    return json({ error: errData.message ?? 'Status check failed' }, { status: res.status });
  }

  const data = await res.json();
  return json(data);
};
