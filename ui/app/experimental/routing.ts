// Routes the experimental view's relation lines like a circuit diagram: right angles only, every
// horizontal line on its own track in the channel between two rows, T-junctions with dots, and no
// crossings. A union whose stem cannot avoid a partnership line crosses it on a bridge (a hop on the
// partnership line); one that cannot be reached otherwise becomes a stub. `verify.ts` proves the
// result and `route.check.mjs` tests both. Pure, positions in, segments out. Not named
// `route.ts`: Next.js would take that for a route handler of `/experimental`.
import type { Model, Status, Union } from './model.ts';
import { ROW_GAP } from '../simpleLayout.ts';

export type XY = [number, number];
// A parent and a child, or two partners.
export type Link = [string, string];
// links: the pairs whose drawn connection runs along this piece (for focus).
export type Segment = { a: XY; b: XY; style: 'solid' | 'dashed' | 'dotted'; links: Link[] };
export type Glyph = { at: XY; glyph: '⚭' | '⚯' | '⚮'; people: [string, string] };
export type Stub = { child: string; parents: string[]; at: XY };
// bridges: where a union's vertical crosses a partnership line, which hops over it.
export type Routes = { segments: Segment[]; junctions: XY[]; glyphs: Glyph[]; stubs: Stub[]; bridges: XY[] };
// Person pill size as rendered (42 x ~132 CSS px, see `.simple-name`). Partner lines start NAME_CLEAR below a name; sibling bars stay BAR_CLEAR
// above the children's names, so every child hangs on a visible riser.
export const NAME_W = 8.5, NAME_H = 2.7, NAME_CLEAR = 1.8, BAR_CLEAR = 2.1, TRACK = 0.6, MIN_TRACK = 0.3;
// A bridge keeps this far from a partnership symbol on its line.
const GLYPH_CLEAR = 1.2;

const EPS = 1e-6;
const near = (p: number, q: number) => Math.abs(p - q) < EPS;
const inside = (v: number, lo: number, hi: number) => v > lo + EPS && v < hi - EPS;
const within = (v: number, lo: number, hi: number) => v > lo - EPS && v < hi + EPS;
const pairKey = (x: string, y: string) => (x < y ? `${x}\n${y}` : `${y}\n${x}`);
const rowKey = (y: number) => Math.round(y * 1000);
const GLYPH: Partial<Record<NonNullable<Status>, Glyph['glyph']>> = { married: '⚭', widowed: '⚭', together: '⚯', divorced: '⚮' };
const lineStyle = (status: Status) => (status === 'separated' || status === 'divorced' ? 'dashed' : 'solid');

// A partnership line between partners a (left) and b in one row; `track` counts from the channel top.
type Line = { a: string; b: string; status: Status; x0: number; x1: number; y: number; track: number; Y: number };
// A drawn union: its node at nx (below `anchor`, or the middle of `line`) and its sibling bars.
// `through`: a child right below the node, so one vertical runs from the node to that child; children
// on both sides of it then hang from two half bars on different tracks, since one bar would make a
// four-way point. Otherwise a stem runs from the node down to a single bar.
type Plan = { u: Union; y: number; nx: number; anchor?: string; line?: Line; kids: string[]; through: boolean; bars: Bar[] };
// A sibling bar over [x0, x1] with the children rising from it, on `track` counted from the channel bottom.
type Bar = { plan: Plan; x0: number; x1: number; kids: string[]; track: number; Y: number };
type Owned = Segment & { owner?: Union };
// An ordering of two tracks; dropping it would let `stem`, the union's vertical, cross on a bridge.
type Edge<T> = { from: T; to: T; us: Union[]; stem?: Union };
// Why a round failed: the unions to stub one of, or ({ bridge }) the unions to let cross on a bridge.
type Blame = Union[] | { bridge: Union[] };

