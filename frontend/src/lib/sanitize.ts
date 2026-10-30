// @ts-nocheck — ported prototype data/logic; typed loosely on purpose.
/** Trims long strings/arrays and drops secret-looking keys before showing tool I/O in the inspector. */
export function sanitize(v, d) {
  d = d || 0;
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') return v.length > 160 ? v.slice(0, 160) + '…' : v;
  if (Array.isArray(v)) { const a = v.slice(0, 6).map(x => sanitize(x, d + 1)); if (v.length > 6) a.push('… +' + (v.length - 6)); return a; }
  if (typeof v === 'object') { if (d > 4) return '[…]'; const o = {}; Object.keys(v).forEach(k => { if (!/key|token|secret|password|authorization|reasoning|thinking/i.test(k)) o[k] = sanitize(v[k], d + 1); }); return o; }
  return v;
}

/** Returns the URL only when it is an http(s) link, so stored or third-party data cannot inject javascript:/data: hrefs. */
export function safeHref(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url : '';
}
