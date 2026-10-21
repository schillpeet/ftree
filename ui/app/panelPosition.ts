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

