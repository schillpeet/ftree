// Checks of the pure logic in `legal.ts`; run with `node app/legal.check.mjs`.
import assert from 'node:assert/strict';
import { consentCardOf, fillOperator, legalVersionOf, parseLegalBody, summaryLines } from './legal.ts';

const notice = (kind, version, previousVersion) => ({ kind, version, previousVersion, effectiveAt: '2027-02-01T00:00:00Z', changeSummaryDe: null, changeSummaryEn: null });

assert.deepEqual(parseLegalBody('## A\n\nEins\nZwei\n\n- x\n- y\n\nDrei\n\n- z'), [
  { kind: 'heading', text: 'A' },
  { kind: 'paragraph', text: 'Eins' },
  { kind: 'paragraph', text: 'Zwei' },
  { kind: 'list', items: ['x', 'y'] },
  { kind: 'paragraph', text: 'Drei' },
  { kind: 'list', items: ['z'] },
]);

assert.equal(fillOperator('{{operator.name}} ({{operator.email}}), {{operator.email}}', { name: 'N', email: 'E' }), 'N (E), E');

assert.equal(legalVersionOf('3'), 3);
for (const bad of [undefined, '', '0', '-1', '1.5', 'abc', '1&x=2', ['1', '2'], '99999999999']) assert.equal(legalVersionOf(bad), undefined);

assert.equal(consentCardOf([]), null);
const first = consentCardOf([notice('terms', 1, null), notice('privacy', 1, null)]);
assert.equal(first.state, 'first');
assert.deepEqual(first.changes, []);
const changed = consentCardOf([notice('terms', 2, 1)]);
assert.equal(changed.state, 'changed');
assert.equal(changed.privacy, undefined);
assert.equal(consentCardOf([notice('privacy', 2, 1)]).state, 'privacy');
assert.equal(consentCardOf([notice('terms', 2, 1), notice('privacy', 2, 1)]).changes.length, 2);
// Never accepted terms, whatever happened to the notice, is a first acceptance.
assert.equal(consentCardOf([notice('terms', 1, null), notice('privacy', 2, 1)]).state, 'first');

assert.deepEqual(summaryLines(' a \n\nb\n'), ['a', 'b']);
assert.deepEqual(summaryLines(null), []);
