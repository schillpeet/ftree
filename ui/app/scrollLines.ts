// The 3D tree's connection lines between the hanging cards (components.md, "Connection lines"): one
// line between partners at card height, and from its middle a line down, across, and down to the top
// of each child's card, where the scroll's rod hangs. Pure, so `scrollLines.check.mjs` can test it.
//
// The cards hang anywhere in the crown and turn with the camera (or sway), so a card counts as the
// upright cylinder it can sweep: CARD.width across, CARD.height down from its top. Where the
// preferred line would run through a card, the router tries other heights, then a detour over (or
// under) the cards in the way, then leaving the partners' line further out, and keeps the first line
// with the fewest crossings; `crossings` measures that. It never bends sideways around a card, so a
// crowded crown can still leave one (in synthetic crowns about 1 in 200 lines with a quarter of the
// pins taken, 1 in 15 with more than half).
import { CARD, type Point } from './pins.ts';

type Person = { id: string; parentIds: string[]; partnerIds: string[] };
// One drawn piece: the line between two partners (in two halves, from each partner to the middle),
// or the way from that middle (or a single parent's card) to a child.
export type ScrollPath = { kind: 'partner' | 'child'; points: Point[]; lit: boolean };

// 8 CSS px of the scroll (pins.ts: 1 px is 0.02 units): the radius of the two rounded bends.
export const BEND = 8 * 0.02;
const R = CARD.width / 2;
const H = CARD.height;
const EPS = 1e-3;
// How many other heights a line may try between its ends.
const TRIES = 16;

const xz = ([x, , z]: Point, [u, , w]: Point) => Math.hypot(u - x, w - z);
const at = ([x, , z]: Point, y: number): Point => [x, y, z];
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
// The point on the card's cylinder toward `to`, at height y.
const edge = (card: Point, to: Point, y: number): Point => {
  const d = xz(card, to) || 1;
  return [card[0] + ((to[0] - card[0]) / d) * R, y, card[2] + ((to[2] - card[2]) / d) * R];
};

// Whether the segment runs through the inside of the card hanging from `top`: touching its outline,
// such as a line ending on its top edge or its side, does not count.
export function throughCard(a: Point, b: Point, top: Point) {
  const [lo, hi] = [top[1] - H + EPS, top[1] - EPS];
  const dy = b[1] - a[1];
  let [t0, t1] = [0, 1];
  if (Math.abs(dy) < 1e-9) {
    if (a[1] <= lo || a[1] >= hi) return false;
  } else {
    const [ta, tb] = [(lo - a[1]) / dy, (hi - a[1]) / dy];
    [t0, t1] = [Math.max(0, Math.min(ta, tb)), Math.min(1, Math.max(ta, tb))];
    if (t1 - t0 < 1e-9) return false;
  }
  // The point of the piece inside the height range that comes closest to the card's axis.
  const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
  const [ox, oz] = [a[0] - top[0], a[2] - top[2]];
  const len = dx * dx + dz * dz;
  const t = len < 1e-12 ? t0 : Math.min(t1, Math.max(t0, -(ox * dx + oz * dz) / len));
  return Math.hypot(ox + t * dx, oz + t * dz) < R - EPS;
}

// How often the polyline runs through a card.
export function crossings(points: Point[], cards: Iterable<Point>) {
  let count = 0;
  for (const card of cards)
    for (let i = 1; i < points.length; i++) if (throughCard(points[i - 1], points[i], card)) count++;
  return count;
}

// The cards whose cylinder reaches into the ground plan of the box around the points.
const around = (points: Point[], cards: Point[]) => {
  const [xs, zs] = [points.map((p) => p[0]), points.map((p) => p[2])];
  const [x0, x1, z0, z1] = [Math.min(...xs) - R, Math.max(...xs) + R, Math.min(...zs) - R, Math.max(...zs) + R];
  return cards.filter(([x, , z]) => x > x0 && x < x1 && z > z0 && z < z1);
};

// The first of the candidate polylines that crosses the fewest cards; earlier ones win ties.
function fewestCrossings(candidates: Point[][], cards: Point[]) {
  let best = candidates[0];
  let least = Infinity;
  for (const points of candidates) {
    const n = crossings(points, around(points, cards));
    if (n < least) [best, least] = [points, n];
    if (n === 0) break;
  }
  return best;
}

// Heights from lo to hi to try, the preferred one first, then by their distance to it: the ends, even
// steps between them, and the gaps right above and below each card near the line (`near`).
function heights(lo: number, hi: number, preferred: number, near: Point[] = []) {
  const steps = Array.from({ length: TRIES + 1 }, (_, i) => lo + ((hi - lo) * i) / TRIES);
  const gaps = near.flatMap(([, top]) => [top + BEND, top - H - BEND]).filter((y) => y >= lo && y <= hi);
  const first = Math.min(hi, Math.max(lo, preferred));
  return [first, ...[...steps, ...gaps].sort((p, q) => Math.abs(p - first) - Math.abs(q - first))];
}

