import type { LegalDocument, LegalKind } from '../lib/api/generated/members';

// Only for server components: `/terms` and `/privacy` read their text from the BFF, inside the cluster and without a user.
// Every copy is kept for a short while and, when the BFF cannot answer, for as long as needed, so a restart of the BFF
// does not take the legal pages down. A version never changes, so an older copy is only a problem for the version in force.
const FRESH_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 3000;
const copies = new Map<string, { document: LegalDocument; at: number }>();

// null when there is no such version; undefined when the BFF cannot answer and no copy exists yet.
export async function legalDocument(kind: LegalKind, version: number | undefined): Promise<LegalDocument | null | undefined> {
  const key = `${kind}:${version ?? 'current'}`;
  const copy = copies.get(key);
  if (copy && Date.now() - copy.at < FRESH_MS) return copy.document;
  try {
    const query = version === undefined ? '' : `?version=${version}`;
    const response = await fetch(`${process.env.BFF_URL}/legal/${kind}${query}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404 || response.status === 400) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const document = (await response.json()) as LegalDocument;
    copies.set(key, { document, at: Date.now() });
    return document;
  } catch {
    return copy?.document;
  }
}
