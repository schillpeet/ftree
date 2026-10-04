// Pure tree-growth model types shared by the layout and the renderer.
// The capacity/scale functions (requiredScaleForPeople, crownSpaceForScale) come in a later
// task; this module only declares the numeric shapes they will use.

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
  /** Air gap between two card centres along the arc. */
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