import { createHash } from 'node:crypto';
import { MAKE_AR, MODEL_AR, PART_KEYWORDS } from '../../domain/catalog.js';
import type { Fitment, Listing, Vehicle } from '../../types.js';

// Deterministic extraction from listing text. Nothing is guessed: if the page does not say it, the field is null.

const MIN_PRICE_SAR = 10; // below this it is almost always a fee, installment or shipping line
const MAX_PRICE_SAR = 200_000;

const toLatinDigits = (s: string) =>
  s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٫/g, '.').replace(/[,،]/g, '');

const NUM = '([\\d٠-٩][\\d٠-٩,،]*(?:[.٫][\\d٠-٩]{1,2})?)';
const CUR = '(?:SAR|SR|ر\\.?\\s?س\\.?|ريال)';
const PRICE_PATTERNS = [new RegExp(`${CUR}\\s*${NUM}`, 'gi'), new RegExp(`${NUM}\\s*${CUR}`, 'gi')];

// Saudi stores show "4 دفعات بقيمة SAR 95.00 /شهر" (Tabby/Tamara). That amount is an installment, not the price.
const INSTALLMENT_TOTAL = new RegExp(`([2-9]|1[0-2])\\s*(?:دفعات|أقساط|اقساط|payments?)\\s*(?:بقيمة|of)?\\s*${CUR}?\\s*${NUM}`, 'i');
const INSTALLMENT_CONTEXT = /دفعات|قسط|أقساط|اقساط|تقسيط|\/\s*شهر|شهري|per\s*month|\/\s*mo\b|payments?\s+of|tabby|tamara|تابي|تمارا/i;
const CONTEXT_CHARS = 30;

const toAmount = (raw: string) => parseFloat(toLatinDigits(raw));
const plausible = (n: number) => Number.isFinite(n) && n >= MIN_PRICE_SAR && n < MAX_PRICE_SAR;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function parsePrice(text: string): number | null {
  const installment = text.match(INSTALLMENT_TOTAL);
  if (installment) {
    const total = Number(installment[1]) * toAmount(installment[2]);
    if (plausible(total)) return round2(total);
  }
  for (const re of PRICE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const around = text.slice(Math.max(0, m.index! - CONTEXT_CHARS), m.index! + m[0].length + CONTEXT_CHARS);
      if (INSTALLMENT_CONTEXT.test(around)) continue;
      const n = toAmount(m[1]);
      if (plausible(n)) return round2(n);
    }
  }
  return null;
}

const PART_NO_PATTERNS = [
  /\b(\d{5}-[A-Z0-9]{5}(?:-[A-Z0-9]{2})?)\b/i, // Toyota/Lexus style: 04465-33471
  /\b([A-Z]{1,4}\d{3,8}[A-Z0-9]*)\b/, // brand codes: TRC1293, D1222
];
const YEAR_RANGE = /^(19|20)\d{2}-(19|20)\d{2}$/;

export function parsePartNo(text: string): string | null {
  for (const re of PART_NO_PATTERNS) {
    const m = text.match(re);
    if (m && !YEAR_RANGE.test(m[1])) return m[1].toUpperCase();
  }
  return null;
}

const compact = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

const makeAliases = (make: string) => {
  const names = [make, MAKE_AR[make]].filter(Boolean) as string[];
  const key = compact(make);
  if (key.includes('mercedes')) names.push('Mercedes', 'Mercedes-Benz', 'مرسيدس');
  if (key === 'bmw' || key.includes('بيام')) names.push('BMW', 'بي إم دبليو');
  return [...new Set(names.map(compact).filter(Boolean))];
};

