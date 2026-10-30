import { END, START, StateGraph, StateSchema } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import type { Lang, Listing, Vehicle } from '../../types.js';
import { createPlan, type ChatMessage } from '../llm/openai.js';
import { matchesVehicleYear, searchParts, type SearchInput } from '../search/searchParts.js';
import { emitAgentEvent } from './events.js';
import { getRunSignal } from './runControl.js';
import { searchAuthorizedCatalog } from '../catalog/authorizedCatalog.js';

const GraphState = new StateSchema({
  ownerId: z.string(), runId: z.string(), threadId: z.string(), messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
  memory: z.object({ summary: z.string(), facts: z.record(z.string(), z.unknown()) }), known: z.custom<Vehicle>(), preferences: z.record(z.string(), z.unknown()).default({}), lang: z.enum(['ar', 'en']), partTypes: z.array(z.string()),
  plan: z.any().optional(), vehicle: z.custom<Vehicle>().optional(), missingFields: z.array(z.string()).default([]), diagnosis: z.any().optional(),
  searchInput: z.any().optional(), products: z.array(z.custom<Listing>()).default([]), searchMeta: z.any().optional(), result: z.any().optional(),
});
type State = typeof GraphState.State;

const mergeVehicle = (known: Vehicle, extracted: Vehicle = {}) => Object.fromEntries(Object.entries({ ...known, ...Object.fromEntries(Object.entries(extracted).filter(([, value]) => value != null && value !== '')) }).filter(([, value]) => value != null)) as Vehicle;

