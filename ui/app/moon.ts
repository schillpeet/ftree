import { CanvasTexture, SRGBColorSpace } from 'three';
import { makeNoise, seededRandom } from './random';

const SIZE = 512;
// The near side's maria as seen from the northern hemisphere, north up: centre x, y and radius,
// on a disc of radius 1.
const MARIA: [number, number, number][] = [
  [-0.55, -0.05, 0.36], // Oceanus Procellarum
  [-0.6, -0.35, 0.22], // Oceanus Procellarum, north
  [-0.45, 0.2, 0.22], // Oceanus Procellarum, south
  [-0.25, -0.4, 0.28], // Imbrium
  [0.18, -0.38, 0.16], // Serenitatis
  [0.33, -0.08, 0.19], // Tranquillitatis
  [0.68, -0.3, 0.11], // Crisium
  [0.58, 0.15, 0.14], // Fecunditatis
  [0.38, 0.32, 0.09], // Nectaris
  [-0.2, 0.36, 0.16], // Nubium
  [-0.5, 0.36, 0.09], // Humorum
  [0, -0.18, 0.08], // Vaporum
  [-0.25, -0.7, 0.1], // Frigoris, west
  [0.1, -0.7, 0.09], // Frigoris, east
];
// Young bright craters with rays: x, y, radius, ray count.
const RAY_CRATERS: [number, number, number, number][] = [
  [-0.12, 0.66, 0.035, 18], // Tycho
  [-0.3, -0.12, 0.03, 10], // Copernicus
  [-0.52, -0.08, 0.018, 7], // Kepler
  [-0.68, -0.26, 0.014, 5], // Aristarchus
];

// Full moon face painted on a canvas: dark maria on bright highlands, scattered craters, ray
// craters, a fine speckle, and a little limb darkening. Transparent outside the disc.
export function moonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(11);
  const r = SIZE / 2;
  const blob = (x: number, y: number, radius: number, rgb: string, alpha: number) => {
    const [cx, cy] = [r + x * r, r + y * r];
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * r);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(0.6, `rgba(${rgb},${alpha * 0.8})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - radius * r, cy - radius * r, radius * r * 2, radius * r * 2);
  };

  ctx.beginPath();
  ctx.arc(r, r, r - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#dcd8cc';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Irregular maria: many faint, overlapping blots around each centre build smooth, connected seas.
  for (const [x, y, radius] of MARIA) {
    for (let i = 0; i < 24; i++) {
      blob(x + (rand() - 0.5) * radius * 1.2, y + (rand() - 0.5) * radius * 1.2, radius * (0.5 + rand() * 0.5), '98,96,92', 0.13);
    }
  }
  const inMare = (x: number, y: number) => MARIA.some(([mx, my, mr]) => Math.hypot(x - mx, y - my) < mr);
  // Craters, mostly tiny and fewer on the maria: a faint dark floor and a lighter rim.
  for (let i = 0; i < 1100; i++) {
    const radius = 0.003 + 0.03 * rand() ** 4;
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * (1 - radius);
    const [x, y] = [Math.cos(a) * d, Math.sin(a) * d];
    if (inMare(x, y) && rand() < 0.7) continue;
    blob(x + radius * 0.2, y + radius * 0.2, radius, '90,88,84', 0.18);
    ctx.strokeStyle = `rgba(246,242,232,${0.08 + rand() * 0.18})`;
    ctx.lineWidth = Math.max(0.6, radius * r * 0.2);
    ctx.beginPath();
    ctx.arc(r + x * r, r + y * r, radius * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const [x, y, radius, rays] of RAY_CRATERS) {
    for (let i = 0; i < rays * 2; i++) {
      const a = rand() * Math.PI * 2;
      const length = radius * r * (5 + rand() * 14);
      ctx.strokeStyle = 'rgba(252,250,242,0.1)';
      ctx.lineWidth = 1 + rand() * 2.5;
      ctx.beginPath();
      ctx.moveTo(r + x * r, r + y * r);
      ctx.lineTo(r + x * r + Math.cos(a) * length, r + y * r + Math.sin(a) * length);
      ctx.stroke();
    }
    blob(x, y, radius * 2.5, '255,253,245', 0.5);
    blob(x, y, radius, '255,255,250', 0.9);
  }
  const limb = ctx.createRadialGradient(r, r, r * 0.7, r, r, r);
  limb.addColorStop(0, 'rgba(70,60,50,0)');
  limb.addColorStop(1, 'rgba(70,60,50,0.35)');
  ctx.fillStyle = limb;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Mottled highlands and a fine grain.
  const mottle = makeNoise(12, 5);
  const image = ctx.getImageData(0, 0, SIZE, SIZE);
  for (let i = 0; i < image.data.length; i += 4) {
    const p = i / 4;
    const n = 14 * mottle(((p % SIZE) / SIZE) * 9, (Math.floor(p / SIZE) / SIZE) * 9) + (rand() - 0.5) * 12;
    image.data[i] += n;
    image.data[i + 1] += n;
    image.data[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

// Soft glow around the moon.
export function haloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(220,226,255,0.45)');
  g.addColorStop(0.3, 'rgba(200,210,255,0.15)');
  g.addColorStop(1, 'rgba(200,210,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
