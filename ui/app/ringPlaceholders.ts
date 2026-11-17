import { CanvasTexture, SRGBColorSpace } from 'three';
import { seededRandom } from './random';

// Placeholder silhouettes for the forest ring, drawn in code until the baked atlas exists (spec, "Billboards to bake"):
// three trees side by side, each cell 1 : 2, the foot at the bottom edge and the trunk at the cell's centre.
export const PLACEHOLDER_CELLS = 3;
const CELL_W = 256;
const CELL_H = 512;

const CROWN = ['#26331f', '#2e3b25', '#34432b'];
const BARK = '#3a2f26';

type Draw = (g: CanvasRenderingContext2D, rand: () => number) => void;

// A jagged conifer: a bare trunk up to `from` of the height, then tufts narrowing to the tip.
const conifer =
  (from: number, width: number): Draw =>
  (g, rand) => {
    g.fillStyle = BARK;
    g.fillRect(CELL_W / 2 - CELL_W * 0.025, CELL_H * 0.25, CELL_W * 0.05, CELL_H * 0.75);
    const top = CELL_H * 0.02;
    const bottom = CELL_H * (1 - from);
    for (let i = 0; i < 70; i++) {
      const t = rand();
      const y = top + t * (bottom - top);
      const half = CELL_W * width * 0.5 * (0.15 + 0.85 * t) * (0.6 + 0.4 * rand());
      g.fillStyle = CROWN[Math.floor(rand() * CROWN.length)];
      g.beginPath();
      g.ellipse(CELL_W / 2 + (rand() - 0.5) * half, y, half * (0.5 + 0.5 * rand()), CELL_H * 0.03 * (0.6 + rand()), 0, 0, Math.PI * 2);
      g.fill();
    }
  };

// Tall slim conifers, crown from about half height (chosen 2026-11-17, image A).
const SILHOUETTES: Draw[] = [conifer(0.45, 0.42), conifer(0.5, 0.36), conifer(0.4, 0.48)];

export function placeholderAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * PLACEHOLDER_CELLS;
  canvas.height = CELL_H;
  const g = canvas.getContext('2d')!;
  const rand = seededRandom(11);
  SILHOUETTES.forEach((draw, i) => {
    g.save();
    g.beginPath();
    g.rect(i * CELL_W, 0, CELL_W, CELL_H);
    g.clip();
    g.translate(i * CELL_W, 0);
    draw(g, rand);
    g.restore();
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
