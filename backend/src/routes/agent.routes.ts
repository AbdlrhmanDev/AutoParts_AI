import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { agentRateLimit, asyncHandler, costlyIpRateLimit, requireDatabase } from '../middleware/index.js';
import { agentRunsRepo, conversationsRepo } from '../repositories/index.js';
import { createRunChannel, emitAgentEvent, getRunEvents, hasRunChannel, subscribeToRun, type AgentEvent } from '../services/agent/events.js';
import { createPlan } from '../services/llm/openai.js';
import { searchParts } from '../services/search/searchParts.js';
import { AgentRunRequestSchema, PlanRequestSchema, SearchRequestSchema } from './schemas.js';
import { cancelRun } from '../services/agent/runControl.js';
import { wakeAgentWorker } from '../services/agent/worker.js';
import { selectRecentMessages } from '../services/memory/conversationMemory.js';
import { env } from '../config/env.js';

// Agent tools: the LLM plan and the web part search.
export const agentRouter = Router();
agentRouter.use(['/agent', '/plan', '/search'], costlyIpRateLimit, agentRateLimit);

agentRouter.post(
  '/agent/runs',
  requireDatabase,
  asyncHandler(async (req, res) => {
    const parsed = AgentRunRequestSchema.parse(req.body);
    const runId = randomUUID();
    const threadId = parsed.threadId ?? randomUUID();
    const saved = await conversationsRepo.get(req.ownerId, threadId);
    const persistedMessages = Array.isArray(saved?.messages) ? saved.messages.flatMap((message: any) => {
      const role = message?.role === 'user' ? 'user' : message?.role === 'agent' || message?.role === 'assistant' ? 'assistant' : null;
      const content = typeof message?.text === 'string' ? message.text.trim() : typeof message?.content === 'string' ? message.content.trim() : '';
      return role && content ? [{ role, content: content.slice(0, 8000) }] : [];
    }).slice(-1000) : [];
    let overlap = Math.min(persistedMessages.length, parsed.messages.length);
    while (overlap > 0 && !parsed.messages.slice(0, overlap).every((message, index) => {
      const savedMessage = persistedMessages[persistedMessages.length - overlap + index];
      return savedMessage.role === message.role && savedMessage.content === message.content;
    })) overlap--;
    const messages = persistedMessages.length ? [...persistedMessages, ...parsed.messages.slice(overlap)] : parsed.messages;
    const input = { ...parsed, messages };
    createRunChannel(runId, req.ownerId);
    await agentRunsRepo.create(req.ownerId, runId, threadId, input);
    res.status(202).json({ runId, threadId, eventsUrl: `/api/agent/runs/${runId}/events` });
    wakeAgentWorker();
  }),
);

agentRouter.post(
  '/agent/runs/:runId/cancel',
  requireDatabase,
  asyncHandler(async (req, res) => {
    const persisted = await agentRunsRepo.cancel(req.ownerId, req.params.runId);
    const active = cancelRun(req.params.runId, req.ownerId);
    if (!persisted && !active) return res.status(404).json({ error: 'Run not found or already finished' });
    const run = await agentRunsRepo.get(req.ownerId, req.params.runId);
    if (run) await emitAgentEvent({ runId: req.params.runId, threadId: run.thread_id, type: 'graph_failed', data: { error: 'Cancelled by user', cancelled: true } });
    res.json({ ok: true });
  }),
);

agentRouter.get('/agent/runs/:runId/events', asyncHandler(async (req, res) => {
  const runId = req.params.runId;
  const persistedRun = await agentRunsRepo.get(req.ownerId, runId);
  if (!persistedRun) return res.status(404).json({ error: 'Run not found' });
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const afterSequence = Math.max(0, Number(req.headers['last-event-id']) || 0);
  const sent = new Set<number>();
  const write = (event: AgentEvent) => {
    if (sent.has(event.sequence)) return;
    sent.add(event.sequence);
    res.write(`id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    if (event.type === 'graph_completed' || event.type === 'graph_failed') res.end();
  };
  (await agentRunsRepo.listEvents(req.ownerId, runId, afterSequence)).forEach(write);
  if (['completed', 'failed', 'cancelled'].includes(persistedRun.status)) return res.end();
  if (!hasRunChannel(runId, req.ownerId)) createRunChannel(runId, req.ownerId, Math.max(0, ...sent));
  const unsubscribe = subscribeToRun(runId, req.ownerId, write);
  if (!unsubscribe) return res.end();
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15_000);
  let polling = false;
  const poll = setInterval(async () => {
    if (polling || res.writableEnded) return;
    polling = true;
    try {
      const last = sent.size ? Math.max(...sent) : afterSequence;
      (await agentRunsRepo.listEvents(req.ownerId, runId, last)).forEach(write);
      const current = await agentRunsRepo.get(req.ownerId, runId);
      if (current && ['completed', 'failed', 'cancelled'].includes(current.status) && !res.writableEnded) res.end();
    } finally { polling = false; }
  }, 750);
  req.on('close', () => { clearInterval(heartbeat); clearInterval(poll); unsubscribe(); });
  getRunEvents(runId, req.ownerId).filter(event => event.sequence > afterSequence).forEach(write);
}));

agentRouter.post(
  '/plan',
  asyncHandler(async (req, res) => {
    const input = PlanRequestSchema.parse(req.body);
    const messages = selectRecentMessages(input.messages, env.CONTEXT_TOKEN_BUDGET).messages;
    res.json({ plan: await createPlan({ ...input, messages }) });
  }),
);

agentRouter.post(
  '/search',
  requireDatabase,
  asyncHandler(async (req, res) => {
    const input = SearchRequestSchema.parse(req.body);
    res.json(await searchParts({ ...input, ownerId: req.ownerId }));
  }),
);
