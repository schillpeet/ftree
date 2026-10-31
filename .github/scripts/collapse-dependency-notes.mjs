// Tidies the newest release in release-please notes: entries with the same text are merged into one line
// (an empty squash commit repeats its PR's title), and the "Dependencies" section collapses into one line,
// so any number of Dependabot updates shows up as a single changelog entry.
// Run with `node .github/scripts/collapse-dependency-notes.mjs <file>`: rewrites the file only when it changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ENTRY = '* update dependencies with dependabot';
const LINK = /\[#(\d+)\]\(([^)]+)\)/g;

const isSectionEnd = (line) => /^(#{1,3} |---)/.test(line);

export function tidyReleaseNotes(markdown) {
  return collapseDependencyNotes(mergeDuplicateNotes(markdown));
}

// Entries are compared by their text before the first link group; the links of a repeated entry are appended
// to the first one, so `* text ([#1](…)) ([aaa](…))` and `* text ([#2](…)) ([bbb](…))` become one line.
export function mergeDuplicateNotes(markdown) {
  const lines = markdown.split('\n');
  const release = lines.findIndex((line) => line.startsWith('## '));
  if (release < 0) return markdown;
  const next = lines.findIndex((line, i) => i > release && line.startsWith('## '));
  const releaseEnd = next < 0 ? lines.length : next;

  const result = [];
  const firstByText = new Map();
  lines.forEach((line, i) => {
    if (i <= release || i >= releaseEnd) {
      result.push(line);
      return;
    }
    if (line.startsWith('### ')) firstByText.clear();
    if (!line.startsWith('* ')) {
      result.push(line);
      return;
    }
    const split = line.indexOf(' ([');
    const text = split < 0 ? line : line.slice(0, split);
    const links = split < 0 ? '' : line.slice(split);
    if (!firstByText.has(text)) {
      firstByText.set(text, result.length);
      result.push(line);
      return;
    }
    const index = firstByText.get(text);
    if (links && !result[index].includes(links)) result[index] += links;
  });
  return result.join('\n');
}

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
  const after = tidyReleaseNotes(before);
  if (after !== before) writeFileSync(file, after);
  console.log(after === before ? `${file}: unchanged` : `${file}: collapsed dependency updates`);
}
