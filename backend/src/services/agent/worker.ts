import { agentRunsRepo } from '../../repositories/index.js';
import { createRunChannel, emitAgentEvent } from './events.js';
import { invokeAgentGraph } from './graphV2.js';
import { finishRunControl, getRunSignal, isRunCancelled, startRunControl } from './runControl.js';
import { prepareConversationContext } from '../memory/conversationMemory.js';

let timer: NodeJS.Timeout | null = null;
let working = false;

async function executeNext() {
  if (working) return;
  working = true;
  try {
    const run = await agentRunsRepo.claimNext();
    if (!run) return;
    const { id: runId, owner_id: ownerId, thread_id: threadId, input } = run;
    const previousSequence = await agentRunsRepo.maxEventSequence(runId);
    createRunChannel(runId, ownerId, previousSequence);
    startRunControl(runId, ownerId);
    await emitAgentEvent({ runId, threadId, type: 'graph_started', data: { messageCount: input.messages.length, resumed: previousSequence > 0 } });
    try {
      const contextStarted = performance.now();
      await emitAgentEvent({ runId, threadId, type: 'node_started', nodeId: 'context_compaction' });
      const prepared = await prepareConversationContext({ ownerId, conversationId: threadId, messages: input.messages, known: input.known, preferences: input.preferences ?? {}, lang: input.lang, signal: getRunSignal(runId) });
      const contextDurationMs = Math.round(performance.now() - contextStarted);
      await emitAgentEvent({ runId, threadId, type: 'context_compacted', nodeId: 'context_compaction', durationMs: contextDurationMs, data: prepared.stats });
      await emitAgentEvent({ runId, threadId, type: 'node_completed', nodeId: 'context_compaction', durationMs: contextDurationMs, data: prepared.stats });
      const state = await invokeAgentGraph({ ownerId, runId, threadId, messages: prepared.messages, memory: prepared.memory, known: input.known, preferences: input.preferences ?? {}, lang: input.lang, partTypes: input.partTypes });
      const result = state.result ?? { plan: state.plan, vehicle: state.vehicle, products: state.products };
      if ((await agentRunsRepo.get(ownerId, runId))?.status === 'cancelled') {
        await emitAgentEvent({ runId, threadId, type: 'graph_failed', data: { error: 'Cancelled by user', cancelled: true } });
        return;
      }
      await agentRunsRepo.complete(ownerId, runId, result);
      await emitAgentEvent({ runId, threadId, type: 'graph_completed', data: result });
    } catch (error) {
      const cancelled = isRunCancelled(runId);
      const message = cancelled ? 'Cancelled by user' : error instanceof Error ? error.message : String(error);
      if (!cancelled) await agentRunsRepo.fail(ownerId, runId, message);
      await emitAgentEvent({ runId, threadId, type: 'graph_failed', data: { error: message, cancelled } });
    } finally {
      finishRunControl(runId);
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'agent_worker_error', error: error instanceof Error ? error.message : String(error) }));
  } finally {
    working = false;
  }
}

export function startAgentWorker() {
  if (timer) return;
  timer = setInterval(() => void executeNext(), 500);
  timer.unref();
  void executeNext();
}

export function wakeAgentWorker() { void executeNext(); }
export function stopAgentWorker() { if (timer) clearInterval(timer); timer = null; }
