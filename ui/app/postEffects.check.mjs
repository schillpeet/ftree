// Run with `node app/postEffects.check.mjs`: the post-processing pipeline starts at the high tier
// except on touch devices, and the stored switch keeps its key.
import assert from 'node:assert/strict';
import { POST_KEY, startTier } from './postEffects.ts';

assert.equal(startTier(false), 'high');
assert.equal(startTier(true), 'medium');
assert.equal(POST_KEY, 'ftree.post');
console.log('postEffects ok');
