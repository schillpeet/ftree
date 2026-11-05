// Run with `node app/sunLocation.check.mjs`: only the toggle's click may raise the browser's location prompt.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onLocationChange, resumeLocation, setLocationOn } from './sunLocation.ts';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

let lookups = 0;
let answer;
let permission;
function browser({ geolocation = true } = {}) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      permissions: { query: async () => ({ state: permission }) },
      geolocation: geolocation
        ? {
            getCurrentPosition(success, failure) {
              lookups++;
              answer(success, failure);
            },
          }
        : undefined,
    },
  });
}
const grant = (success) => success({ coords: { latitude: 10, longitude: 20 } });
const deny = (_, failure) => failure({ code: 1 });
const on = () => store.get('ftree.location') === 'on';
const reset = () => {
  setLocationOn(false);
  store.clear();
  lookups = 0;
};

browser();

// A fresh browser never looks anything up, whatever it would allow.
for (permission of ['prompt', 'granted', 'denied']) {
  reset();
  await resumeLocation();
  assert.equal(lookups, 0, permission);
  assert.ok(!on());
}

// The click looks the location up and stays on when the browser answers.
reset();
answer = grant;
let refused = 0;
setLocationOn(true, () => refused++);
assert.equal(lookups, 1);
assert.ok(on());
assert.equal(refused, 0);

// Denied, or a browser without geolocation: back off, and the caller hears why.
reset();
answer = deny;
setLocationOn(true, () => refused++);
assert.ok(!on());
assert.equal(refused, 1);
browser({ geolocation: false });
reset();
setLocationOn(true, () => refused++);
assert.ok(!on());
assert.equal(refused, 2);
browser();

// A later visit with the switch on: read without a prompt if allowed, else switched off without looking anything up.
// `setLocationOn(false)` forgets the position, as a reload would; the store is then set by hand, as a reload finds it.
reset();
store.set('ftree.location', 'on');
permission = 'granted';
answer = grant;
await resumeLocation();
assert.equal(lookups, 1);
assert.ok(on());
for (permission of ['prompt', 'denied']) {
  reset();
  store.set('ftree.location', 'on');
  await resumeLocation();
  assert.equal(lookups, 0, permission);
  assert.ok(!on(), permission);
}

// While the click's prompt is open, a resume must not take the switch back off.
reset();
let pending;
answer = (success) => (pending = success);
permission = 'prompt';
setLocationOn(true);
await resumeLocation();
assert.ok(on());
assert.equal(lookups, 1);
pending({ coords: { latitude: 1, longitude: 2 } });

// A change reaches listeners, and an answer that arrives after switching off does not switch back on.
reset();
let changes = 0;
const stop = onLocationChange(() => changes++);
answer = (success) => (pending = success);
setLocationOn(true);
setLocationOn(false);
pending({ coords: { latitude: 1, longitude: 2 } });
assert.ok(!on());
assert.ok(changes >= 2);
stop();

// The scene itself never asks: the only lookup is the one in `sunLocation.ts`.
assert.ok(!readFileSync(new URL('./Scene.tsx', import.meta.url), 'utf8').includes('geolocation'));
