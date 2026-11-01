import assert from 'node:assert/strict';
import { chipName } from './chipName.ts';

assert.equal(chipName(null), null, 'signed out has no name');
assert.equal(chipName({ displayName: 'Anna', email: 'anna@example.org' }), 'Anna');
assert.equal(chipName({ displayName: '  ', email: 'anna@example.org' }), 'anna@example.org', 'a blank name falls back to the email');
assert.equal(chipName({ displayName: '', email: '' }), null, 'nothing to show');
