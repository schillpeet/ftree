// Run with `node app/tokenColor.check.mjs`: translucent tokens become an opaque Three.js colour plus
// their alpha as opacity; opaque ones keep their value at full opacity.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { splitAlpha } from './tokenColor.ts';

assert.deepEqual(splitAlpha('rgba(242,195,139,.3)'), { color: 'rgb(242, 195, 139)', opacity: 0.3 });
assert.deepEqual(splitAlpha(' rgba(72, 229, 255, 0.55) '), { color: 'rgb(72, 229, 255)', opacity: 0.55 });
assert.deepEqual(splitAlpha('rgb(72 229 255 / 40%)'), { color: 'rgb(72, 229, 255)', opacity: 0.4 });
assert.deepEqual(splitAlpha('rgb(1, 2, 3)'), { color: 'rgb(1, 2, 3)', opacity: 1 });
assert.deepEqual(splitAlpha('#48E5FF'), { color: '#48E5FF', opacity: 1 });
// The CSS build turns rgba() into 8-digit hex, which three cannot read either.
assert.deepEqual(splitAlpha('#f2c38b4d'), { color: '#f2c38b', opacity: 0x4d / 255 });
assert.deepEqual(splitAlpha('#0f08'), { color: '#00ff00', opacity: 0x88 / 255 });
// Before the styles load a token reads empty: white, like the server render.
assert.deepEqual(splitAlpha(''), { color: '#ffffff', opacity: 1 });

// Every line token of both themes parses.
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
for (const [, value] of tokens.matchAll(/--(?:line-on|line-dim|glow):\s*([^;]+);/g)) {
  const { color, opacity } = splitAlpha(value);
  assert.match(color, /^(#[0-9a-f]{6}|rgb\(\d+, \d+, \d+\))$/i, value);
  assert.ok(opacity > 0 && opacity <= 1, value);
}
console.log('token colours ok');
