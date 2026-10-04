// Pure tree-growth model shared by the layout and the renderer. The constants describe the
// measured crown of `Tree.tsx` at scale 1 and the footprint of one scroll; `crownSpaceForScale`
// turns them into the slot arc that `familyLayout` fills.

export type TreeBounds = {
  /** Crown top in tree-local units above the trunk base (y = 0) at scale 1. */
  crownTop: number;
  /** Crown radius in tree-local units at scale 1. */
  crownRadius: number;
};

export type CardWorldSize = {
  /** World-space width of a card along the slot arc. */
  width: number;
  /** World-space height of a card along the vertical axis. */
  height: number;
};

export type SlotMargins = {
  /** Clearance from the crown top to the centre of the top card row. */
  top: number;
  /** Minimum height of the bottom row's centre above the ground. */
  bottomCenter: number;
  /** Radial inset from the crown edge to the card arc. */
  side: number;
  /** Vertical air gap between two card rows. */
  rowGap: number;
  /** Air gap between the edges of two neighbouring cards along the arc. */
  slotGap: number;
};

export type LayoutSpace = {
  /** Centre height of the top row. */
  topY: number;
  /** Centre height of the bottom row. */
  bottomY: number;
  /** Radius of the card arc. */
  radius: number;
  /** Arc distance between two card centres. */
  slotArcLength: number;
  /** Upper bound for the vertical distance between rows. */
  maxRowGap: number;
  /** Angle of the first slot. */
  front: number;
};

// Angle of the first slot: the card arc faces the start camera (Scene.tsx CAMERA_START).
export const VIEW_FRONT = Math.atan2(50, 40);

// Measured from `Tree.tsx` buildTree(7) at scale 1: the bounding box of the canopy bark plus
// every leaf instance (crown top ≈ 26.79, crown radius ≈ 25.73). Re-measure when the tree shape
// changes.
export const BASE_TREE_BOUNDS: TreeBounds = {
  crownTop: 26.79,
  crownRadius: 25.73,
};

// Footprint of one scroll in world units. Scroll.tsx renders a 180px-wide `.scroll` inside
// drei's `<Html transform sprite distanceFactor={8}>`, which maps 1 CSS px to distanceFactor/400
// = 0.02 world units: ~3.6 units wide and ~4.8 units tall for a card with photo plus birth/death
// dates. A starting estimate derived from the scroll styles; recalibrate when the card size or
// the Html distanceFactor changes.
export const CARD_WORLD_SIZE: CardWorldSize = {
  width: 3.6,
  height: 4.8,
};

// Air around the cards relative to the crown. Slot/row gaps reproduce today's fixed defaults
// (card 3.6 + 1.4 = 5 arc distance, card 4.8 + 2.2 = 7 row distance), so scaling the crown only
// moves the card arc without changing the rhythm between cards.
export const SLOT_MARGINS: SlotMargins = {
  top: 3.4,
  bottomCenter: 3,
  side: 1.5,
  rowGap: 2.2,
  slotGap: 1.4,
};

// The crown bounds scale with the tree; card size and its air gaps stay fixed. Cards never scale
// with the crown — the crown grows toward (or shrinks onto) the constant-size cards.
export function crownSpaceForScale(
  scale: number,
  bounds: TreeBounds,
  card: CardWorldSize,
  margins: SlotMargins,
): LayoutSpace {
  return {
    topY: scale * bounds.crownTop - margins.top,
    bottomY: margins.bottomCenter,
    radius: scale * bounds.crownRadius - margins.side,
    slotArcLength: card.width + margins.slotGap,
    maxRowGap: card.height + margins.rowGap,
    front: VIEW_FRONT,
  };
}
