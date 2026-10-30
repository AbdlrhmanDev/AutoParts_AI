import type { CSSProperties } from 'react';

const cache = new Map<string, CSSProperties>();

/** Turns a CSS declaration string (copied verbatim from the design file) into a React style object. */
export function sx(css: string): CSSProperties {
  const hit = cache.get(css);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    out[prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  if (cache.size > 4000) cache.clear();
  cache.set(css, out);
  return out;
}

export const PRIMARY = 'background:linear-gradient(180deg, #FB8A3C, #EA6A10); color:#0A0E13; box-shadow:0 8px 20px -8px rgba(249,115,22,0.6);';
export const CARD = 'background:#121821; border:1px solid #1E2733; box-shadow:inset 0 1px 0 rgba(255,255,255,0.03); border-radius:18px; padding:22px; display:flex; flex-direction:column;';
export const PILL_TRACK = 'display:flex; gap:2px; padding:4px; background:#121821; border:1px solid #1C2430; border-radius:999px;';
export const MONO = "font-family:'IBM Plex Mono', 'IBM Plex Sans Arabic', monospace;";
