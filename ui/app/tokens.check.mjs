// Run with `node app/tokens.check.mjs`: `tokens.css` mirrors the design tokens in `docs/design/tokens.json`,
// and no `--glass-*` variable is left in `ui/app`.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const json = JSON.parse(readFileSync(new URL('../../docs/design/tokens.json', import.meta.url), 'utf8'));
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const squash = (value) => value.replace(/\s+/g, '').toLowerCase();
const declarations = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, squash(value)]));
const flat = (group, prefix) => Object.fromEntries(Object.entries(group).map(([name, value]) => [`${prefix}-${kebab(name)}`, squash(value)]));

// The body of the rule whose selector is exactly `selector`.
function block(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} missing in tokens.css`);
  return css.slice(start, css.indexOf('}', start));
}

// The fonts point at the `next/font` variables in `ui/`, so only the rest is compared.
const shared = declarations(block(':root'));
const expectedShared = { ...flat(json.radius, 'radius'), ...flat(json.size, 'size'), ...flat(json.blur, 'blur') };
for (const [name, value] of Object.entries(expectedShared)) assert.equal(shared[name], value, `--${name}`);

for (const theme of ['3d', 'tron']) {
  const selector = theme === '3d' ? ':root, [data-theme="3d"]' : `[data-theme="${theme}"]`;
  assert.deepEqual(declarations(block(selector)), Object.fromEntries(Object.entries(json.theme[theme]).map(([name, value]) => [kebab(name), squash(value)])), theme);
}

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
}
const appDir = new URL('.', import.meta.url).pathname;
const self = new URL(import.meta.url).pathname;
const usingGlass = files(appDir).filter((file) => file !== self && /\.(css|tsx?|mjs)$/.test(file) && /--glass-/.test(readFileSync(file, 'utf8')));
assert.deepEqual(usingGlass, []);
