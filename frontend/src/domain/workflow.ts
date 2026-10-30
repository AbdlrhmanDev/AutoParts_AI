// @ts-nocheck — ported prototype data/logic; typed loosely on purpose.
import { S } from './constants';

export const NW = 220, NH = 68, GW = 1070, GH = 1600;
export const COLS = { A: 0, B: 270, C: 560, D: 850 };
export const WF_POS = {
  context_compaction: ['C', 0], intent_detection: ['C', 100], vehicle_extraction: ['C', 200], missing_information: ['C', 300],
  automotive_diagnosis: ['B', 400], followup_questions: ['D', 500], respond: ['D', 400],
  search_query_generation: ['C', 500], saudi_merchant_catalog_search: ['C', 600],
  google_shopping_search: ['B', 700], tavily_fallback_search: ['D', 700],
  product_normalization: ['C', 820], duplicate_detection: ['C', 920], compatibility_verification: ['C', 1020],
  product_ranking: ['C', 1120], product_recommendations: ['C', 1220],
  quotation_management: ['A', 400], confirm: ['A', 520], pdf: ['A', 640],
};
export const WF_EDGES = [
  ['context_compaction','bottom','intent_detection','top',null], ['intent_detection','bottom','vehicle_extraction','top',null], ['vehicle_extraction','bottom','missing_information','top',null],
  ['missing_information','start','automotive_diagnosis','top',S('تشخيص','diagnosis')], ['missing_information','end','followup_questions','top',S('ناقص','missing')],
  ['missing_information','bottom','search_query_generation','top',S('بحث','search')], ['missing_information','start','quotation_management','top',S('عرض سعر','quote')],
  ['missing_information','end','respond','top',S('رد مباشر','direct')], ['automotive_diagnosis','bottom','search_query_generation','start',null],
  ['automotive_diagnosis','end','followup_questions','start',null], ['search_query_generation','bottom','saudi_merchant_catalog_search','top',null],
  ['saudi_merchant_catalog_search','start','google_shopping_search','top',S('أساسي','primary')], ['saudi_merchant_catalog_search','end','tavily_fallback_search','top',S('احتياطي','fallback')],
  ['google_shopping_search','bottom','product_normalization','top',null], ['google_shopping_search','end','tavily_fallback_search','start',S('نتائج قليلة','few results')],
  ['tavily_fallback_search','bottom','product_normalization','top',null], ['product_normalization','bottom','duplicate_detection','top',null],
  ['duplicate_detection','bottom','compatibility_verification','top',null], ['compatibility_verification','bottom','product_ranking','top',null],
  ['product_ranking','bottom','product_recommendations','top',null], ['quotation_management','bottom','confirm','top',null],
  ['confirm', 'bottom', 'pdf', 'top', S('تم التأكيد', 'confirmed')],
];
export const wfPos = (id, rtl) => { const p = WF_POS[id]; const x = COLS[p[0]]; return { x: rtl ? GW - x - NW : x, y: p[1] }; };
export function wfAnchor(id, side, rtl) {
  const p = wfPos(id, rtl);
  const phys = side === 'start' ? (rtl ? 'right' : 'left') : side === 'end' ? (rtl ? 'left' : 'right') : side;
  if (phys === 'top') return { x: p.x + NW / 2, y: p.y, dx: 0, dy: -1 };
  if (phys === 'bottom') return { x: p.x + NW / 2, y: p.y + NH, dx: 0, dy: 1 };
  if (phys === 'left') return { x: p.x, y: p.y + NH / 2, dx: -1, dy: 0 };
  return { x: p.x + NW, y: p.y + NH / 2, dx: 1, dy: 0 };
}
export function edgeGeom(e, rtl) {
  const a = wfAnchor(e[0], e[1], rtl), b = wfAnchor(e[2], e[3], rtl);
  const c = e[5] || Math.max(30, Math.min(140, Math.hypot(b.x - a.x, b.y - a.y) / 2));
  const tipX = b.x, tipY = b.y, ux = -b.dx, uy = -b.dy;
  const bx = tipX - ux * 9, by = tipY - uy * 9, px = -uy * 4.5, py = ux * 4.5;
  const p1 = [a.x + a.dx * c, a.y + a.dy * c], p2 = [bx + b.dx * c, by + b.dy * c];
  const mid = [(a.x + 3 * p1[0] + 3 * p2[0] + bx) / 8, (a.y + 3 * p1[1] + 3 * p2[1] + by) / 8];
  return { d: 'M' + a.x + ',' + a.y + ' C' + p1[0] + ',' + p1[1] + ' ' + p2[0] + ',' + p2[1] + ' ' + bx + ',' + by,
    arrow: 'M' + tipX + ',' + tipY + ' L' + (bx + px) + ',' + (by + py) + ' L' + (bx - px) + ',' + (by - py) + ' Z', mid };
}
export const CSTEPS = [
  { id: 'understand', ar: 'فهم الطلب', en: 'Understanding', nodes: ['context_compaction','intent_detection','vehicle_extraction','missing_information','followup_questions'], icon: 'intent' },
  { id: 'analyze', ar: 'تحليل المشكلة', en: 'Analyzing the problem', nodes: ['automotive_diagnosis'], icon: 'diagnose' },
  { id: 'search', ar: 'البحث عن القطع', en: 'Finding parts', nodes: ['search_query_generation','saudi_merchant_catalog_search','google_shopping_search','tavily_fallback_search','product_normalization','duplicate_detection'], icon: 'search' },
  { id: 'verify', ar: 'التحقق من التوافق', en: 'Checking fit', nodes: ['compatibility_verification'], icon: 'compat' },
  { id: 'results', ar: 'عرض النتائج', en: 'Showing results', nodes: ['product_ranking','product_recommendations'], icon: 'recommend' },
  { id: 'quote', ar: 'عرض السعر', en: 'Quotation', nodes: ['quotation_management'], icon: 'quote' },
];
export function deriveExpected(steps) { const ids = new Set((steps || []).map(x => x.id)); return CSTEPS.filter(c => c.nodes.some(n => ids.has(n))).map(c => c.id); }
export function expectedFor(plan, ok) {
  if (plan.intent === 'quote') return ['understand', 'quote'];
  if (plan.intent === 'preference') return ['understand', 'results'];
  const arr = ['understand'];
  if (plan.diagnosis && plan.diagnosis.causes && plan.diagnosis.causes.length) arr.push('analyze');
  if (plan.search && plan.search.partTypes && plan.search.partTypes.length && ok) arr.push('search', 'verify', 'results');
  return arr;
}
export function custState(run, confirmed) {
  const exp = run.expected && run.expected.length ? run.expected : deriveExpected(run.steps);
  return CSTEPS.filter(c => exp.includes(c.id)).map(c => {
    const sts = c.nodes.map(id => { const x = run.steps.find(y => y.id === id); return x ? x.status : null; }).filter(Boolean);
    let st = 'pending';
    if (sts.includes('error')) st = 'failed'; else if (sts.includes('running')) st = 'running'; else if (sts.length && sts.every(x => x === 'done')) st = 'done';
    if (c.id === 'quote' && st === 'done' && !confirmed) st = 'waiting';
    if (!run.live && st === 'pending') st = 'skipped';
    return { c, st };
  });
}
