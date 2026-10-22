// Checks a routed drawing against the circuit-diagram rules and reads the relations back from the
// segments alone, without `route`'s internals, so it catches routing bugs; `route.check.mjs` tests
// it. Returns one human-readable line per violation, each starting with its kind; [] is valid.
import type { Model } from './model.ts';
import type { Routes, Segment, XY } from './routing.ts';
import { BAR_CLEAR, MIN_TRACK, NAME_CLEAR, NAME_H, NAME_W } from './routing.ts';
import { ROW_GAP } from '../simpleLayout.ts';

const EPS = 1e-6;
const GLYPH: Record<string, string> = { married: '⚭', widowed: '⚭', together: '⚯', divorced: '⚮' };
const fmt = ([x, y]: XY) => `(${+x.toFixed(2)}, ${+y.toFixed(2)})`;
const key = ([x, y]: XY) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
const same = (p: XY, q: XY) => Math.abs(p[0] - q[0]) < EPS && Math.abs(p[1] - q[1]) < EPS;
const range = (s: Segment, i: 0 | 1): [number, number] => [Math.min(s.a[i], s.b[i]), Math.max(s.a[i], s.b[i])];
const shared = ([lo, hi]: [number, number], [lo2, hi2]: [number, number]) => Math.min(hi, hi2) - Math.max(lo, lo2);
const strictly = (v: number, [lo, hi]: [number, number]) => v > lo + EPS && v < hi - EPS;
const flat = (s: Segment) => Math.abs(s.a[1] - s.b[1]) < EPS;
const upright = (s: Segment) => Math.abs(s.a[0] - s.b[0]) < EPS;
const on = (p: XY, s: Segment) => shared(range(s, 0), [p[0], p[0]]) > -EPS && shared(range(s, 1), [p[1], p[1]]) > -EPS;
const isEnd = (p: XY, s: Segment) => same(p, s.a) || same(p, s.b);
const sameSet = (p: readonly string[], q: readonly string[]) => p.length === q.length && p.every((id) => q.includes(id));
const pairKey = (x: string, y: string) => (x < y ? `${x}\n${y}` : `${y}\n${x}`);
const desc = (s: Segment) => `${fmt(s.a)}–${fmt(s.b)}`;

