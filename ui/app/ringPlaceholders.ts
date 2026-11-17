import { CanvasTexture, SRGBColorSpace } from 'three';
import { seededRandom } from './random';

// Placeholder silhouettes for the forest ring, drawn in code until the baked atlas exists (spec, "Billboards to bake"):
// three trees side by side, each cell 1 : 2, the foot at the bottom edge and the trunk at the cell's centre.
export const PLACEHOLDER_CELLS = 3;
const CELL_W = 256;
const CELL_H = 512;

const CROWN = ['#26331f', '#2e3b25', '#34432b'];
const BARK = '#4a3d31';
const BARK_DARK = '#2a221c';

type Draw = (g: CanvasRenderingContext2D, rand: () => number) => void;

// A conifer: a trunk that flares at its foot, tapers to the tip and is a little uneven, a few dead branch stubs below
// the crown, and a crown of tufts from `from` of the height up that thins out downward instead of starting at a line.
const conifer =
  (from: number, width: number): Draw =>
  (g, rand) => {
    const cx = CELL_W / 2;
    const lean = (rand() - 0.5) * 0.02;
    const edge: [number, number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const flare = 0.05 * Math.max(0, 1 - t / 0.07) ** 2;
      const half = CELL_W * (0.03 * (1 - t) + 0.004 + flare) * (1 + (rand() - 0.5) * 0.12);
      edge.push([cx + CELL_W * lean * t, CELL_H * (1 - 0.97 * t), half]);
    }
    const bark = g.createLinearGradient(cx - CELL_W * 0.04, 0, cx + CELL_W * 0.04, 0);
    bark.addColorStop(0, BARK_DARK);
    bark.addColorStop(1, BARK);
    g.fillStyle = bark;
    g.beginPath();
    edge.forEach(([x, y, half], i) => (i ? g.lineTo(x - half, y) : g.moveTo(x - half, y)));
    [...edge].reverse().forEach(([x, y, half]) => g.lineTo(x + half, y));
    g.closePath();
    g.fill();
    g.strokeStyle = BARK_DARK;
    g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const y = CELL_H * (1 - from * (0.45 + 0.55 * rand()));
      const side = rand() < 0.5 ? -1 : 1;
      const reach = CELL_W * (0.04 + 0.06 * rand());
      g.lineWidth = 1 + 1.5 * rand();
      g.beginPath();
      g.moveTo(cx, y);
      g.lineTo(cx + side * reach, y + reach * (0.2 + 0.4 * rand()));
      g.stroke();
    }
    const top = CELL_H * 0.02;
    const bottom = CELL_H * (1 - from);
    for (let i = 0; i < 90; i++) {
      // A tenth of the tufts hangs below the crown's start, small and sparse, so its lower edge is ragged.
      const t = rand() * 1.12;
      const y = top + t * (bottom - top);
      const half = CELL_W * width * 0.5 * (0.15 + 0.85 * Math.min(t, 1)) * (0.6 + 0.4 * rand()) * (t > 1 ? 0.5 : 1);
      g.fillStyle = CROWN[Math.floor(rand() * CROWN.length)];
      g.beginPath();
      g.ellipse(cx + CELL_W * lean * (1 - y / CELL_H) + (rand() - 0.5) * half, y, half * (0.5 + 0.5 * rand()), CELL_H * 0.03 * (0.6 + rand()), 0, 0, Math.PI * 2);
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
