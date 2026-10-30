// @ts-nocheck — ported prototype data/logic; typed loosely on purpose.
import { MAKE_AR, MODEL_AR, S } from './constants';

/** Deterministic fitment check: only listing fitment data decides compatibility, never the LLM. */
export const vComplete = v => !!(v && v.make && v.model && v.year);
export function verify(v, p) {
  if (!vComplete(v)) return { status: 'unverified', evidence: S('بيانات المركبة غير مكتملة', 'Vehicle details incomplete') };
  if (!p.fit || !p.fit.length) return { status: 'unverified', evidence: S('المصدر لا يوفر بيانات ملاءمة', 'Source provides no fitment data') };
  const hit = p.fit.find(f => f.make === v.make && f.model === v.model && +v.year >= f.from && +v.year <= f.to);
  if (hit) return { status: 'verified', evidence: S(`ملاءمة المصدر: ${MAKE_AR[hit.make] || hit.make} ${MODEL_AR[hit.model] || hit.model} ${hit.from}–${hit.to}`, `Source fitment: ${hit.make} ${hit.model} ${hit.from}–${hit.to}`) };
  const f = p.fit[0];
  return { status: 'incompatible', evidence: S(`الملاءمة المعلنة: ${MAKE_AR[f.make] || f.make} ${MODEL_AR[f.model] || f.model} ${f.from}–${f.to} فقط`, `Listed fitment: ${f.make} ${f.model} ${f.from}–${f.to} only`) };
}
export const CRANK = { verified: 0, unverified: 1, incompatible: 2 };
export const priceOf = p => (p && typeof p.price === 'number' ? p.price : Infinity);
export const isOem = p => !!(p && p.brand && p.brand.en === 'OEM');
export function rank(list, v) { return [...list].sort((a, b) => (CRANK[verify(v, a).status] - CRANK[verify(v, b).status]) || priceOf(a) - priceOf(b)); }
export function cleanVehicle(v) { const o = {}; if (!v) return o; ['make', 'model', 'year', 'engine', 'trim', 'market', 'vin'].forEach(k => { if (v[k] !== null && v[k] !== undefined && v[k] !== '') o[k] = k === 'year' ? +v[k] : v[k]; }); return o; }