export function verify(model: Model, at: Map<string, XY>, routes: Routes): string[] {
  const out: string[] = [];
  // 1. Right angles only.
  for (const s of routes.segments)
    if (!flat(s) && !upright(s)) out.push(`angle: ${desc(s)} is neither horizontal nor vertical`);
    else if (same(s.a, s.b)) out.push(`angle: ${desc(s)} has no length`);
  const segs = routes.segments.filter((s) => (flat(s) || upright(s)) && !same(s.a, s.b));

  // 2. and 4. No overlap, parallel lines a track apart, no crossing.
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const [s, t] = [segs[i], segs[j]];
      if (flat(s) && flat(t)) {
        const dy = Math.abs(s.a[1] - t.a[1]);
        if (shared(range(s, 0), range(t, 0)) <= EPS) continue;
        if (dy < EPS) out.push(`overlap: ${desc(s)} and ${desc(t)} lie on each other`);
        else if (dy < MIN_TRACK - EPS) out.push(`spacing: ${desc(s)} and ${desc(t)} are closer than a track`);
      } else if (upright(s) && upright(t)) {
        if (Math.abs(s.a[0] - t.a[0]) < EPS && shared(range(s, 1), range(t, 1)) > EPS) out.push(`overlap: ${desc(s)} and ${desc(t)} lie on each other`);
      } else {
        const [h, v] = flat(s) ? [s, t] : [t, s];
        if (strictly(v.a[0], range(h, 0)) && strictly(h.a[1], range(v, 1))) out.push(`crossing: ${desc(h)} crosses ${desc(v)}`);
      }
    }

  // 3. No segment into a name, except one ending at that name's own top or bottom attachment point.
  for (const [id, [px, py]] of at) {
    const xs: [number, number] = [px - NAME_W / 2, px + NAME_W / 2];
    const ys: [number, number] = [py - NAME_H / 2, py + NAME_H / 2];
    for (const s of segs) {
      if ([s.a, s.b].some((p) => same(p, [px, ys[0]]) || same(p, [px, ys[1]]))) continue;
      const ends = [s.a, s.b].some((p) => strictly(p[0], xs) && strictly(p[1], ys));
      const passes = flat(s)
        ? strictly(s.a[1], ys) && shared(range(s, 0), xs) > EPS
        : strictly(s.a[0], xs) && shared(range(s, 1), ys) > EPS;
      const enters = ends || passes;
      if (enters) out.push(`name: ${desc(s)} runs through the name of ${id}`);
    }
  }

  // 4. No point joins four segments, except the one dot where a union's stem and the line to its child
  // right below the node meet the bar; exactly the points joining three or four that way have a dot.
  const degree = (p: XY) => segs.reduce((n, s) => n + (isEnd(p, s) ? 1 : on(p, s) ? 2 : 0), 0);
  // A bar passing through, a vertical ending at the point from above and one from below.
  const plus = (p: XY) =>
    segs.filter((s) => !isEnd(p, s) && on(p, s) && s.a[1] === s.b[1]).length === 1 &&
    segs.filter((s) => isEnd(p, s) && s.a[0] === s.b[0] && Math.max(s.a[1], s.b[1]) > p[1] + EPS).length === 1 &&
    segs.filter((s) => isEnd(p, s) && s.a[0] === s.b[0] && Math.min(s.a[1], s.b[1]) < p[1] - EPS).length === 1;
  const dots = new Set(routes.junctions.map(key));
  for (const p of new Map(segs.flatMap((s) => [s.a, s.b]).map((p) => [key(p), p])).values()) {
    const n = degree(p);
    if (n >= 4 && !(n === 4 && plus(p))) out.push(`four-way: ${n} segments meet at ${fmt(p)}`);
    if ((n === 3 || (n === 4 && plus(p))) && !dots.has(key(p))) out.push(`dot: the junction at ${fmt(p)} has no dot`);
  }
  for (const p of routes.junctions) if (degree(p) !== 3 && !(degree(p) === 4 && plus(p))) out.push(`dot: ${fmt(p)} is no junction of three segments`);

  // Horizontal lines stay inside a channel between two rows.
  const rows = [...new Set([...at.values()].map(([, y]) => y))];
  for (const s of segs.filter(flat))
    if (!rows.some((y) => s.a[1] <= y - NAME_CLEAR + EPS && s.a[1] >= y - ROW_GAP + BAR_CLEAR - EPS))
      out.push(`channel: ${desc(s)} lies outside every channel`);

  out.push(...readBack(model, at, routes, segs));
  return out;
}

