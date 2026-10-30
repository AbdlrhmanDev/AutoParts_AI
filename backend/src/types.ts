export type Lang = 'ar' | 'en';
export type Localized = { ar: string; en: string };

export interface Vehicle {
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
  trim?: string;
  market?: string;
  vin?: string;
}

/** Year-range fitment stated by the listing itself (never inferred by the LLM). */
export interface Fitment {
  make: string;
  model: string;
  from: number;
  to: number;
}

/** A normalized web listing. Fields the source page does not state stay null. */
export interface Listing {
  id: string;
  type: string;
  ar: string;
  en: string;
  brand: Localized;
  seller: Localized;
  price: number | null;
  partNo: string | null;
  url: string;
  image: string | null;
  fit: Fitment[] | null;
  avail: string | null;
  retrievedAt: string;
  source?: 'serpapi' | 'tavily' | 'authorized_catalog';
  sourceId?: string | null;
}

export interface SearchResult {
  provider: 'serpapi' | 'tavily' | 'hybrid';
  providers: Array<'serpapi' | 'tavily'>;
  retrievedAt: string;
  queries: string[];
  products: Listing[];
}

export interface QuotationRecord {
  no: string;
  date?: string;
  totalN?: number;
  count?: number;
  vehicle?: Vehicle;
  expiresAt?: string;
  [key: string]: unknown;
}
