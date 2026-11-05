// The legal documents as the UI needs them: parsing their text, and what the acceptance card says. Pure, so
// `legal.check.mjs` can test it without Next.
import type { LegalDocumentNotice } from '../lib/api/generated/members';

export type LegalBlock = { kind: 'heading' | 'paragraph'; text: string } | { kind: 'list'; items: string[] };

// The BFF's text: lines with `## ` are headings, with `- ` bullets, and an empty line ends a paragraph. It comes from
// reviewed migrations, and React escapes what is rendered, so this reads plain text and nothing else.
export function parseLegalBody(body: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  for (const line of body.split('\n').map((text) => text.trim())) {
    if (line === '') continue;
    if (line.startsWith('## ')) blocks.push({ kind: 'heading', text: line.slice(3) });
    else if (line.startsWith('- ')) {
      const last = blocks.at(-1);
      if (last?.kind === 'list') last.items.push(line.slice(2));
      else blocks.push({ kind: 'list', items: [line.slice(2)] });
    } else blocks.push({ kind: 'paragraph', text: line });
  }
  return blocks;
}

export const fillOperator = (body: string, operator: { name: string; email: string }) =>
  body.replaceAll('{{operator.name}}', operator.name).replaceAll('{{operator.email}}', operator.email);

// `?version=` of the legal pages: a positive number, anything else means the version in force.
export function legalVersionOf(value: string | string[] | undefined): number | undefined {
  return typeof value === 'string' && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined;
}

export const legalInForce = (effectiveAt: string) => new Date(effectiveAt).getTime() <= Date.now();

// Which card: `first` while the terms were never accepted, `privacy` when only the notice is open, which needs no tick,
// `changed` otherwise.
export type ConsentCard = {
  state: 'first' | 'changed' | 'privacy';
  terms: LegalDocumentNotice | undefined;
  privacy: LegalDocumentNotice | undefined;
  // The documents with something to say about what changed.
  changes: LegalDocumentNotice[];
};

export function consentCardOf(pending: readonly LegalDocumentNotice[]): ConsentCard | null {
  if (pending.length === 0) return null;
  const terms = pending.find((document) => document.kind === 'terms');
  const privacy = pending.find((document) => document.kind === 'privacy');
  const state = !terms ? 'privacy' : terms.previousVersion === null ? 'first' : 'changed';
  return { state, terms, privacy, changes: pending.filter((document) => document.previousVersion !== null) };
}

export const summaryLines = (summary: string | null) => (summary ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
