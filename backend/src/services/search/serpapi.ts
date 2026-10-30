import { env } from '../../config/env.js';
import { notConfigured, upstreamError } from '../../lib/errors.js';
import type { RawResult } from './normalize.js';
import { timeoutSignal } from '../../lib/signals.js';

const SERPAPI_URL = 'https://serpapi.com/search.json';
const TIMEOUT_MS = 15_000;

type ShoppingResult = {
  title?: string;
  link?: string;
  product_link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  product_id?: string;
  delivery?: string;
};

/** Google Shopping results scoped to Saudi Arabia. SerpApi is the primary catalog source. */
export async function serpApiSearch(query: string, maxResults = 12, signal?: AbortSignal): Promise<RawResult[]> {
  if (!env.SERPAPI_API_KEY) throw notConfigured('SERPAPI_API_KEY');
  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    gl: 'sa',
    hl: 'ar',
    location: 'Saudi Arabia',
    api_key: env.SERPAPI_API_KEY,
  });
  const res = await fetch(`${SERPAPI_URL}?${params}`, { signal: timeoutSignal(TIMEOUT_MS, signal) });
  const body = (await res.json().catch(() => ({}))) as any;
  // SerpApi sometimes represents a valid zero-result Google Shopping response
  // as `error` even with HTTP 200. This is an empty result set, not a provider
  // outage; returning [] lets LangGraph continue to the Tavily fallback.
  if (res.ok && typeof body?.error === 'string' && /(?:hasn't returned any results|no results (?:found|for))/i.test(body.error)) return [];
  if (!res.ok || body?.error) throw upstreamError(body?.error ?? `SerpApi HTTP ${res.status}`);

  return ((body.shopping_results ?? []) as ShoppingResult[])
    .slice(0, maxResults)
    .map(item => ({
      title: item.title ?? '',
      url: item.link ?? item.product_link ?? '',
      content: [item.source, item.price, item.delivery].filter(Boolean).join(' · '),
      image: item.thumbnail ?? null,
      extractedPrice: typeof item.extracted_price === 'number' ? item.extracted_price : null,
      sourceName: item.source ?? null,
      sourceId: item.product_id ?? null,
      provider: 'serpapi' as const,
    }))
    .filter(item => item.url && item.title);
}
