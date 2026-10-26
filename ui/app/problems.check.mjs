// Run with `node app/problems.check.mjs`: the code of a problem-details answer, and none for any other body.
import assert from 'node:assert/strict';
import { problemCode, responseProblemCode } from './problems.ts';

const problem = { type: 'urn:ftree:problem:name-taken', title: 'Conflict', status: 409, code: 'NAME_TAKEN' };
assert.equal(problemCode(problem), 'NAME_TAKEN');
assert.equal(problemCode({ id: 'x', name: 'Family' }), null);
assert.equal(problemCode({ code: 409 }), null);
assert.equal(problemCode({}), null);
assert.equal(problemCode(null), null);
assert.equal(problemCode('NAME_TAKEN'), null);

const answer = (body, type) => new Response(body, { status: 403, headers: type ? { 'content-type': type } : {} });
const forbidden = answer(JSON.stringify({ ...problem, status: 403, code: 'FORBIDDEN' }), 'application/problem+json');
assert.equal(await responseProblemCode(forbidden), 'FORBIDDEN');
// The body stays readable for the caller.
assert.equal((await forbidden.json()).code, 'FORBIDDEN');
// Only problem details count: Cloudflare Access answers with its own HTML page.
assert.equal(await responseProblemCode(answer('<html>Forbidden</html>', 'text/html')), null);
assert.equal(await responseProblemCode(answer(JSON.stringify({ code: 'FORBIDDEN' }), 'application/json')), null);
assert.equal(await responseProblemCode(answer('{', 'application/problem+json')), null);
assert.equal(await responseProblemCode(answer('', null)), null);
