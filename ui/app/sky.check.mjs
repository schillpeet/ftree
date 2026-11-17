// Run with `node app/sky.check.mjs`: the sun stands where it should over Berlin, and daylight and
// stars fade monotonically through twilight.
import assert from 'node:assert/strict';
import { daylight, environmentIntensity, environmentKey, evening, nightGlow, nightSky, starlight, sunDirection, sunPosition } from './sky.ts';

const berlin = { latitude: 52.52, longitude: 13.4 };
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const at = (iso) => sunPosition(new Date(iso), berlin);

// Midsummer noon (13:00 CEST = 11:00 UTC): high in the south.
const noon = at('2026-06-21T11:07:00Z');
assert.ok(deg(noon.altitude) > 59 && deg(noon.altitude) < 62, `noon altitude ${deg(noon.altitude)}`);
assert.ok(Math.abs(deg(noon.azimuth)) < 5, `noon azimuth ${deg(noon.azimuth)}`);
// Midnight: well below the horizon.
assert.ok(deg(at('2026-06-21T22:00:00Z').altitude) < -10);
// Sunrise around 4:43 CEST (02:43 UTC) in the north-east, sunset around 21:33 CEST in the north-west.
assert.ok(Math.abs(deg(at('2026-06-21T02:43:00Z').altitude)) < 1.5);
assert.ok(deg(at('2026-06-21T02:43:00Z').azimuth) < -120);
assert.ok(Math.abs(deg(at('2026-06-21T19:33:00Z').altitude)) < 1.5);
assert.ok(deg(at('2026-06-21T19:33:00Z').azimuth) > 120);
// Midwinter noon: low.
assert.ok(Math.abs(deg(at('2026-12-21T11:07:00Z').altitude) - 14) < 1.5);

// West (azimuth +90°) lies to the right of the south heading.
const south = 0;
const west = sunDirection(0, Math.PI / 2, south);
assert.ok(Math.abs(west[0]) < 1e-9 && west[2] > 0.99);
assert.ok(Math.abs(sunDirection(Math.PI / 2, 0, south)[1] - 1) < 1e-9);

for (let a = -20; a < 20; a++) {
  const [r, s] = [(a * Math.PI) / 180, ((a + 1) * Math.PI) / 180];
  assert.ok(daylight(s) >= daylight(r) && starlight(s) <= starlight(r));
  assert.ok(evening(s) <= evening(r));
}
assert.equal(daylight(-0.2), 0);
assert.equal(daylight(0.2), 1);
assert.equal(starlight(-0.3), 1);
assert.equal(starlight(0), 0);
assert.equal(evening(0.3), 0);
assert.equal(evening(-0.2), 1);
// The environment cube dims to a low night level and is re-rendered only per half degree.
assert.equal(environmentIntensity(rad(30)), 1);
assert.ok(Math.abs(environmentIntensity(rad(-20)) - 0.12) < 1e-9);
for (let d = -10; d < 10; d++) assert.ok(environmentIntensity(rad(d + 1)) >= environmentIntensity(rad(d)));
assert.equal(environmentKey(rad(10.1), rad(40.1)), environmentKey(rad(10.2), rad(40.2)));
assert.notEqual(environmentKey(rad(10.0), rad(40)), environmentKey(rad(10.6), rad(40)));
assert.notEqual(environmentKey(rad(10), rad(40.0)), environmentKey(rad(10), rad(40.6)));
console.log('sky ok');

// The night watch: the night's lights are off while the sun is up and full from 6° below; the night dome waits for
// the afterglow to pass.
for (let a = -20; a < 20; a++) assert.ok(nightGlow(rad(a + 1)) <= nightGlow(rad(a)) && nightSky(rad(a + 1)) <= nightSky(rad(a)));
for (const a of [0, 0.01, 5, 30, 60]) assert.equal(nightGlow(rad(a)), 0);
for (const a of [-6, -7, -40]) assert.equal(nightGlow(rad(a)), 1);
assert.equal(nightSky(rad(-2)), 0);
assert.equal(nightSky(rad(-12)), 1);
assert.ok(nightSky(rad(-5), rad(-4), rad(-10)) > 0);