// The line between two cards: horizontal at a height both cards share (their middle if they hang
// level), else from the side of one to the side of the other at the same depth into each card.
// Cards stacked above each other are joined from the bottom of the upper to the top of the lower.
// When every such line would run through a card in between, it leaves both tops upward (or both
// bottoms downward) and runs across above (or below) the cards in its way.
function connector(a: Point, b: Point, cards: Point[]): Point[] {
  if (xz(a, b) < 2 * R + EPS) {
    const [upper, lower] = a[1] >= b[1] ? [a, b] : [b, a];
    return [at(upper, upper[1] - H), lower];
  }
  const near = around([a, b], cards);
  const [lo, hi] = [Math.max(a[1], b[1]) - H, Math.min(a[1], b[1])];
  const level = (a[1] + b[1]) / 2 - H / 2;
  const straight: Point[][] =
    hi - lo > 2 * BEND
      ? heights(lo + BEND, hi - BEND, level, near).map((y) => [edge(a, b, y), edge(b, a, y)])
      : [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8].map((f) => [edge(a, b, a[1] - f * H), edge(b, a, b[1] - f * H)]);
  const over = near
    .map(([, top]) => top + BEND)
    .filter((y) => y > Math.max(a[1], b[1]) + BEND - EPS)
    .sort((p, q) => p - q)
    .map((y) => [a, at(a, y), at(b, y), b]);
  const [bottomA, bottomB] = [at(a, a[1] - H), at(b, b[1] - H)];
  const under = near
    .map(([, top]) => top - H - BEND)
    .filter((y) => y < Math.min(bottomA[1], bottomB[1]) - BEND + EPS)
    .sort((p, q) => q - p)
    .map((y) => [bottomA, at(a, y), at(b, y), bottomB]);
  return fewestCrossings([...straight, ...over, ...under], cards);
}

// The middle of a line from `connector`: of its horizontal run when it has one.
const middleOf = (line: Point[]) => (line.length === 4 ? mid(line[1], line[2]) : mid(line[0], line.at(-1)!));
// Where children's lines may leave that line: its middle, else ever further out along the same run.
const startsOn = (line: Point[]) => {
  const [a, b] = line.length === 4 ? [line[1], line[2]] : [line[0], line.at(-1)!];
  return [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8].map((f): Point => [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * f) as Point);
};

// From `start` (the middle of the parents' line, or a single parent's card edge) to the child's
// card: down to a height between the parents' cards and the child's, across, and down onto the top
// edge; if every such height runs through a card, up from the start and across above the cards in
// the way instead. A child hanging higher is reached from below at its bottom edge; one level with
// the start by a straight line to its side. Only if all of that runs through a card, the line leaves
// the parents' line further out (`others`).
function childPath(start: Point, child: Point, parentsBottom: number, cards: Point[], others: Point[] = []): Point[] {
  const path = routeChild(start, child, parentsBottom, cards);
  if (!others.length || crossings(path, cards) === 0) return path;
  return fewestCrossings([path, ...others.map((other) => routeChild(other, child, parentsBottom, cards))], cards);
}

function routeChild(start: Point, child: Point, parentsBottom: number, cards: Point[]): Point[] {
  const via = (end: Point, ys: number[]) => ys.map((y) => [start, at(start, y), at(end, y), end]);
  if (child[1] < start[1] - 2 * BEND) {
    const near = around([start, child], cards);
    const over = near
      .map(([, top]) => top + BEND)
      .filter((y) => y > start[1] + BEND - EPS)
      .sort((p, q) => p - q);
    const preferred = (Math.min(parentsBottom, start[1]) + child[1]) / 2;
    return fewestCrossings(via(child, [...heights(child[1] + BEND, start[1] - BEND, preferred, near), ...over]), cards);
  }
  const bottom = at(child, child[1] - H);
  if (bottom[1] > start[1] + 2 * BEND) {
    const near = around([start, child], cards);
    return fewestCrossings(via(bottom, heights(start[1] + BEND, bottom[1] - BEND, (start[1] + bottom[1]) / 2, near)), cards);
  }
  return [start, xz(start, child) > R ? edge(child, start, start[1]) : child];
}

