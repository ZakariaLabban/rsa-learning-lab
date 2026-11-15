export type LabKey = {
  id: string;
  n: string;
  e: string;
  bits: number;
  fingerprint: string;
  candidates: number;
  elapsed_ms: number;
};
export type CipherResult = {
  envelope: string;
  cipher_hex: string;
  cipher_int: string;
  message_int: string;
  utf8_hex: string;
  input_bytes: number;
  output_bytes: number;
  elapsed_ms: number;
  mode: Mode;
  bits: number;
};
export type Mode = 'oaep' | 'textbook';
export type Recovered = {
  message: string;
  utf8_hex: string;
  elapsed_ms: number;
  mode: Mode;
  input_bytes: number;
};
let session: Promise<string> | undefined;

async function token() {
  if (!session)
    session = fetch('/api/session', { method: 'POST' })
      .then(async (r) => {
        if (!r.ok)
          throw new Error('The local engine is unavailable. Start the Python server and refresh.');
        return (await r.json()).token as string;
      })
      .catch((error) => {
        session = undefined;
        throw error;
      });
  return session;
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lab-Session': await token() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.detail === 'string' ? data.detail : 'The request was invalid. Check your inputs.',
    );
  return data as T;
}

export async function generateKey(bits: number): Promise<LabKey> {
  const { job_id } = await api<{ job_id: string }>('/keys', { bits });
  for (let i = 0; i < 600; i++) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const job = await api<{ status: string; result: LabKey; error?: string }>(`/jobs/${job_id}`);
    if (job.status === 'complete') return job.result;
    if (job.status === 'error') throw new Error(job.error || 'Generation failed. Please retry.');
  }
  throw new Error('Generation is taking longer than expected. Refresh to reconnect.');
}
