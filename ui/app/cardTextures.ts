// Canvas drawings for the 3D cards in HangingCard.tsx: papyrus and wood surfaces plus the member's
// text. Plain canvas code without React, so `cardTextures.check.mjs` can test the text wrapping.

export type CardText = { name: string; birth: string | null; death: string | null; note?: string | null };

// Stable per member, so a card keeps its fibres and grain across renders.
export const seedOf = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483646, 7) + 1;

// Park–Miller generator: cheap and deterministic for a given seed.
function random(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

type Measure = Pick<CanvasRenderingContext2D, 'measureText'>;

// Greedy word wrap; a single word wider than `maxWidth` stays on its own line.
export function wrap(ctx: Measure, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function papyrus(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#c4914f');
  g.addColorStop(0.12, '#e3bf86');
  g.addColorStop(0.5, '#ecd29f');
  g.addColorStop(0.88, '#dfb67b');
  g.addColorStop(1, '#ba8445');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rnd = random(seed);
  // Fibres and speckles.
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '120,80,40' : '255,240,210'},${0.05 + rnd() * 0.08})`;
    ctx.lineWidth = 1 + rnd() * 2;
    const y = rnd() * h;
    ctx.beginPath();
    ctx.moveTo(rnd() * w, y);
    ctx.lineTo(rnd() * w, y + (rnd() - 0.5) * 6);
    ctx.stroke();
  }
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(90,55,20,${rnd() * 0.12})`;
    ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
  // Darker, aged rim.
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(70,40,10,0.35)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

export function wood(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = '#b07a43';
  ctx.fillRect(0, 0, w, h);
  const rnd = random(seed);
  // Wavy grain lines.
  for (let y = 0; y < h; y += 3) {
    const shade = Math.sin(y * 0.07 + Math.sin(y * 0.013) * 4) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(${shade > 0.5 ? '215,165,105' : '110,65,30'},${0.12 + rnd() * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.01 + y * 0.05) * 3);
    ctx.lineTo(w, y + 3);
    ctx.lineTo(0, y + 3);
    ctx.fill();
  }
  // A knot.
  const [kx, ky] = [w * (0.2 + rnd() * 0.6), h * (0.2 + rnd() * 0.6)];
  ctx.strokeStyle = 'rgba(50,28,10,0.25)';
  for (let r = 30; r > 0; r -= 5) {
    ctx.beginPath();
    ctx.ellipse(kx, ky, r * 1.8, r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Photo cropped into an oval with a frame.
function medallion(ctx: CanvasRenderingContext2D, photo: HTMLImageElement, cx: number, cy: number, w: number, h: number, frame: string) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.clip();
  const scale = Math.max(w / photo.width, h / photo.height);
  ctx.drawImage(photo, cx - (photo.width * scale) / 2, cy - (photo.height * scale) / 2, photo.width * scale, photo.height * scale);
  ctx.restore();
  ctx.strokeStyle = frame;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// Lays the scroll's content out from `top` and returns where it ends.
function scrollContent(ctx: CanvasRenderingContext2D, w: number, text: CardText, photo: HTMLImageElement | null, top: number) {
  let y = top;
  if (photo) {
    medallion(ctx, photo, w / 2, y + 90, 150, 180, '#9a6b35');
    y += 200;
  }
  ctx.font = '600 44px Georgia, serif';
  for (const line of wrap(ctx, text.name, w - 70)) ctx.fillText(line, w / 2, (y += 48));
  ctx.font = '30px Georgia, serif';
  if (text.birth) ctx.fillText(`* ${text.birth}`, w / 2, (y += 42));
  if (text.death) ctx.fillText(`† ${text.death}`, w / 2, (y += 38));
  if (text.note) {
    y += 26;
    ctx.strokeStyle = 'rgba(90,50,20,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(w - 60, y);
    ctx.stroke();
    ctx.font = 'italic 28px Georgia, serif';
    for (const line of wrap(ctx, text.note, w - 90).slice(0, 4)) ctx.fillText(line, w / 2, (y += 36));
  }
  return y + 20;
}

export function drawScroll(canvas: HTMLCanvasElement, text: CardText, seed: number, photo: HTMLImageElement | null) {
  const ctx = canvas.getContext('2d')!;
  const [w, h] = [canvas.width, canvas.height];
  ctx.fillStyle = '#3e2810';
  ctx.textAlign = 'center';
  // Measure on a throwaway pass, then draw vertically centred.
  const height = scrollContent(ctx, w, text, photo, 0);
  papyrus(ctx, w, h, seed);
  ctx.fillStyle = '#3e2810';
  scrollContent(ctx, w, text, photo, Math.max(30, (h - height) / 2));
}

export function drawSign(canvas: HTMLCanvasElement, text: CardText, seed: number, photo: HTMLImageElement | null) {
  const ctx = canvas.getContext('2d')!;
  const [w, h] = [canvas.width, canvas.height];
  wood(ctx, w, h, seed);
  // With a photo the text moves into the space right of the medallion.
  const photoWidth = photo ? 150 : 0;
  if (photo) medallion(ctx, photo, 30 + photoWidth / 2, h / 2, photoWidth, 190, '#4a2a10');
  const left = photo ? 30 + photoWidth + 20 : 30;
  const cx = (left + w - 30) / 2;
  ctx.textAlign = 'center';
  // Burnt-in letters: a dark scorch halo under near-black text.
  const burn = (line: string, y: number) => {
    ctx.shadowColor = 'rgba(30,12,2,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#24130a';
    ctx.fillText(line, cx, y);
    ctx.shadowBlur = 0;
  };
  ctx.font = '600 48px Georgia, serif';
  const names = wrap(ctx, text.name, w - 30 - left).slice(0, 2);
  const dates = [text.birth && `* ${text.birth}`, text.death && `† ${text.death}`].filter((d): d is string => !!d);
  let y = h / 2 - (names.length * 54 + dates.length * 40) / 2 + 40;
  for (const line of names) {
    burn(line, y);
    y += 54;
  }
  ctx.font = '32px Georgia, serif';
  for (const line of dates) {
    burn(line, y);
    y += 40;
  }
  // Bevelled edge.
  ctx.strokeStyle = 'rgba(40,20,5,0.6)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, w - 10, h - 10);
}
