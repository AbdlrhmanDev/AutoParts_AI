import { env } from '../../config/env.js';
import { notConfigured, upstreamError } from '../../lib/errors.js';
import type { RawResult } from './normalize.js';
import { timeoutSignal } from '../../lib/signals.js';

const TAVILY_URL = 'https://api.tavily.com/search';
const TIMEOUT_MS = 15_000;

/** Runs one Tavily web search, biased to Saudi Arabia. */
export async function tavilySearch(query: string, maxResults = 8, signal?: AbortSignal): Promise<RawResult[]> {
  if (!env.TAVILY_API_KEY) throw notConfigured('TAVILY_API_KEY');

  const res = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.TAVILY_API_KEY}` },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      max_results: maxResults,
      country: 'saudi arabia',
      include_images: true,
      include_image_descriptions: true,
      include_raw_content: 'text',
    }),
    signal: timeoutSignal(TIMEOUT_MS, signal),
  });

  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw upstreamError(body?.detail?.error ?? body?.error ?? `Tavily HTTP ${res.status}`);
  return (body.results ?? [])
    .filter((r: RawResult) => typeof r.url === 'string')
    .map((r: RawResult) => ({ ...r, provider: 'tavily' as const }));
}
