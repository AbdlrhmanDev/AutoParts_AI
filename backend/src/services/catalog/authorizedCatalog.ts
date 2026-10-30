import { z } from 'zod';
import { env } from '../../config/env.js';
import { timeoutSignal } from '../../lib/signals.js';
import type { Listing, Vehicle } from '../../types.js';

const httpUrl = z.string().url().regex(/^https?:\/\//i, 'URL must be http(s)');

const CatalogItem = z.object({
  id: z.string().min(1), title: z.string().min(1), titleAr: z.string().optional(),
  brand: z.string().default(''), seller: z.string().min(1), price: z.number().nonnegative().nullable(),
  partNo: z.string().nullable().default(null), url: httpUrl, image: httpUrl.nullable().default(null),
  availability: z.string().nullable().default(null), partType: z.string().min(1),
  fitment: z.array(z.object({ make: z.string(), model: z.string(), from: z.number().int(), to: z.number().int() })).min(1),
}).strict();
const CatalogResponse = z.object({ items: z.array(CatalogItem).max(100) }).strict();
const VinResponse = z.object({ verified: z.boolean(), vehicle: z.object({ make: z.string().optional(), model: z.string().optional(), year: z.number().int().optional(), engine: z.string().optional(), trim: z.string().optional(), market: z.string().optional() }).optional() }).strict();

export const authorizedCatalogConfigured = () => Boolean(env.AUTHORIZED_CATALOG_URL && env.AUTHORIZED_CATALOG_API_KEY);

async function request(path: string, body: unknown, signal?: AbortSignal) {
  if (!authorizedCatalogConfigured()) return null;
  const response = await fetch(new URL(path, `${env.AUTHORIZED_CATALOG_URL.replace(/\/$/, '')}/`), {
    method: 'POST', signal: timeoutSignal(12_000, signal),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.AUTHORIZED_CATALOG_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Authorized catalog HTTP ${response.status}`);
  return response.json();
}

export async function searchAuthorizedCatalog(input: { vehicle: Vehicle; partTypes: string[]; signal?: AbortSignal }) {
  const raw = await request('v1/parts/search', { vehicle: input.vehicle, partTypes: input.partTypes }, input.signal);
  if (!raw) return { configured: false, products: [] as Listing[] };
  const parsed = CatalogResponse.parse(raw);
  const retrievedAt = new Date().toISOString();
  const products: Listing[] = parsed.items.map(item => ({
    id: `catalog:${item.id}`, type: item.partType, ar: item.titleAr ?? item.title, en: item.title,
    brand: { ar: item.brand, en: item.brand }, seller: { ar: item.seller, en: item.seller },
    price: item.price, partNo: item.partNo, url: item.url, image: item.image, fit: item.fitment,
    avail: item.availability, retrievedAt, source: 'authorized_catalog', sourceId: item.id,
  }));
  return { configured: true, products };
}

export async function verifyVin(vin: string, signal?: AbortSignal) {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) return { configured: authorizedCatalogConfigured(), verified: false, reason: 'invalid_format' as const };
  const raw = await request('v1/vehicles/vin', { vin: vin.toUpperCase() }, signal);
  if (!raw) return { configured: false, verified: false, reason: 'provider_not_configured' as const };
  return { configured: true, ...VinResponse.parse(raw) };
}
