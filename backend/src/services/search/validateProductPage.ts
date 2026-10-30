import type { Listing } from '../../types.js';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { timeoutSignal } from '../../lib/signals.js';

const TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 192 * 1024;
const CONCURRENCY = 6;
const MAX_REDIRECTS = 4;

const UNAVAILABLE_PATTERNS = [
  /page\s+(?:you(?:'|’|&#x27;|&apos;)?re\s+looking\s+for\s+)?(?:was\s+)?not\s+found/i,
  /couldn(?:'|’|&#x27;|&apos;)?t\s+find\s+the\s+page/i,
  /product\s+(?:was\s+)?not\s+found/i,
  /product\s+(?:is\s+)?no\s+longer\s+available/i,
  /this\s+product\s+(?:is\s+)?(?:currently\s+)?unavailable/i,
  /this\s+product\s+(?:is\s+)?not\s+available/i,
  /(?:currently\s+)?out\s+of\s+stock/i,
  /sold\s+out|available\s+soon/i,
  /الصفحة\s+(?:التي\s+تبحث\s+عنها\s+)?غير\s+موجودة/i,
  /لم\s+يتم\s+العثور\s+على\s+(?:هذه\s+)?الصفحة/i,
  /المنتج\s+غير\s+موجود/i,
  /هذا\s+المنتج\s+(?:لم\s+يعد\s+متوفراً|غير\s+متوفر)/i,
];

interface ProductPageData {
  live: boolean;
  price: number | null;
  image: string | null;
  availability: string | null;
}

const attr = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1] ?? null;
};

const absoluteHttpUrl = (value: unknown, baseUrl: string): string | null => {
  const raw = Array.isArray(value) ? value[0] : typeof value === 'object' && value ? (value as any).url : value;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

const productNodes = (value: unknown): any[] => {
  if (Array.isArray(value)) return value.flatMap(productNodes);
  if (!value || typeof value !== 'object') return [];
  const obj = value as Record<string, unknown>;
  const type = obj['@type'];
  const own = type === 'Product' || (Array.isArray(type) && type.includes('Product')) ? [obj] : [];
  return [...own, ...Object.values(obj).flatMap(productNodes)];
};

const firstOffer = (offers: unknown): any => Array.isArray(offers) ? offers[0] : offers;

/** Extracts product price/image/availability from JSON-LD and Open Graph metadata. */
export function extractProductPageData(html: string, pageUrl: string): ProductPageData {
  let price: number | null = null;
  let image: string | null = null;
  let availability: string | null = null;

  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const product = productNodes(parsed)[0];
      if (!product) continue;
      const offer = firstOffer(product.offers);
      const rawPrice = offer?.price ?? offer?.lowPrice ?? offer?.priceSpecification?.price;
      const amount = typeof rawPrice === 'number' ? rawPrice : Number(String(rawPrice ?? '').replace(/[^\d.]/g, ''));
      if (Number.isFinite(amount) && amount >= 10 && amount < 200_000) price = amount;
      image = absoluteHttpUrl(product.image, pageUrl) ?? image;
      availability = typeof offer?.availability === 'string' ? offer.availability : availability;
    } catch {
      // Ignore invalid third-party structured data and continue with metadata.
    }
  }

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = (attr(tag, 'property') ?? attr(tag, 'name') ?? attr(tag, 'itemprop') ?? '').toLowerCase();
    const value = attr(tag, 'content');
    if (!value) continue;
    if (!image && (key === 'og:image' || key === 'twitter:image')) image = absoluteHttpUrl(value.replace(/&amp;/g, '&'), pageUrl);
    if (price === null && (key === 'product:price:amount' || key === 'price')) {
      const amount = Number(value.replace(/[^\d.]/g, ''));
      if (Number.isFinite(amount) && amount >= 10 && amount < 200_000) price = amount;
    }
    if (!availability && key.includes('availability')) availability = value;
  }

  const unavailable = isUnavailablePage(200, html)
    || !!availability && /outofstock|soldout|discontinued|limitedavailability|preorder/i.test(availability);
  return { live: !unavailable, price, image, availability };
}

export function isUnavailablePage(status: number, html: string): boolean {
  if (status === 404 || status === 410 || status === 204 || status >= 500) return true;
  return UNAVAILABLE_PATTERNS.some(pattern => pattern.test(html));
}

