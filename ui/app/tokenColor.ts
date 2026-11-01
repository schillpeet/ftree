import { useSyncExternalStore } from 'react';

// Design tokens (`tokens.css`) for Three.js, which cannot read CSS variables: the value of a token on
// `<html>`, read again whenever its `data-theme` changes, so lines recolour with the theme while the
// components never check it. The server render has no styles and gets white.
export function useTokenColor(name: `--${string}`): string {
  return useSyncExternalStore(onThemeChange, () => readToken(name), () => '#ffffff');
}

// A token as a Three.js colour and an opacity: three ignores the alpha of `rgba(…)` (with a warning),
// so a translucent token such as `--line-dim` becomes its opaque colour plus the alpha as opacity.
export function useTokenPaint(name: `--${string}`) {
  return splitAlpha(useTokenColor(name));
}

// The CSS pipeline may also hand `rgba(…)` over as an 8- (or 4-) digit hex colour.
export function splitAlpha(value: string): { color: string; opacity: number } {
  const hex = value.trim().match(/^#([0-9a-f]{8}|[0-9a-f]{4})$/i)?.[1];
  if (hex) {
    const full = hex.length === 4 ? [...hex].map((d) => d + d).join('') : hex;
    return { color: `#${full.slice(0, 6)}`, opacity: parseInt(full.slice(6), 16) / 255 };
  }
  const rgba = value.trim().match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (!rgba) return { color: value.trim() || '#ffffff', opacity: 1 };
  const [, r, g, b, a] = rgba;
  const alpha = a == null ? 1 : a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
  return { color: `rgb(${r}, ${g}, ${b})`, opacity: Math.min(1, Math.max(0, alpha)) };
}

const readToken = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function onThemeChange(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
