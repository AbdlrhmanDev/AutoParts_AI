import { MAKE_AR, MODEL_AR, PART_KEYWORDS, PART_TYPE_QUERY } from '../../domain/catalog.js';
import { productsRepo } from '../../repositories/index.js';
import type { Listing, SearchResult, Vehicle } from '../../types.js';
import { isHttpUrl, toListing, type RawResult } from './normalize.js';
import { env } from '../../config/env.js';
import { serpApiSearch } from './serpapi.js';
import { tavilySearch } from './tavily.js';
import { keepLiveProducts } from './validateProductPage.js';

const MAX_PART_TYPES = 3;
const MAX_PRODUCTS = 15;

export interface SearchInput {
  ownerId: string;
  signal?: AbortSignal;
  vehicle: Vehicle;
  partTypes: string[];
  termsAr?: string;
  provider?: 'serpapi' | 'tavily';
}

function buildQueries({ vehicle, partTypes, termsAr }: SearchInput) {
  const car = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');
  const queries = partTypes.slice(0, MAX_PART_TYPES).map(type => ({ type, query: `${PART_TYPE_QUERY[type] ?? type} ${car} price SAR Saudi Arabia` }));
  if (termsAr) {
    const carAr = [MAKE_AR[vehicle.make ?? ''] ?? vehicle.make, MODEL_AR[vehicle.model ?? ''] ?? vehicle.model, vehicle.year].filter(Boolean).join(' ');
    queries.push({ type: partTypes[0], query: `${termsAr} ${carAr} سعر` });
  }
  return queries;
}

/** Keeps only results whose title names the part (drops cars, guides and loosely related pages). */
export const mentionsPart = (raw: RawResult, type: string) => {
  const keywords = PART_KEYWORDS[type];
  return !keywords || keywords.test(raw.title ?? '');
};

/** Only source-declared make/model/year fitment is allowed into customer results. */
export const matchesVehicleYear = (listing: Listing, vehicle: Vehicle) => {
  if (!vehicle.make || !vehicle.model || !vehicle.year || !listing.fit?.length) return false;
  return listing.fit.some(fit =>
    fit.make === vehicle.make
    && fit.model === vehicle.model
    && vehicle.year! >= fit.from
    && vehicle.year! <= fit.to,
  );
};

/** Searches the web for parts, normalizes and de-duplicates listings, and stores them. */
export async function searchParts(input: SearchInput): Promise<SearchResult> {
  const retrievedAt = new Date().toISOString();
  const queries = buildQueries(input);
  const providers: Array<'serpapi' | 'tavily'> = [];
  const primaryName: 'serpapi' | 'tavily' = input.provider ?? (env.SERPAPI_API_KEY ? 'serpapi' : 'tavily');
  const primary = primaryName === 'serpapi' ? serpApiSearch : tavilySearch;
  providers.push(primaryName);
  const batches = await Promise.all(queries.map(async q => ({ type: q.type, results: await primary(q.query, undefined, input.signal) })));

  const seen = new Set<string>();
  const products: Listing[] = [];
  for (const { type, results } of batches) {
    for (const raw of results) {
      if (seen.has(raw.url) || !isHttpUrl(raw.url) || !mentionsPart(raw, type)) continue;
      const listing = toListing(raw, type, input.vehicle, retrievedAt);
      if (!matchesVehicleYear(listing, input.vehicle)) continue;
      seen.add(raw.url);
      products.push(listing);
    }
  }

  // SerpApi is precise for products but may return too few fitment-proven pages.
  // Tavily fills the gap; it never replaces or weaken the same strict checks.
  if (!input.provider && env.SERPAPI_API_KEY && env.TAVILY_API_KEY && products.length < 4) {
    providers.push('tavily');
    const fallback = await Promise.all(queries.map(async q => ({ type: q.type, results: await tavilySearch(q.query, undefined, input.signal) })));
    for (const { type, results } of fallback) {
      for (const raw of results) {
        if (seen.has(raw.url) || !isHttpUrl(raw.url) || !mentionsPart(raw, type)) continue;
        const listing = toListing(raw, type, input.vehicle, retrievedAt);
        if (!matchesVehicleYear(listing, input.vehicle)) continue;
        seen.add(raw.url);
        products.push(listing);
      }
    }
  }

  // Tavily can retain stale product URLs. Verify the destination and soft-404 content
  // before exposing a source link to the user.
  const liveProducts = await keepLiveProducts(products.slice(0, MAX_PRODUCTS * 2), input.signal);
  const top = liveProducts.slice(0, MAX_PRODUCTS);
  await productsRepo.upsertMany(input.ownerId, top);
  const provider = providers.length > 1 ? 'hybrid' : providers[0];
  return { provider, providers, retrievedAt, queries: queries.map(q => q.query), products: top };
}
