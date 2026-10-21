// Pure, so `panelPosition.check.mjs` can test it; the stored pin lives in PersonPanel.tsx.

// How far the person panel was dragged from its default spot (top centre), in CSS px.
export type Offset = { x: number; y: number };
export const CENTRE: Offset = { x: 0, y: 0 };

// Where the panel sits without an offset, its size, and the viewport.
type Box = { left: number; top: number; width: number };
type Viewport = { width: number; height: number };

// At least this much of the panel stays on screen sideways, and its whole header stays reachable.
export const KEEP_VISIBLE = 80;
export const HEADER_HEIGHT = 52;

// Keeps a dragged panel grabbable: never above the top edge, never below the bottom with its header,
// and never further left or right than KEEP_VISIBLE px of it remaining in view.
export function clampOffset(offset: Offset, box: Box, viewport: Viewport): Offset {
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
  return {
    x: clamp(offset.x, KEEP_VISIBLE - box.width - box.left, viewport.width - KEEP_VISIBLE - box.left),
    y: clamp(offset.y, -box.top, viewport.height - HEADER_HEIGHT - box.top),
  };
}

// Anything but a stored {x, y} counts as not pinned.
export function parsePin(saved: string | null): Offset | null {
  if (!saved) return null;
  try {
    const { x, y } = JSON.parse(saved);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  } catch {
    return null;
  }
}


// Air between a panel and one opened beside it, and the least margin to the screen edge.
export const BESIDE_GAP = 40;
export const EDGE_MARGIN = 16;

// Where a panel of the given width goes next to another: on the side with more room. When that side is
// too narrow, the other panel moves over (by shift, at most to the screen edge, and only if shiftable);
// left is the new panel's left edge, which may still overlap on very narrow screens.
export function placeBeside(anchor: { left: number; width: number }, width: number, viewport: { width: number }, shiftable: boolean) {
  const roomLeft = anchor.left;
  const roomRight = viewport.width - anchor.left - anchor.width;
  const side: 'left' | 'right' = roomRight >= roomLeft ? 'right' : 'left';
  const missing = Math.max(0, width + BESIDE_GAP + EDGE_MARGIN - Math.max(roomLeft, roomRight));
  const movable = shiftable ? Math.max(0, Math.min(roomLeft, roomRight) - EDGE_MARGIN) : 0;
  const shift = (side === 'right' ? -1 : 1) * Math.min(missing, movable);
  const anchorLeft = anchor.left + shift;
  const left =
    side === 'right'
      ? Math.min(anchorLeft + anchor.width + BESIDE_GAP, viewport.width - EDGE_MARGIN - width)
      : Math.max(anchorLeft - BESIDE_GAP - width, EDGE_MARGIN);
  return { side, shift: shift || 0, left };
}
