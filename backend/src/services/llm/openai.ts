import { env } from '../../config/env.js';
import { notConfigured, upstreamError } from '../../lib/errors.js';
import type { Lang, Vehicle } from '../../types.js';
import { buildPlanPrompt } from './planPrompt.js';
import { validateAgentPlan, type AgentPlan } from './planSchema.js';
import { timeoutSignal } from '../../lib/signals.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const TIMEOUT_MS = 30_000;
const HEALTH_TTL_MS = 60_000;
const UNREACHABLE_TTL_MS = 10_000;
let healthCache: { checkedAt: number; value: { ok: boolean; status: 'ready' | 'missing' | 'invalid' | 'unreachable' } } | null = null;
const cacheHealth = (value: { ok: boolean; status: 'ready' | 'missing' | 'invalid' | 'unreachable' }) => {
  healthCache = { checkedAt: Date.now(), value };
  return value;
};

/** Verifies that the configured key can access the selected model; cached to avoid billing-free but noisy checks. */
export async function getOpenAiHealth() {
  if (!env.OPENAI_API_KEY) return { ok: false, status: 'missing' as const };
  const ttl = healthCache?.value.status === 'unreachable' ? UNREACHABLE_TTL_MS : HEALTH_TTL_MS;
  if (healthCache && Date.now() - healthCache.checkedAt < ttl) return healthCache.value;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(env.OPENAI_MODEL)}`, {
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(7_000),
      });
      if (response.ok) return cacheHealth({ ok: true, status: 'ready' });
      if (response.status === 401 || response.status === 403) return cacheHealth({ ok: false, status: 'invalid' });
    } catch {
      // A second probe distinguishes a brief network wobble from an outage.
    }
  }
  return cacheHealth({ ok: false, status: 'unreachable' });
}

export async function requestOpenAiJson(messages: ChatMessage[], systemPrompt: string, signal?: AbortSignal, maxCompletionTokens = 1400) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      response_format: { type: 'json_object' },
      max_completion_tokens: maxCompletionTokens,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
    signal: timeoutSignal(TIMEOUT_MS, signal),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw upstreamError(body?.error?.message ?? `OpenAI HTTP ${res.status}`);
  cacheHealth({ ok: true, status: 'ready' });
  const text: string = body.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw upstreamError('Model returned no JSON');
  return text;
}

/** Asks OpenAI for a strictly validated plan and performs one schema-repair call if needed. */
export async function createPlan(input: { messages: ChatMessage[]; memory?: { summary: string; facts: Record<string, unknown> }; known: Vehicle; lang: Lang; partTypes: string[]; preferences?: Record<string, unknown>; signal?: AbortSignal }): Promise<AgentPlan> {
  if (!env.OPENAI_API_KEY) throw notConfigured('OPENAI_API_KEY');
  const systemPrompt = buildPlanPrompt(input.known, input.lang, input.partTypes, input.preferences, input.memory);
  let text = await requestOpenAiJson(input.messages, systemPrompt, input.signal);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return validateAgentPlan(JSON.parse(text), input.partTypes);
    } catch (error) {
      if (attempt === 1) throw upstreamError(`Model plan failed schema validation: ${error instanceof Error ? error.message : String(error)}`);
      text = await requestOpenAiJson([
        ...input.messages,
        { role: 'assistant', content: text },
        { role: 'user', content: `The previous JSON failed validation (${error instanceof Error ? error.message : String(error)}). Return a corrected JSON object only.` },
      ], systemPrompt, input.signal);
    }
  }
  throw upstreamError('Model plan validation failed');
}
