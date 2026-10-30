import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import { serpApiSearch } from './serpapi.js';

describe('SerpApi Google Shopping adapter', () => {
  const originalKey = env.SERPAPI_API_KEY;
  afterEach(() => { env.SERPAPI_API_KEY = originalKey; vi.unstubAllGlobals(); });

  it('maps authentic provider fields without fabricating missing values', async () => {
    env.SERPAPI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ shopping_results: [{
      title: 'NGK Spark Plugs Toyota Camry 2018', link: 'https://merchant.sa/ngk', source: 'Merchant SA',
      extracted_price: 149.5, thumbnail: 'https://cdn.merchant.sa/ngk.jpg', product_id: 'sp-1',
    }] }), { status: 200, headers: { 'content-type': 'application/json' } })));

    const [result] = await serpApiSearch('Camry 2018 spark plugs');
    expect(result).toMatchObject({
      title: 'NGK Spark Plugs Toyota Camry 2018', url: 'https://merchant.sa/ngk', image: 'https://cdn.merchant.sa/ngk.jpg',
      extractedPrice: 149.5, sourceName: 'Merchant SA', sourceId: 'sp-1', provider: 'serpapi',
    });
    const called = new URL((fetch as any).mock.calls[0][0]);
    expect(called.searchParams.get('engine')).toBe('google_shopping');
    expect(called.searchParams.get('gl')).toBe('sa');
    expect(called.searchParams.get('hl')).toBe('ar');
  });

  it('treats a valid Google zero-result response as empty so fallback search can run', async () => {
    env.SERPAPI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: "Google hasn't returned any results for this query.",
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    await expect(serpApiSearch('Lexus RX 2019 original brakes')).resolves.toEqual([]);
  });
});