/** Reads model-local year evidence from a title; make, model and year must share one clause. */
export function parseFitment(title: string, vehicle: Vehicle): Fitment[] | null {
  if (!vehicle.make || !vehicle.model) return null;
  const makes = makeAliases(vehicle.make);
  const models = [vehicle.model, MODEL_AR[vehicle.model]].filter(Boolean).map(name => compact(name!));
  const clauses = title.split(/[,،;|]+/).map(value => value.trim()).filter(Boolean);
  const fit: Fitment[] = [];

  for (const clause of clauses) {
    const key = compact(clause);
    if (!makes.some(make => key.includes(make)) || !models.some(model => key.includes(model))) continue;
    const ranges = [...clause.matchAll(/\b((?:19|20)\d{2})\s*(?:-|–|—|to|إلى|الى)\s*((?:19|20)\d{2})\b/gi)];
    if (ranges.length) {
      for (const range of ranges) {
        const from = Number(range[1]);
        const to = Number(range[2]);
        if (from <= to) fit.push({ make: vehicle.make, model: vehicle.model, from, to });
      }
      continue;
    }
    for (const year of clause.matchAll(/\b((?:19|20)\d{2})\b/g)) {
      const value = Number(year[1]);
      fit.push({ make: vehicle.make, model: vehicle.model, from: value, to: value });
    }
  }

  return fit.length ? fit : null;
}

const OEM_PATTERN = /\b(genuine|oem|original)\b|أصلي|اصلي|وكالة/i;

export interface RawResult {
  url: string;
  title?: string;
  content?: string;
  raw_content?: string | null;
  images?: Array<string | {
    url?: string;
    description?: string | null;
    description_source?: string | null;
    score?: number;
  }>;
  image?: string | null;
  extractedPrice?: number | null;
  sourceName?: string | null;
  sourceId?: string | null;
  provider?: 'serpapi' | 'tavily';
}

const IMAGE_FILE = /\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i;
const LOW_QUALITY_IMAGE = /(?:sprite|favicon|logo|icon|avatar|placeholder|s-empty|uedata|\/batch\/)/i;

/** Selects a safe, part-relevant image from the exact source page. */
export function firstImage(images: RawResult['images'], partType?: string): string | null {
  if (!Array.isArray(images)) return null;
  const candidates: Array<{ url: string; score: number }> = [];
  for (const image of images) {
    const candidate = typeof image === 'string' ? image : image?.url;
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      if (LOW_QUALITY_IMAGE.test(url.href)) continue;

      const description = typeof image === 'string' ? '' : (image.description ?? '');
      const source = typeof image === 'string' ? '' : (image.description_source ?? '');
      const partPattern = partType ? PART_KEYWORDS[partType] : undefined;
      const matchesPart = partPattern ? partPattern.test(`${description} ${decodeURIComponent(url.pathname)}`) : false;
      const hasImageFile = IMAGE_FILE.test(url.href);
      if (!hasImageFile && !description) continue;

      let score = typeof image === 'string' ? 0 : (image.score ?? 0);
      if (matchesPart) score += 50;
      if (source === 'og:image') score += 12;
      if (hasImageFile) score += 3;
      // A described image of another item (for example an ignition coil) is worse than no image.
      if (description && partPattern && !matchesPart) score -= 100;
      candidates.push({ url: url.href, score });
    } catch {
      // Ignore malformed image URLs supplied by an upstream page.
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.score >= 0 ? candidates[0].url : null;
}

/** Only web links may become product links (no javascript:, data:, file: ...). */
export const isHttpUrl = (value: unknown) => typeof value === 'string' && /^https?:\/\//i.test(value);

export function toListing(raw: RawResult, partType: string, vehicle: Vehicle, retrievedAt: string): Listing {
  const title = String(raw.title || raw.url).slice(0, 140);
  const text = `${title}\n${raw.raw_content ?? raw.content ?? ''}`;
  const host = raw.sourceName || new URL(raw.url).hostname.replace(/^www\./, '');
  const oem = OEM_PATTERN.test(text);
  return {
    id: createHash('sha1').update(raw.url).digest('hex').slice(0, 12),
    type: partType,
    ar: title,
    en: title,
    brand: oem ? { ar: 'أصلي (OEM)', en: 'OEM' } : { ar: 'غير محدد', en: 'Unspecified' },
    seller: { ar: host, en: host },
    price: raw.extractedPrice != null && plausible(raw.extractedPrice) ? round2(raw.extractedPrice) : parsePrice(text),
    partNo: parsePartNo(text),
    url: raw.url,
    image: raw.image ?? firstImage(raw.images, partType),
    fit: parseFitment(title, vehicle),
    avail: null,
    retrievedAt,
    source: raw.provider ?? 'tavily',
    sourceId: raw.sourceId ?? null,
  };
}