async function readPrefix(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (bytes < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return text;
}

/** Loopback, private, link-local, CGNAT, benchmarking, multicast and reserved IPv4 ranges. */
const privateIpv4 = (ip: string) => {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || a === 100 && b >= 64 && b <= 127
    || a === 169 && b === 254
    || a === 172 && b >= 16 && b <= 31
    || a === 192 && (b === 168 || b === 0)
    || a === 198 && (b === 18 || b === 19);
};

export const privateIp = (address: string): boolean => {
  if (isIP(address) === 4) return privateIpv4(address);
  const ip = address.toLowerCase();
  // IPv4-mapped/compatible IPv6 (::ffff:127.0.0.1) reaches the IPv4 host.
  const mapped = ip.match(/^(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateIpv4(mapped[1]);
  if (ip.startsWith('::ffff:')) return true;
  return ip === '::1' || ip === '::' || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith('ff') || ip.startsWith('64:ff9b:') || ip.startsWith('2001:db8:');
};

/**
 * DNS lookup used by the socket itself. Every resolved address is checked here, so the
 * connection goes to the address that passed the check (no DNS-rebinding window).
 */
const publicOnlyLookup = ((hostname: string, options: any, callback: any) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(({ address }) => privateIp(address))) {
      return callback(Object.assign(new Error('Private product host'), { code: 'EPRIVATEHOST' }));
    }
    if (options?.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}) as LookupFunction;

function assertPublicHttpUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsafe product URL');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Unsafe product host');
  if (url.port && !['80', '443', '8080', '8443'].includes(url.port)) throw new Error('Unsafe product port');
  // IP literals skip DNS, so they are checked here; hostnames are checked in publicOnlyLookup.
  if (isIP(host) && privateIp(host)) throw new Error('Private product host');
  return url;
}

const DECODERS: Record<string, () => NodeJS.ReadWriteStream> = {
  gzip: zlib.createGunzip, 'x-gzip': zlib.createGunzip, deflate: zlib.createInflate, br: zlib.createBrotliDecompress,
};

/** One GET over node:http(s) with the guarded lookup, exposed as a fetch Response. */
function guardedGet(url: URL, signal: AbortSignal): Promise<Response> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'GET',
      lookup: publicOnlyLookup,
      signal,
      headers: { accept: 'text/html,application/xhtml+xml', 'accept-encoding': 'gzip, deflate, br', 'user-agent': 'Mozilla/5.0 (compatible; AutoPartsAI/1.0; product-link-check)' },
    }, res => {
      const status = res.statusCode ?? 0;
      if (status < 200 || status > 599) { res.destroy(); return reject(new Error(`Unexpected HTTP status ${status}`)); }
      const headers = new Headers();
      for (let i = 0; i < res.rawHeaders.length; i += 2) {
        try { headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]); } catch { /* skip malformed header */ }
      }
      if ([204, 205, 304].includes(status)) { res.resume(); return resolve(new Response(null, { status, headers })); }
      const decoder = DECODERS[String(res.headers['content-encoding'] ?? '').trim().toLowerCase()]?.();
      if (decoder) res.on('error', error => (decoder as unknown as Readable).destroy(error));
      const body = decoder ? res.pipe(decoder) as unknown as Readable : res;
      resolve(new Response(Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>, { status, headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Fetches a product page without allowing requests or redirects into private/internal networks. */
export async function safeProductFetch(value: string, signal?: AbortSignal): Promise<Response> {
  const deadline = timeoutSignal(TIMEOUT_MS, signal);
  let current = assertPublicHttpUrl(value);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const response = await guardedGet(current, deadline);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    await response.body?.cancel().catch(() => undefined);
    current = assertPublicHttpUrl(new URL(location, current).href);
  }
  throw new Error('Too many product redirects');
}

async function inspectProductPage(product: Listing, signal?: AbortSignal): Promise<Listing | null> {
  try {
    const response = await safeProductFetch(product.url, signal);
    const contentType = response.headers.get('content-type') ?? '';
    // Many stores block server-side link checkers while remaining usable in a browser.
    // Treat those responses as unknown, and reject only confirmed dead destinations.
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      return product.price !== null || product.image ? product : null;
    }
    if (!response.ok || !contentType.toLowerCase().includes('text/html')) return null;
    const html = await readPrefix(response);
    if (isUnavailablePage(response.status, html)) return null;
    const page = extractProductPageData(html, product.url);
    if (!page.live) return null;
    const enriched = {
      ...product,
      price: product.price ?? page.price,
      image: product.image ?? page.image,
      avail: page.availability ?? product.avail,
    };
    return enriched.price !== null || enriched.image ? enriched : null;
  } catch (error) {
    if (signal?.aborted) throw error;
    return product.price !== null || product.image ? product : null;
  }
}

/** Enriches verified pages and drops unavailable or data-empty product results. */
export async function keepLiveProducts(products: Listing[], signal?: AbortSignal): Promise<Listing[]> {
  const enriched = new Array<Listing | null>(products.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < products.length) {
      const index = next++;
      signal?.throwIfAborted();
      enriched[index] = await inspectProductPage(products[index], signal);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, products.length) }, worker));
  return enriched.filter((product): product is Listing => product !== null);
}
