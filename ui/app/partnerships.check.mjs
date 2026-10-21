// Run with `node app/partnerships.check.mjs`: partnership dates cannot lie in the future, and a divorce
// cannot come before the wedding.
import assert from 'node:assert/strict';
import { dateProblem, keptDates, today } from './partnerships.ts';

const on = '2026-10-21';
assert.equal(today(new Date(2026, 0, 5)), '2026-01-05');
assert.equal(dateProblem({ status: 'married', marriedOn: '1985-06-12' }, on), null);
assert.equal(dateProblem({ status: 'married', marriedOn: on }, on), null, 'today is fine');
assert.equal(dateProblem({ status: 'married', marriedOn: '2222-02-22' }, on), 'futureDate');
assert.equal(dateProblem({ status: 'together', since: '2027-01-01' }, on), 'futureDate');
assert.equal(dateProblem({ status: 'divorced', marriedOn: '1985-06-12', endedOn: '2030-11-11' }, on), 'futureDate');
assert.equal(dateProblem({ status: 'divorced', marriedOn: '1999-01-01', endedOn: '1990-01-01' }, on), 'divorceBeforeWedding');
assert.equal(dateProblem({ status: 'divorced', marriedOn: '1990-01-01', endedOn: '1990-01-01' }, on), null);
assert.equal(dateProblem({ status: 'widowed', marriedOn: '1999-01-01', endedOn: '1990-01-01' }, on), 'divorceBeforeWedding');
assert.equal(dateProblem({ status: 'widowed', marriedOn: '1985-06-12', endedOn: '2010-03-01' }, on), null);
// Dates the status does not keep do not count.
assert.equal(dateProblem({ status: 'together', marriedOn: '2222-02-22' }, on), null);
assert.deepEqual(keptDates({ status: 'separated', since: '1980-01-01', marriedOn: '1981-01-01', endedOn: '1990-01-01' }), {
  since: null,
  marriedOn: null,
  endedOn: '1990-01-01',
});

console.log('partnerships checks passed');
