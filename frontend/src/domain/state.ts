// @ts-nocheck — ported prototype data/logic; typed loosely on purpose.
import { uid } from '../lib/text';

export const newConv = (vehicle = {}) => ({ id: uid(), title: '', createdAt: Date.now(), messages: [], vehicle, trace: [], lastResults: [], diagnosis: null });
export const emptyQuote = () => ({ items: [], shipping: '', status: 'draft', no: null, date: null, expiresAt: null, vehicle: null });
export function initialState() {
  const c = newConv();
  return {
    page: 'dashboard', lang: 'ar', convs: [c], activeId: c.id, draft: '', dashDraft: '', busy: false, run: null,
    vehicles: [], quotes: [], quote: emptyQuote(), products: {}, deleteProductId: null,
    quoteTrace: [], graphView: 'customer', wfTheme: 'dark', inspTab: 'summary', selRun: null, view: null, panning: false, stream: null, streamConv: null, panelPref: null, vat: 15, sort: 'compat', compare: [], selNode: 'intent_detection',
    customer: { name: '', phone: '', city: 'الرياض', email: '' },
    company: { name: 'AutoParts AI', cr: '—', vatNo: '—', address: 'الرياض، المملكة العربية السعودية' },
    memoryConsent: false,
    preferences: { preferredBrand: '', buyingPreference: '', notes: '' },
    conversationMemory: null, memoryLoading: false, confirmMemoryClear: false,
  };
}
// Settings row persisted in Postgres (everything else lives in its own table).
export const SETTINGS_KEYS = ['page', 'lang', 'activeId', 'quote', 'quoteTrace', 'vat', 'customer', 'company', 'memoryConsent', 'preferences', 'sort', 'compare', 'selNode', 'graphView', 'wfTheme'];