// 5. Reads the drawing back as a graph: partnership lines with their style and symbol, and for each
// union the net of segments reaching its children, which must lead to exactly its parents.
function readBack(model: Model, at: Map<string, XY>, routes: Routes, segs: Segment[]): string[] {
  const out: string[] = [];
  const top = (id: string): XY => [at.get(id)![0], at.get(id)![1] + NAME_H / 2];
  const bottom = (id: string): XY => [at.get(id)![0], at.get(id)![1] - NAME_H / 2];
  // Whether vertical segments at x cover [y0, y1] without a gap.
  const covers = (x: number, y0: number, y1: number) => {
    let reach = Math.min(y0, y1);
    const stretches = segs.filter((s) => upright(s) && Math.abs(s.a[0] - x) < EPS).map((s) => range(s, 1)).sort((p, q) => p[0] - q[0]);
    for (const [lo, hi] of stretches) if (lo <= reach + EPS) reach = Math.max(reach, hi);
    return reach >= Math.max(y0, y1) - EPS;
  };

  // Horizontal runs: collinear segments joined end to end.
  type Run = { y: number; x0: number; x1: number; segs: Segment[] };
  const runs: Run[] = [];
  for (const s of segs.filter(flat).sort((p, q) => p.a[1] - q.a[1] || range(p, 0)[0] - range(q, 0)[0])) {
    const last = runs[runs.length - 1];
    const [x0, x1] = range(s, 0);
    if (last && Math.abs(last.y - s.a[1]) < EPS && x0 <= last.x1 + EPS) {
      last.x1 = Math.max(last.x1, x1);
      last.segs.push(s);
    } else runs.push({ y: s.a[1], x0, x1, segs: [s] });
  }

  // Partnerships: a run from one partner's x to the other's, each partner dropping straight onto it.
  const runOf = new Map<string, Run>();
  for (const { a, b, status } of model.partnerships) {
    if (!at.has(a) || !at.has(b)) continue;
    // A pair of co-parents without a partnership has a line only while their union is drawn.
    if (status === null && model.unions.filter((u) => u.parents.includes(a) && u.parents.includes(b)).every((u) => routes.stubs.some((s) => u.children.includes(s.child) && sameSet(s.parents, u.parents)))) continue;
    if (Math.abs(at.get(a)![1] - at.get(b)![1]) > EPS) {
      out.push(`read-back: partners ${a} and ${b} stand in different rows`);
      continue;
    }
    const [lo, hi] = [Math.min(top(a)[0], top(b)[0]), Math.max(top(a)[0], top(b)[0])];
    const run = runs.find(
      (r) => Math.abs(r.x0 - lo) < EPS && Math.abs(r.x1 - hi) < EPS && covers(lo, r.y, bottom(a)[1]) && covers(hi, r.y, bottom(b)[1]),
    );
    if (!run) {
      out.push(`read-back: no line between partners ${a} and ${b}`);
      continue;
    }
    runOf.set(pairKey(a, b), run);
    const style = status === 'separated' || status === 'divorced' ? 'dashed' : 'solid';
    if (run.segs.some((s) => s.style !== style)) out.push(`read-back: the line between ${a} and ${b} should be ${style}`);
    const glyphs = routes.glyphs.filter((g) => sameSet(g.people, [a, b]));
    const want = status ? GLYPH[status] : undefined;
    const placed = (p: XY) => Math.abs(p[1] - run.y) < EPS && strictly(p[0], [run.x0, run.x1]);
    if (want ? glyphs.length !== 1 || glyphs[0].glyph !== want || !placed(glyphs[0].at) : glyphs.length)
      out.push(`read-back: the line between ${a} and ${b} needs ${want ? `one ${want} on it` : 'no symbol'}`);
  }
  for (const g of routes.glyphs)
    if (!model.partnerships.some((p) => sameSet(g.people, [p.a, p.b]))) out.push(`read-back: ${g.glyph} at ${fmt(g.at)} joins no partners`);

  // The graph without partnership lines: vertices at every end, edges between consecutive vertices.
  const partnerSegs = new Set([...runOf.values()].flatMap((r) => r.segs));
  const vertices = [...new Map(segs.flatMap((s) => [s.a, s.b]).map((p) => [key(p), p])).values()];
  const parent = new Map(vertices.map((p) => [key(p), key(p)]));
  const find = (k: string): string => (parent.get(k) === k ? k : find(parent.get(k)!));
  for (const s of segs)
    if (!partnerSegs.has(s)) {
      const pts = vertices.filter((p) => on(p, s));
      for (const p of pts) parent.set(find(key(p)), find(key(s.a)));
    }
  const comp = (p: XY) => (parent.has(key(p)) ? find(key(p)) : undefined);
  const placedIds = [...at.keys()];
  const hangs = (id: string) => segs.some((s) => isEnd(top(id), s));

  const readParents = new Map<string, string[]>();
  for (const u of model.unions) {
    if (![...u.parents, ...u.children].every((id) => at.has(id))) continue;
    const stubbed = u.children.filter((c) => routes.stubs.some((s) => s.child === c && sameSet(s.parents, u.parents)));
    if (stubbed.length === u.children.length) {
      for (const c of u.children) if (hangs(c)) out.push(`read-back: stubbed child ${c} still has a line`);
      continue;
    }
    if (stubbed.length) {
      out.push(`read-back: union ${u.id} is only partly stubbed`);
      continue;
    }
    const missing = u.children.filter((c) => !hangs(c));
    for (const c of missing) out.push(`read-back: no line to child ${c} of ${u.id}`);
    if (missing.length) continue;
    const roots = new Set(u.children.map((c) => comp(top(c))));
    if (roots.size > 1) {
      out.push(`read-back: the children of ${u.id} are not joined`);
      continue;
    }
    const root = [...roots][0];
    const below = placedIds.filter((id) => comp(top(id)) === root);
    const above = placedIds.filter((id) => comp(bottom(id)) === root);
    for (const id of below.filter((id) => !u.children.includes(id))) out.push(`read-back: the line of ${u.id} also reaches child ${id}`);
    // The parents the drawing shows: a stem leaving a partnership line inside reads as that pair;
    // a drop reads as its person, except that the end of a line with people between, on that
    // person's deepest track, reads as the pair as well (the outer partner's anchor), as does the ex-partner's drop of a separated or divorced pair.
    const read = new Set(above);
    const inner = [...runOf].filter(([, r]) =>
      vertices.some((p) => find(key(p)) === root && Math.abs(p[1] - r.y) < EPS && strictly(p[0], [r.x0, r.x1])),
    );
    for (const [k] of inner) for (const id of k.split('\n')) read.add(id);
    if (inner.length > 1) out.push(`read-back: ${u.id} hangs from ${inner.length} lines`);
    let anchor: [string, string] | undefined;
    for (const o of above) {
      const own = [...runOf].filter(([k]) => k.split('\n').includes(o)).sort(([, p], [, q]) => p.y - q.y);
      if (!own.length) continue;
      const [k, r] = own[0];
      const rowY = at.get(o)![1];
      const pair = k.split('\n');
      const former =
        model.partnerships.some((q) => sameSet([q.a, q.b], pair) && (q.status === 'separated' || q.status === 'divorced')) &&
        model.unions.some((v) => sameSet(v.parents, pair));
      if (!former && !placedIds.some((id) => Math.abs(at.get(id)![1] - rowY) < EPS && strictly(at.get(id)![0], [r.x0, r.x1]))) continue;
      const other = k.split('\n').find((id) => id !== o)!;
      anchor = [o, other];
      read.add(other);
    }
    if (anchor && sameSet(u.parents, [anchor[0]]))
      out.push(`ambiguous: the line of ${u.id} below ${anchor[0]} reads as ${anchor[0]} and ${anchor[1]} as well`);
    else if (!sameSet([...read], u.parents)) out.push(`read-back: the line of ${u.id} reads as parents ${[...read].join(', ') || 'none'}`);
    const style = u.dotted ? 'dotted' : 'solid';
    if (segs.some((s) => u.children.some((c) => isEnd(top(c), s)) && s.style !== style)) out.push(`read-back: the children of ${u.id} should hang ${style}`);
    for (const c of u.children) readParents.set(c, [...read]);
  }

  for (const h of model.hidden.filter((h) => h.reason === 'stub')) {
    if (!routes.stubs.some((s) => s.child === h.child && s.parents.includes(h.parent))) out.push(`read-back: no stub for parent ${h.parent} of ${h.child}`);
    if (readParents.get(h.child)?.includes(h.parent)) out.push(`read-back: a line joins ${h.child} to stubbed parent ${h.parent}`);
  }
  for (const s of routes.stubs) {
    const known =
      model.hidden.some((h) => h.reason === 'stub' && h.child === s.child && sameSet(s.parents, [h.parent])) ||
      model.unions.some((u) => u.children.includes(s.child) && sameSet(s.parents, u.parents));
    if (!known) out.push(`read-back: the stub above ${s.child} stands for no hidden link`);
  }
  return out;
}
