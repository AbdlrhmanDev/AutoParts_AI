import { describe, expect, it } from 'vitest';
import { rankProducts, selectRoute } from './graphV2.js';

describe('LangGraph conditional routing', () => {
  it('routes direct part requests to live search', () => {
    expect(selectRoute({ intent: 'parts_request', needsFollowUp: false, search: { partTypes: ['spark_plugs'] } })).toBe('search_query_generation');
  });

  it('prioritizes one contextual follow-up when vehicle data is missing', () => {
    expect(selectRoute({ intent: 'diagnosis', needsFollowUp: true, search: null })).toBe('followup_questions');
  });

  it('routes quotation and general conversation without unnecessary search', () => {
    expect(selectRoute({ intent: 'quote', search: null })).toBe('quotation_management');
    expect(selectRoute({ intent: 'general', needsFollowUp: false, search: null })).toBe('respond');
  });
});

describe('product ranking', () => {
  const item = (id: string, title: string, price: number | null, partNo: string | null) => ({
    id, type: 'brake_pads_front', ar: title, en: title, brand: { ar: '', en: '' }, seller: { ar: '', en: '' },
    price, partNo, url: `https://example.com/${id}`, image: null, fit: [], avail: null, retrievedAt: new Date().toISOString(), source: 'serpapi' as const,
  });

  it('honours OEM and cheapest preferences without inventing data', () => {
    const oem = item('oem', 'Genuine OEM brake pads', 300, '04465');
    const cheap = item('cheap', 'Aftermarket brake pads', 120, null);
    expect(rankProducts([cheap, oem], 'oem')[0].id).toBe('oem');
    expect(rankProducts([oem, cheap], 'cheap')[0].id).toBe('cheap');
  });
});