export function route(model: Model, at: Map<string, XY>): Routes {
  const childOf = new Set(model.unions.flatMap((u) => u.children));
  const root = (u: Union) => u.parents.every((p) => !childOf.has(p));
  // In-law (root) families first, then the union with fewer children.
  const prefer = (us: Union[]) =>
    [...us].sort((p, q) => Number(root(q)) - Number(root(p)) || p.children.length - q.children.length || p.id.localeCompare(q.id))[0];
  // Each round bridges or stubs one more union, so this ends.
  const stubbed = new Set<string>();
  const bridged = new Set<string>();
  for (;;) {
    const result = attempt(model, at, stubbed, bridged);
    if (Array.isArray(result)) stubbed.add(prefer(result).id);
    else if ('bridge' in result) bridged.add(prefer(result.bridge).id);
    else return result;
  }
}

// Places items (lines or bars) on tracks: `to` of each edge lies beyond `from`, and items whose
// closed x ranges overlap never share a track. Lowest free track, left edge first. Returns the
// edges that form a cycle instead; a cycle of drops alone is broken and left to `verify`.
function layer<T extends { x0: number; x1: number; track: number }>(items: T[], edges: Edge<T>[]) {
  const preds = new Map(items.map((i) => [i, edges.filter((e) => e.to === i && e.from !== i).map((e) => e.from)]));
  const done = new Set<T>();
  const todo = [...items].sort((p, q) => p.x0 - q.x0 || p.x1 - q.x1);
  const reaches = (from: T, target: T) => {
    const seen = new Set([from]);
    for (const queue = [from]; queue.length; ) {
      const at = queue.pop();
      for (const e of edges.filter((e) => e.from === at))
        if (!done.has(e.to) && !seen.has(e.to)) {
          if (e.to === target) return true;
          seen.add(e.to);
          queue.push(e.to);
        }
    }
    return false;
  };
  while (done.size < items.length) {
    let next = todo.find((i) => !done.has(i) && preds.get(i)!.every((p) => done.has(p)));
    if (!next) {
      const cycle = edges.filter((e) => e.us.length && !done.has(e.from) && !done.has(e.to) && reaches(e.to, e.from));
      if (cycle.length) return cycle;
      next = todo.find((i) => !done.has(i))!;
    }
    const item = next;
    let track = Math.max(-1, ...preds.get(item)!.filter((p) => done.has(p)).map((p) => p.track)) + 1;
    while ([...done].some((o) => o.track === track && o.x0 <= item.x1 + EPS && item.x0 <= o.x1 + EPS)) track++;
    item.track = track;
    done.add(item);
  }
  return undefined;
}

// Where two axis-aligned segments meet: nothing, one point, or a stretch they share.
function meet(s: Segment, t: Segment): XY | 'overlap' | null {
  const x0 = Math.max(Math.min(s.a[0], s.b[0]), Math.min(t.a[0], t.b[0]));
  const x1 = Math.min(Math.max(s.a[0], s.b[0]), Math.max(t.a[0], t.b[0]));
  const y0 = Math.max(Math.min(s.a[1], s.b[1]), Math.min(t.a[1], t.b[1]));
  const y1 = Math.min(Math.max(s.a[1], s.b[1]), Math.max(t.a[1], t.b[1]));
  if (x0 > x1 + EPS || y0 > y1 + EPS) return null;
  return x1 - x0 > EPS || y1 - y0 > EPS ? 'overlap' : [x0, y0];
}