// Every connection line between the positioned people, routed as above. A line lights up on the
// lineage: between two partners who both belong to it, and to a child of it from a parent of it. A
// parent of the lineage lights up their half of the line to a co-parent outside it, so the child's lit
// line never starts in the middle of nowhere.
export function scrollPaths(people: Person[], positions: Map<string, Point>, lineage: Set<string>): ScrollPath[] {
  const cards = [...positions.values()];
  const on = (id: string) => lineage.has(id);
  const placed = (id: string) => positions.has(id);
  const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
  for (const p of people) {
    if (!placed(p.id)) continue;
    const parentIds = p.parentIds.filter(placed).sort();
    if (!parentIds.length) continue;
    const key = parentIds.join();
    if (!families.has(key)) families.set(key, { parentIds, childIds: [] });
    families.get(key)!.childIds.push(p.id);
  }
  // Each pair of partners or co-parents gets one line; its halves light up as described above.
  const pairs = new Map<string, { a: string; b: string; litA: boolean; litB: boolean; line?: Point[] }>();
  const pair = (a: string, b: string) => {
    const [x, y] = a < b ? [a, b] : [b, a];
    const key = `${x}\n${y}`;
    if (!pairs.has(key)) pairs.set(key, { a: x, b: y, litA: on(x) && on(y), litB: on(x) && on(y) });
    return pairs.get(key)!;
  };
  for (const p of people) for (const id of p.partnerIds) if (p.id !== id && placed(p.id) && placed(id)) pair(p.id, id);

  const paths: ScrollPath[] = [];
  for (const { parentIds, childIds } of families.values()) {
    const tops = parentIds.map((id) => positions.get(id)!);
    const lines = parentIds.slice(1).map((id, i) => pair(parentIds[i], id));
    // A single parent's line leaves the bottom of their card, or its top toward a child hanging higher.
    const startsFor = (child: Point): Point[] => {
      const first = lines[0];
      if (!first) return [child[1] - H > tops[0][1] ? tops[0] : at(tops[0], tops[0][1] - H)];
      first.line ??= connector(positions.get(first.a)!, positions.get(first.b)!, cards);
      return startsOn(first.line);
    };
    const parentsBottom = Math.min(...tops.map((top) => top[1])) - H;
    let anyLit = false;
    for (const id of childIds) {
      const lit = on(id) && parentIds.some(on);
      anyLit ||= lit;
      const child = positions.get(id)!;
      const [start, ...others] = startsFor(child);
      paths.push({ kind: 'child', points: childPath(start, child, parentsBottom, cards, others), lit });
    }
    if (anyLit)
      for (const line of lines) {
        line.litA ||= on(line.a);
        line.litB ||= on(line.b);
      }
  }
  for (const line of pairs.values()) {
    const points = (line.line ??= connector(positions.get(line.a)!, positions.get(line.b)!, cards));
    const middle = middleOf(points);
    const half = points.length / 2;
    paths.push(
      { kind: 'partner', points: [...points.slice(0, half), middle], lit: line.litA },
      { kind: 'partner', points: [middle, ...points.slice(half)], lit: line.litB },
    );
  }
  return paths;
}

// The polyline as segment pairs for drei's `<Line segments>`, its bends rounded with BEND (or less on
// short pieces) by a quadratic curve in a few straight steps.
export function roundedSegments(points: Point[], radius = BEND, steps = 6): Point[] {
  const clean = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1], p[2] - points[i - 1][2]) > 1e-9);
  const out: Point[] = [];
  let from = clean[0];
  for (let i = 1; i < clean.length - 1; i++) {
    const [prev, corner, next] = [clean[i - 1], clean[i], clean[i + 1]];
    const dir = (p: Point, q: Point) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      return { len, unit: [(q[0] - p[0]) / len, (q[1] - p[1]) / len, (q[2] - p[2]) / len] as Point };
    };
    const [into, onward] = [dir(prev, corner), dir(corner, next)];
    if (into.unit.every((v, k) => Math.abs(v - onward.unit[k]) < 1e-9)) continue;
    const r = Math.min(radius, into.len / 2, onward.len / 2);
    const a = corner.map((v, k) => v - into.unit[k] * r) as Point;
    const b = corner.map((v, k) => v + onward.unit[k] * r) as Point;
    out.push(from, a);
    let last = a;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const p = a.map((v, k) => (1 - t) ** 2 * v + 2 * (1 - t) * t * corner[k] + t ** 2 * b[k]) as Point;
      out.push(last, p);
      last = p;
    }
    from = b;
  }
  if (clean.length > 1) out.push(from, clean.at(-1)!);
  return out;
}

// The lines to draw, as segment pairs: dim ones and the lit lineage.
export function scrollLines(people: Person[], positions: Map<string, Point>, lineage: Set<string>) {
  const dim: Point[] = [];
  const lit: Point[] = [];
  for (const path of scrollPaths(people, positions, lineage)) (path.lit ? lit : dim).push(...roundedSegments(path.points));
  return { dim, lit };
}
