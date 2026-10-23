// Collapses the "Dependencies" section of the newest release in release-please notes into one line,
// so any number of Dependabot updates shows up as a single changelog entry.
// Run with `node .github/scripts/collapse-dependency-notes.mjs <file>`: rewrites the file only when it changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ENTRY = '* update dependencies with dependabot';
const LINK = /\[#(\d+)\]\(([^)]+)\)/g;

const isSectionEnd = (line) => /^(#{1,3} |---)/.test(line);

export function collapseDependencyNotes(markdown) {
  const lines = markdown.split('\n');
  const release = lines.findIndex((line) => line.startsWith('## '));
  if (release < 0) return markdown;
  const next = lines.findIndex((line, i) => i > release && line.startsWith('## '));
  const releaseEnd = next < 0 ? lines.length : next;
  const heading = lines.findIndex((line, i) => i > release && i < releaseEnd && line === '### Dependencies');
  if (heading < 0) return markdown;

  let end = heading + 1;
  while (end < releaseEnd && !isSectionEnd(lines[end])) end++;
  const bullets = lines.slice(heading + 1, end).filter((line) => line.startsWith('* '));
  if (bullets.length === 0) return markdown;

  // An already collapsed line keeps all its links; each Dependabot entry contributes its PR link.
  const links = new Map();
  for (const line of bullets) {
    const matches = [...line.matchAll(LINK)];
    for (const [, number, url] of line.startsWith(ENTRY) ? matches : matches.slice(0, 1)) {
      if (!links.has(number)) links.set(number, url);
    }
  }
  const list = [...links].sort(([a], [b]) => a - b).map(([number, url]) => `[#${number}](${url})`);
  const entry = list.length ? `${ENTRY} (${list.join(', ')})` : ENTRY;

  const body = lines.slice(heading + 1, end);
  const first = body.findIndex((line) => line.startsWith('* '));
  const last = body.findLastIndex((line) => line.startsWith('* '));
  const collapsed = [...body.slice(0, first), entry, ...body.slice(last + 1)];
  return [...lines.slice(0, heading + 1), ...collapsed, ...lines.slice(end)].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: collapse-dependency-notes.mjs <file>');
    process.exit(2);
  }
  const before = readFileSync(file, 'utf8');
  const after = collapseDependencyNotes(before);
  if (after !== before) writeFileSync(file, after);
  console.log(after === before ? `${file}: unchanged` : `${file}: collapsed dependency updates`);
}