// One routing round with the given unions stubbed or bridged: the routes, or what to change.
function attempt(model: Model, at: Map<string, XY>, stubbed: Set<string>, bridged: Set<string>): Routes | Blame {
  const x = (id: string) => at.get(id)![0];
  const y = (id: string) => at.get(id)![1];
  const rows = new Map<number, string[]>();
  for (const [id, [, py]] of at) rows.set(rowKey(py), [...(rows.get(rowKey(py)) ?? []), id]);
  for (const ids of rows.values()) ids.sort((p, q) => x(p) - x(q));
  const between = (p: string, q: string) =>
    rows.get(rowKey(y(p)))!.filter((id) => inside(x(id), Math.min(x(p), x(q)), Math.max(x(p), x(q))));

  const lines = new Map<string, Line>();
  // The unions of a pair of partners (at most one, by id).
  const unionsOf = (a: string, b: string) => model.unions.filter((u) => u.parents.length === 2 && u.parents.includes(a) && u.parents.includes(b));
  for (const { a, b, status } of model.partnerships)
    // A line that exists only for co-parents goes with its union when that is stubbed.
    if (status === null && unionsOf(a, b).every((u) => stubbed.has(u.id))) continue;
    else if (at.has(a) && at.has(b) && near(y(a), y(b)) && !near(x(a), x(b))) {
      const [l, r] = x(a) < x(b) ? [a, b] : [b, a];
      lines.set(pairKey(a, b), { a: l, b: r, status, x0: x(l), x1: x(r), y: y(a), track: 0, Y: 0 });
    }
  const linesOf = (id: string) => [...lines.values()].filter((l) => l.a === id || l.b === id);
  const partners = (id: string) => model.partnerships.filter((p) => p.a === id || p.b === id).length;
  // The outer partner of a line with people between: fewer partners, then farther from the rest of
  // the partner group in the row, then the left one.
  const outer = (l: Line) => {
    const group = new Set([l.a]);
    for (const queue = [l.a]; queue.length; )
      for (const m of linesOf(queue.pop()!))
        for (const id of [m.a, m.b])
          if (!group.has(id)) {
            group.add(id);
            queue.push(id);
          }
    const others = [...group].filter((id) => id !== l.a && id !== l.b);
    const gap = (id: string) => Math.min(...others.map((o) => Math.abs(x(o) - x(id))));
    return partners(l.b) < partners(l.a) || (partners(l.b) === partners(l.a) && gap(l.b) > gap(l.a)) ? l.b : l.a;
  };

  const plans: Plan[] = [];
  const stubs: Union[] = [];
  for (const u of model.unions) {
    const py = at.has(u.parents[0]) ? y(u.parents[0]) : NaN;
    const line = u.parents.length === 2 ? lines.get(pairKey(u.parents[0], u.parents[1])) : undefined;
    // Drawable: one or two parents in one row (two joined by their line), children all one row below.
    const drawable =
      !stubbed.has(u.id) &&
      [...u.parents, ...u.children].every((id) => at.has(id)) &&
      (u.parents.length === 1 || (u.parents.length === 2 && line)) &&
      u.parents.every((id) => near(y(id), py)) &&
      u.children.every((id) => near(y(id), py - ROW_GAP));
    if (!drawable) {
      stubs.push(u);
      continue;
    }
    const adjacent = line && between(line.a, line.b).length === 0;
    // Children of separated or divorced partners hang straight below the ex-partner, even side by side.
    const former = line && (line.status === 'separated' || line.status === 'divorced');
    const anchor = !line ? u.parents[0] : adjacent && !former ? undefined : outer(line);
    const nx = anchor ? x(anchor) : (line!.x0 + line!.x1) / 2;
    const kids = [...u.children].sort((p, q) => x(p) - x(q));
    const left = kids.filter((k) => x(k) < nx - EPS);
    const right = kids.filter((k) => x(k) > nx + EPS);
    const below = kids.some((k) => near(x(k), nx));
    const plan: Plan = { u, y: py, nx, anchor, line, kids, through: below && kids.length === 1, bars: [] };
    const bar = (ids: string[]) => {
      const xs = [nx, ...ids.map(x)];
      plan.bars.push({ plan, x0: Math.min(...xs), x1: Math.max(...xs), kids: ids, track: 0, Y: 0 });
    };
    if (!plan.through) bar(kids);
    plans.push(plan);
  }
  // One stem per person; a single parent's union gives way first.
  for (const p of plans) {
    const same = plans.filter((q) => p.anchor && q.anchor === p.anchor);
    const single = same.filter((q) => !q.line);
    if (same.length > 1) return (single.length ? single : same).map((q) => q.u);
  }

  const H = ROW_GAP - NAME_CLEAR - BAR_CLEAR;
  for (const [rk, ids] of rows) {
    const rowY = y(ids[0]);
    const rowLines = [...lines.values()].filter((l) => rowKey(l.y) === rk);
    const rowPlans = plans.filter((p) => rowKey(p.y) === rk);

    // Partner tracks. A line passing over a person runs below that person's drop; over a stem it
    // crosses on a bridge. It runs above a stem leaving a line in the middle unless that stem may
    // bridge it, and an anchor's own union line is its deepest.
    const stems = new Map(rowPlans.filter((p) => p.anchor).map((p) => [p.anchor!, p]));
    const order: Edge<Line>[] = [];
    for (const h of rowLines)
      for (const id of ids.filter((id) => inside(x(id), h.x0, h.x1))) {
        const stem = stems.get(id)?.u;
        if (stem && !bridged.has(stem.id)) return { bridge: [stem] };
        // A cycle of these can only be broken by dropping a union of one of the lines.
        for (const l of linesOf(id)) order.push({ from: l, to: h, us: [...unionsOf(l.a, l.b), ...unionsOf(h.a, h.b)].filter((u) => !stubbed.has(u.id)) });
      }
    for (const p of rowPlans) {
      if (p.line && !p.anchor && !bridged.has(p.u.id))
        for (const h of rowLines) if (h !== p.line && inside(p.nx, h.x0, h.x1)) order.push({ from: h, to: p.line, us: [p.u], stem: p.u });
      if (p.line && p.anchor) for (const l of linesOf(p.anchor)) if (l !== p.line) order.push({ from: l, to: p.line, us: [p.u] });
    }
    const lineCycle = layer(rowLines, order);
    if (lineCycle) {
      const stems = lineCycle.flatMap((e) => (e.stem ? [e.stem] : []));
      return stems.length ? { bridge: stems } : lineCycle.flatMap((e) => e.us);
    }

    // Bar tracks. A bar over another union's stem runs below that union's bar, over its riser above
    // it; over a vertical running from node to child it cannot.
    const bars = rowPlans.flatMap((p) => p.bars);
    const stack: Edge<Bar>[] = [];
    for (const u of rowPlans)
      for (const b of bars.filter((b) => b.plan !== u)) {
        const us = [u.u, b.plan.u];
        if (within(u.nx, b.x0, b.x1)) {
          if (u.through) return us;
          stack.push({ from: b, to: u.bars[0], us });
        }
        for (const c of u.bars) if (c.kids.some((k) => within(x(k), b.x0, b.x1))) stack.push({ from: c, to: b, us });
      }
    const barCycle = layer(bars, stack);
    if (barCycle) return barCycle.flatMap((e) => e.us);

    // Spacing: TRACK, compressed evenly down to MIN_TRACK; beyond that a bar gives way to a stub.
    const P = Math.max(0, ...rowLines.map((l) => l.track + 1));
    const B = Math.max(0, ...bars.map((b) => b.track + 1));
    let gap = P + B > 1 ? Math.min(TRACK, H / (P + B - 1)) : TRACK;
    // If the partner tracks alone overflow, they spill out of the channel and `verify` reports it.
    if (gap < MIN_TRACK - EPS) {
      if (bars.length && (P - 1) * MIN_TRACK <= H + EPS) return bars.map((b) => b.plan.u);
      gap = MIN_TRACK;
    }
    for (const l of rowLines) l.Y = rowY - NAME_CLEAR - l.track * gap;
    for (const b of bars) b.Y = rowY - ROW_GAP + BAR_CLEAR + b.track * gap;
  }

  // A single parent's stem below the end of a line with people between (or of a former couple's line
  // with children), on that parent's deepest track, would read as the anchor of that couple: it
  // becomes a stub instead.
  for (const p of plans.filter((p) => !p.line && linesOf(p.anchor!).length)) {
    const deepest = linesOf(p.anchor!).sort((l, m) => l.Y - m.Y)[0];
    // Side by side as former partners, the end of the line is where their own children hang.
    const former = (deepest.status === 'separated' || deepest.status === 'divorced') && plans.some((q) => q.line === deepest);
    if (between(deepest.a, deepest.b).length || former) return [p.u];
  }

  const planOf = new Map(plans.filter((p) => p.line).map((p) => [pairKey(p.line!.a, p.line!.b), p]));
  const kidsOf = (l: Line) => planOf.get(pairKey(l.a, l.b))?.kids ?? [];
  const segments: Owned[] = [];
  const glyphs: Glyph[] = [];
  // Drops: each person with partners runs down to their deepest line, split where a line joins. A
  // single parent's stem leaves below the deepest line, so every piece also leads to those children.
  for (const id of at.keys()) {
    const own = linesOf(id).sort((p, q) => q.Y - p.Y);
    const alone = plans.filter((p) => !p.line && p.anchor === id).flatMap((p) => p.kids);
    own.forEach((l, i) => {
      const served = own.slice(i);
      segments.push({
        a: [x(id), i ? own[i - 1].Y : y(id) - NAME_H / 2],
        b: [x(id), l.Y],
        style: served.some((s) => lineStyle(s.status) === 'solid') ? 'solid' : 'dashed',
        links: [...served.flatMap((s): Link[] => [[s.a, s.b], ...kidsOf(s).map((k): Link => [id, k])]), ...alone.map((k): Link => [id, k])],
      });
    });
  }
  for (const l of lines.values()) {
    // Split at the node of the couple's children: each half leads from its partner to them.
    const nx = planOf.get(pairKey(l.a, l.b))?.nx;
    const halves: [number, number, string][] = nx === undefined ? [[l.x0, l.x1, '']] : [[l.x0, nx, l.a], [nx, l.x1, l.b]];
    for (const [x0, x1, from] of halves)
      if (x1 - x0 > EPS)
        segments.push({ a: [x0, l.Y], b: [x1, l.Y], style: lineStyle(l.status), links: [[l.a, l.b], ...(from ? kidsOf(l).map((k): Link => [from, k]) : [])] });
    const glyph = l.status && GLYPH[l.status];
    if (!glyph) continue;
    // In the middle between adjacent partners, else in the gap next to the outer partner.
    const inner = between(l.a, l.b);
    const o = inner.length ? outer(l) : l.a;
    const next = inner.length ? (o === l.a ? inner[0] : inner[inner.length - 1]) : l.b;
    glyphs.push({ at: [(x(o) + x(next)) / 2, l.Y], glyph, people: [l.a, l.b] });
  }
  // Unions: a stem from the node down to the bar, the children rising from it to their names.
  const nodes = new Map<Union, XY>();
  for (const p of plans) {
    const style = p.u.dotted ? 'dotted' : 'solid';
    const to = (kids: string[]) => p.u.parents.flatMap((parent) => kids.map((k): Link => [parent, k]));
    const deepest = p.anchor && Math.min(...linesOf(p.anchor).map((l) => l.Y));
    const nodeY = p.line ? p.line.Y : linesOf(p.anchor!).length ? (deepest as number) : p.y - NAME_H / 2;
    const top = (id: string) => y(id) + NAME_H / 2;
    nodes.set(p.u, [p.nx, nodeY]);
    const center = p.through ? p.kids.find((k) => near(x(k), p.nx))! : undefined;
    if (center) segments.push({ a: [p.nx, nodeY], b: [p.nx, top(center)], style, links: to(p.kids), owner: p.u });
    else segments.push({ a: [p.nx, nodeY], b: [p.nx, p.bars[0].Y], style, links: to(p.kids), owner: p.u });
    for (const b of p.bars) {
      // Split at the stem and at every riser: a piece leads to the children beyond it, seen from the stem.
      const cuts = [...new Set([b.x0, p.nx, ...b.kids.map(x), b.x1])].sort((m, n) => m - n);
      for (const [i, x0] of cuts.slice(0, -1).entries()) {
        const x1 = cuts[i + 1];
        const beyond = b.kids.filter((k) => (x0 < p.nx - EPS ? x(k) < x1 - EPS : x(k) > x0 + EPS));
        if (x1 - x0 > EPS) segments.push({ a: [x0, b.Y], b: [x1, b.Y], style, links: to(beyond), owner: p.u });
      }
      for (const k of b.kids) segments.push({ a: [x(k), b.Y], b: [x(k), top(k)], style, links: to([k]), owner: p.u });
    }
  }
  // Backstop: a union's lines touch nothing but their own node, except where a bridged union's
  // vertical crosses a partnership line away from its symbol; otherwise that union gives way.
  const bridges: XY[] = [];
  const upright = (s: Segment) => near(s.a[0], s.b[0]);
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++) {
      const [s, t] = [segments[i], segments[j]];
      if (s.owner === t.owner) continue;
      const m = meet(s, t);
      if (!m) continue;
      const node = nodes.get((s.owner ?? t.owner)!)!;
      if ((!s.owner || !t.owner) && m !== 'overlap' && near(m[0], node[0]) && near(m[1], node[1])) continue;
      const [v, h] = upright(s) ? [s, t] : [t, s];
      const crosses =
        m !== 'overlap' &&
        upright(v) &&
        !upright(h) &&
        !h.owner &&
        inside(m[0], Math.min(h.a[0], h.b[0]), Math.max(h.a[0], h.b[0])) &&
        inside(m[1], Math.min(v.a[1], v.b[1]), Math.max(v.a[1], v.b[1]));
      if (crosses && v.owner && bridged.has(v.owner.id) && !glyphs.some((g) => near(g.at[1], m[1]) && Math.abs(g.at[0] - m[0]) < GLYPH_CLEAR)) {
        bridges.push(m);
        continue;
      }
      return [s.owner, t.owner].filter((u) => u !== undefined);
    }

  // A dot wherever three segments meet: ends count once, a segment passing through twice.
  const points = new Map(segments.flatMap((s) => [s.a, s.b]).map((p) => [`${rowKey(p[0])},${rowKey(p[1])}`, p]));
  // Four meet only where a union's stem and the line to its child below the node cross the bar: one dot.
  const junctions = [...points.values()].filter(
    (p) =>
      segments.reduce((n, s) => {
        if ((near(s.a[0], p[0]) && near(s.a[1], p[1])) || (near(s.b[0], p[0]) && near(s.b[1], p[1]))) return n + 1;
        const on = within(p[0], Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0])) && within(p[1], Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1]));
        return n + (on ? 2 : 0);
      }, 0) >= 3,
  );

  // Stubs just above each child, stacked when a child has several.
  const stubList: Stub[] = [];
  const addStub = (child: string, parents: string[]) => {
    if (!at.has(child)) return;
    const above = stubList.filter((s) => s.child === child).length;
    stubList.push({ child, parents, at: [x(child), y(child) + NAME_H / 2 + 0.5 + above * 0.6] });
  };
  for (const u of stubs) for (const c of u.children) addStub(c, u.parents);
  for (const h of model.hidden) if (h.reason === 'stub') addStub(h.child, [h.parent]);

  return { segments: segments.map(({ a, b, style, links }) => ({ a, b, style, links })), junctions, glyphs, stubs: stubList, bridges };
}
