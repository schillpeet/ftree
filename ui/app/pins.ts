// Pins are the points on the tree's branches that member cards hang from. Everything here is
// pure, so `pins.check.mjs` can test the spacing and drop rules without a scene.

export type Point = [number, number, number];

// Footprint of one scroll in world units. Scroll.tsx renders a 180px-wide `.scroll` inside drei's
// `<Html transform sprite distanceFactor={8}>`, which maps 1 CSS px to 0.02 world units: ~3.6 wide
// and ~4.8 tall for a card with photo and dates. Recalibrate when the card or distanceFactor changes.
export const CARD = { width: 3.6, height: 4.8 };
// Air between the cards of neighbouring pins: 16 CSS px.
export const CARD_GAP = 16 * 0.02;
// The card's top edge touches the bottom of its pin. A card never covers the pin below it as long
// as 2 * PIN_RADIUS < CARD_GAP.
export const PIN_RADIUS = 0.15;

// Cards on two pins never overlap: the pins are either a card width apart horizontally or a
// card height apart vertically, each plus the gap.
export const clear = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[2] - b[2]) >= CARD.width + CARD_GAP || Math.abs(a[1] - b[1]) >= CARD.height + CARD_GAP;

// Greedy, top-down: a candidate becomes a pin if it keeps its distance to every pin above it.
// The index in the result is the pin id stored per member.
// ponytail: ids are list indices, so changing the tree or this rule moves where pinned cards hang;
// give pins stable ids if the tree ever becomes editable.
export function pickPins(candidates: Point[]) {
  const sorted = [...candidates].sort((a, b) => b[1] - a[1] || a[0] - b[0] || a[2] - b[2]);
  const pins: Point[] = [];
  for (const c of sorted) if (pins.every((p) => clear(p, c))) pins.push(c);
  return pins;
}

// Cards are anchored at the middle of their top edge (see `.scroll` in globals.css), so whatever
// their height they hang right below the pin.
export const cardTop = ([x, y, z]: Point): Point => [x, y - PIN_RADIUS, z];

export type Rect = { left: number; top: number; right: number; bottom: number };
// `r` is the pin's radius on screen.
export type ScreenPin = { id: number; x: number; y: number; r: number };
export type Drop = { pin: number } | 'free' | 'reject';

// What releasing a card over the screen rectangle `card` does. A pin is touched when its disc
// overlaps the rectangle. The card docks to the nearest touched free pin (measured from the middle
// of its top edge, where the pin would be), bounces back if it only touches occupied pins, and
// otherwise stays where it was dropped.
export function dropTarget(card: Rect, pins: ScreenPin[], occupied: Set<number>): Drop {
  const touched = pins.filter(
    (p) => p.x >= card.left - p.r && p.x <= card.right + p.r && p.y >= card.top - p.r && p.y <= card.bottom + p.r,
  );
  const free = touched.filter((p) => !occupied.has(p.id));
  if (!free.length) return touched.length ? 'reject' : 'free';
  const distance = (p: ScreenPin) => Math.hypot(p.x - (card.left + card.right) / 2, p.y - card.top);
  return { pin: free.reduce((best, p) => (distance(p) < distance(best) ? p : best)).id };
}
