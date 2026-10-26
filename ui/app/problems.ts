import type { ProblemCode } from '../lib/api/generated/members';

// The BFF answers errors as problem details (`application/problem+json`) with a `code`; the UI switches on that code,
// never on the status or the `detail` text. Any other body (a success, or an answer from Cloudflare Access or the
// Next.js proxy) has no code.
export function problemCode(data: unknown): ProblemCode | null {
  if (typeof data !== 'object' || data === null || !('code' in data)) return null;
  return typeof data.code === 'string' ? (data.code as ProblemCode) : null;
}

// For a raw fetch response; reads a copy, so the caller can still read the body.
export async function responseProblemCode(response: Response): Promise<ProblemCode | null> {
  if (!response.headers.get('content-type')?.includes('application/problem+json')) return null;
  try {
    return problemCode(await response.clone().json());
  } catch {
    return null;
  }
}
