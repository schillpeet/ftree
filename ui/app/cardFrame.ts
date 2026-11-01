// Where the camera stands for a selected card: far enough back that the card and the slots around it (parents above,
// child below, partner right, edit pencil left) fill about half of the free view, and shifted sideways so the card sits
// in the middle of the screen part the person panel leaves free. Pure, so `cardFrame.check.mjs` can test it.

export type PanelSide = 'left' | 'right' | null;

type Size = { width: number; height: number };

// World units around the card that the slots take (the slots are drawn at 50 CSS px per world unit).
const SIDE_ROOM = 3;
const VERTICAL_ROOM = 1.6;
// How much of the free view the card with its slots may fill.
const FILL = 0.55;
// The person panel's width plus its 16px margins on both sides, see `.person-panel` in globals.css.
export const PANEL_SPACE = 440 + 32;
// Below this width the panel covers the screen's bottom and nothing is shifted.
export const NARROW = 700;

export function frameCard(card: Size, viewport: Size, fovDegrees: number, panel: PanelSide): { distance: number; offsetX: number } {
  const tan = Math.tan((fovDegrees * Math.PI) / 360);
  const side = viewport.width >= NARROW ? panel : null;
  const freeWidth = viewport.width - (side ? PANEL_SPACE : 0);
  const boxWidth = card.width + 2 * SIDE_ROOM;
  const boxHeight = card.height + 2 * VERTICAL_ROOM;
  const byHeight = boxHeight / FILL / 2 / tan;
  const byWidth = boxWidth / FILL / 2 / (tan * (freeWidth / viewport.height));
  const distance = Math.max(byHeight, byWidth);
  // Screen pixels from the viewport's middle to the free part's middle, turned into world units at the card.
  if (!side) return { distance, offsetX: 0 };
  const shift = side === 'right' ? -PANEL_SPACE / 2 : PANEL_SPACE / 2;
  const visibleWidth = 2 * distance * tan * (viewport.width / viewport.height);
  // The camera moves the other way than the card should appear.
  return { distance, offsetX: -(shift / viewport.width) * visibleWidth };
}