function instrument<T extends Partial<State>>(nodeId: string, action: (state: State) => Promise<T> | T) {
  return async (state: State): Promise<T> => {
    const started = performance.now();
    await emitAgentEvent({ runId: state.runId, threadId: state.threadId, type: 'node_started', nodeId });
    try {
      const update = await action(state);
      await emitAgentEvent({ runId: state.runId, threadId: state.threadId, type: 'node_completed', nodeId, durationMs: Math.round(performance.now() - started), data: summarize(nodeId, update) });
      return update;
    } catch (error) {
      await emitAgentEvent({ runId: state.runId, threadId: state.threadId, type: 'node_failed', nodeId, durationMs: Math.round(performance.now() - started), data: { error: error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  };
}

function summarize(nodeId: string, update: Partial<State>) {
  if (nodeId === 'intent_detection') return { intent: update.plan?.intent, needsFollowUp: update.plan?.needsFollowUp };
  if (nodeId === 'vehicle_extraction') return { vehicle: update.vehicle };
  if (nodeId === 'missing_information') return { missingFields: update.missingFields };
  if (nodeId === 'automotive_diagnosis') return { causes: update.diagnosis?.causes?.length ?? 0, safety: update.diagnosis?.safety ?? null };
  if (nodeId === 'search_query_generation') return update.searchInput;
  if (nodeId.includes('search')) return update.searchMeta ?? { count: update.products?.length ?? 0 };
  if (['product_normalization', 'duplicate_detection', 'compatibility_verification'].includes(nodeId)) return { count: update.products?.length ?? 0 };
  if (nodeId === 'product_ranking' || nodeId === 'product_recommendations') return { productIds: update.products?.map(item => item.id) ?? update.result?.products?.map((item: Listing) => item.id) ?? [] };
  if (nodeId === 'followup_questions') return { question: update.result?.plan?.followUpQuestion ?? null };
  return update.result ? { ready: true } : {};
}

export const selectRoute = (plan: any) => plan?.intent === 'quote' ? 'quotation_management' : plan?.needsFollowUp ? 'followup_questions' : plan?.search ? 'search_query_generation' : 'respond';
const afterMissing = (state: State) => state.plan?.intent === 'quote' ? 'quotation_management' : state.plan?.diagnosis ? 'automotive_diagnosis' : selectRoute(state.plan);
const chooseProvider = () => env.SERPAPI_API_KEY ? 'google_shopping_search' : 'tavily_fallback_search';
const afterShopping = (state: State) => state.products.length < 4 && env.TAVILY_API_KEY ? 'tavily_fallback_search' : 'product_normalization';
const retryTransient = (error: unknown) => !/api key|invalidated|authentication|unauthorized|forbidden/i.test(error instanceof Error ? error.message : String(error));
const checkpointer = new PostgresSaver(pool);
let compiled: Promise<ReturnType<typeof buildGraph>> | null = null;

function buildGraph() {
  return new StateGraph(GraphState)
    .addNode('intent_detection', instrument('intent_detection', async state => ({ plan: await createPlan({ messages: state.messages as ChatMessage[], memory: state.memory, known: state.known, preferences: state.preferences, lang: state.lang as Lang, partTypes: state.partTypes, signal: getRunSignal(state.runId) }) })), { retryPolicy: { maxAttempts: 2, initialInterval: 500, retryOn: retryTransient } })
    .addNode('vehicle_extraction', instrument('vehicle_extraction', state => ({ vehicle: mergeVehicle(state.known, state.plan?.vehicle ?? {}) })))
    .addNode('missing_information', instrument('missing_information', state => ({ missingFields: state.plan?.search ? ['make', 'model', 'year'].filter(key => !(state.vehicle as any)?.[key]) : [] })))
    .addNode('automotive_diagnosis', instrument('automotive_diagnosis', state => ({ diagnosis: state.plan?.diagnosis ?? null })))
    .addNode('followup_questions', instrument('followup_questions', state => ({ result: { plan: state.plan, vehicle: state.vehicle, products: [], responseType: 'followup' } })))
    .addNode('respond', instrument('respond', state => ({ result: { plan: state.plan, vehicle: state.vehicle, products: [], responseType: 'message' } })))
    .addNode('search_query_generation', instrument('search_query_generation', state => ({ searchInput: { ownerId: state.ownerId, vehicle: state.vehicle, partTypes: state.plan.search.partTypes, termsAr: state.plan.search.termsAr, termsEn: state.plan.search.termsEn } })))
    .addNode('saudi_merchant_catalog_search', instrument('saudi_merchant_catalog_search', async state => {
      try {
        const response = await searchAuthorizedCatalog({ vehicle: state.vehicle ?? state.known, partTypes: state.plan.search.partTypes, signal: getRunSignal(state.runId) });
        const products = response.products.filter(product => matchesVehicleYear(product, state.vehicle ?? state.known));
        return { products, searchMeta: { provider: 'authorized_catalog', configured: response.configured, count: products.length, retrievedAt: new Date().toISOString() } };
      } catch (error) {
        return { products: [], searchMeta: { provider: 'authorized_catalog', configured: true, count: 0, error: error instanceof Error ? error.message : 'Catalog unavailable' } };
      }
    }))
    .addNode('google_shopping_search', instrument('google_shopping_search', state => providerSearch(state, 'serpapi')), { retryPolicy: { maxAttempts: 2, initialInterval: 700, retryOn: retryTransient } })
    .addNode('tavily_fallback_search', instrument('tavily_fallback_search', state => providerSearch(state, 'tavily')), { retryPolicy: { maxAttempts: 2, initialInterval: 700, retryOn: retryTransient } })
    .addNode('product_normalization', instrument('product_normalization', state => ({ products: state.products.map(product => ({ ...product, ar: String(product.ar), en: String(product.en), price: typeof product.price === 'number' ? product.price : null })) })))
    .addNode('duplicate_detection', instrument('duplicate_detection', state => ({ products: [...new Map(state.products.map(product => [product.url, product])).values()] })))
    .addNode('compatibility_verification', instrument('compatibility_verification', state => ({ products: state.products.filter(product => matchesVehicleYear(product, state.vehicle ?? state.known)) })))
    .addNode('product_ranking', instrument('product_ranking', state => ({ products: rankProducts(state.products, state.plan?.preference) })))
    .addNode('product_recommendations', instrument('product_recommendations', state => ({ result: { plan: state.plan, vehicle: state.vehicle, products: state.products.slice(0, 15), searchMeta: state.searchMeta, responseType: 'products' } })))
    .addNode('quotation_management', instrument('quotation_management', state => ({ result: { plan: state.plan, vehicle: state.vehicle, products: [], responseType: 'quote', requiresConfirmation: true } })))
    .addEdge(START, 'intent_detection').addEdge('intent_detection', 'vehicle_extraction').addEdge('vehicle_extraction', 'missing_information')
    .addConditionalEdges('missing_information', afterMissing, { automotive_diagnosis: 'automotive_diagnosis', followup_questions: 'followup_questions', search_query_generation: 'search_query_generation', quotation_management: 'quotation_management', respond: 'respond' })
    .addConditionalEdges('automotive_diagnosis', state => selectRoute(state.plan), { followup_questions: 'followup_questions', search_query_generation: 'search_query_generation', quotation_management: 'quotation_management', respond: 'respond' })
    .addEdge('search_query_generation', 'saudi_merchant_catalog_search')
    .addConditionalEdges('saudi_merchant_catalog_search', chooseProvider, { google_shopping_search: 'google_shopping_search', tavily_fallback_search: 'tavily_fallback_search' })
    .addConditionalEdges('google_shopping_search', afterShopping, { tavily_fallback_search: 'tavily_fallback_search', product_normalization: 'product_normalization' })
    .addEdge('tavily_fallback_search', 'product_normalization').addEdge('product_normalization', 'duplicate_detection').addEdge('duplicate_detection', 'compatibility_verification')
    .addEdge('compatibility_verification', 'product_ranking').addEdge('product_ranking', 'product_recommendations').addEdge('product_recommendations', END)
    .addEdge('followup_questions', END).addEdge('respond', END).addEdge('quotation_management', END).compile({ checkpointer });
}

async function providerSearch(state: State, provider: 'serpapi' | 'tavily'): Promise<Partial<State>> {
  const input = { ...(state.searchInput as SearchInput), provider, signal: getRunSignal(state.runId) };
  const nodeId = provider === 'serpapi' ? 'google_shopping_search' : 'tavily_fallback_search';
  await emitAgentEvent({ runId: state.runId, threadId: state.threadId, type: 'tool_started', nodeId, data: { provider, vehicle: input.vehicle, partTypes: input.partTypes } });
  const response = await searchParts(input);
  const products = [...new Map([...state.products, ...response.products].map(product => [product.url, product])).values()];
  await emitAgentEvent({ runId: state.runId, threadId: state.threadId, type: 'tool_completed', nodeId, data: { provider, count: response.products.length } });
  return { products, searchMeta: meta(response.provider, products, response.queries) };
}
const meta = (provider: string, products: Listing[], queries: string[]) => ({ provider, count: products.length, retrievedAt: new Date().toISOString(), queries, items: products.map(item => ({ partNo: item.partNo, seller: item.seller.en, url: item.url })) });
const isOemListing = (product: Listing) => /\b(?:genuine|oem|original)\b|أصلي|اصلية|وكالة/i.test(`${product.en} ${product.ar} ${product.brand.en}`);
export const productQuality = (product: Listing) =>
  (product.partNo ? 4 : 0)
  + (product.price != null ? 3 : 0)
  + (product.image ? 2 : 0)
  + (product.avail && !/unknown/i.test(product.avail) ? 2 : 0)
  + (product.source === 'serpapi' ? 1 : 0)
  + (product.source === 'authorized_catalog' ? 3 : 0)
  + (isOemListing(product) ? 1 : 0);
export const rankProducts = (products: Listing[], preference?: 'oem' | 'cheap' | null) => [...products].sort((a, b) => {
  if (preference === 'oem' && isOemListing(a) !== isOemListing(b)) return isOemListing(a) ? -1 : 1;
  if (preference === 'cheap' && a.price != null && b.price != null && a.price !== b.price) return a.price - b.price;
  return productQuality(b) - productQuality(a) || (a.price ?? Infinity) - (b.price ?? Infinity);
});
async function getGraph() { compiled ??= checkpointer.setup().then(() => buildGraph()); return compiled; }
export interface AgentGraphInput { ownerId: string; runId: string; threadId: string; messages: ChatMessage[]; memory: { summary: string; facts: Record<string, unknown> }; known: Vehicle; preferences: Record<string, unknown>; lang: Lang; partTypes: string[] }
export async function invokeAgentGraph(input: AgentGraphInput) {
  const graph = await getGraph();
  const cleanRunState = { ...input, plan: undefined, vehicle: undefined, missingFields: [], diagnosis: undefined, searchInput: undefined, products: [], searchMeta: undefined, result: undefined };
  return graph.invoke(cleanRunState, { configurable: { thread_id: `${input.ownerId}:${input.threadId}` }, recursionLimit: 32, signal: getRunSignal(input.runId) });
}
export async function deleteGraphThread(ownerId: string, threadId: string) { await checkpointer.deleteThread(`${ownerId}:${threadId}`); }
