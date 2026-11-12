// The heights a bottom sheet rests at on phones (`Sheet.tsx`). Pure, so `sheetSnap.check.mjs` can test it without React.

export const SNAPS = ['peek', 'half', 'full'] as const;
export type Snap = (typeof SNAPS)[number];

// Room left above a full sheet, so the page behind still shows where the sheet came from.
export const FULL_GAP = 48;
// A drag shorter than this is a tap on the grip.
export const TAP_SLOP = 6;
// Dragged below this share of the viewport, the sheet closes.
export const CLOSE_BELOW = 0.18;

// The height in pixels a sheet has at `snap` in a viewport `viewport` pixels high; `sheet.css` uses the same values.
export function snapHeight(snap: Snap, viewport: number): number {
  if (snap === 'full') return viewport - FULL_GAP;
  return viewport * (snap === 'half' ? 0.52 : 0.3);
}

// A tap on the grip steps to the next height and from full back to the smallest.
export const nextSnap = (snap: Snap): Snap => SNAPS[(SNAPS.indexOf(snap) + 1) % SNAPS.length];

// Where a sheet goes after its grip was dragged by `moved` pixels (down is positive) from `startHeight`: the nearest height,
// or 'close' when it was pulled far down; a tap steps on like `nextSnap`.
export function snapAfterDrag(current: Snap, startHeight: number, moved: number, viewport: number): Snap | 'close' {
  if (Math.abs(moved) < TAP_SLOP) return nextSnap(current);
  const height = startHeight - moved;
  if (height < viewport * CLOSE_BELOW) return 'close';
  return SNAPS.reduce((best, snap) =>
    Math.abs(snapHeight(snap, viewport) - height) < Math.abs(snapHeight(best, viewport) - height) ? snap : best,
  );
}
