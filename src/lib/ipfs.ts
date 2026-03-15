// Client-side helper to pin agent registration JSON via the server-side proxy
export interface AgentRegistrationFile {
  type: string;
  name: string;
  description: string;
  image?: string;
  services: Array<{
    name: string;
    endpoint: string;
    version?: string;
  }>;
  x402Support: boolean;
  active: boolean;
  supportedTrust: string[];
}

export async function pinToIPFS(data: AgentRegistrationFile): Promise<string> {
  const res = await fetch('/api/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Pin failed: ${res.status}`);
  }
  const { cid } = await res.json();
  return `ipfs://${cid}`;
}
