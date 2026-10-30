import { agentRunsRepo } from '../../repositories/index.js';

export type AgentEventType =
  | 'graph_started' | 'context_compacted' | 'node_started' | 'node_completed' | 'node_failed'
  | 'tool_started' | 'tool_completed' | 'waiting_for_user'
  | 'route_selected' | 'graph_completed' | 'graph_failed';

export interface AgentEvent {
  runId: string;
  threadId: string;
  sequence: number;
  timestamp: string;
  type: AgentEventType;
  nodeId?: string;
  durationMs?: number;
  data?: unknown;
}

type Listener = (event: AgentEvent) => void;
type RunChannel = { ownerId: string; events: AgentEvent[]; listeners: Set<Listener>; sequence: number; closed: boolean };
const channels = new Map<string, RunChannel>();

export function createRunChannel(runId: string, ownerId: string, initialSequence = 0) {
  const current = channels.get(runId);
  if (current?.ownerId === ownerId) return;
  channels.set(runId, { ownerId, events: [], listeners: new Set(), sequence: initialSequence, closed: false });
}

export function getRunEvents(runId: string, ownerId: string) {
  const channel = channels.get(runId);
  return channel?.ownerId === ownerId ? channel.events : [];
}

export function hasRunChannel(runId: string, ownerId: string) {
  return channels.get(runId)?.ownerId === ownerId;
}

export function subscribeToRun(runId: string, ownerId: string, listener: Listener) {
  const channel = channels.get(runId);
  if (!channel || channel.ownerId !== ownerId) return null;
  channel.listeners.add(listener);
  return () => channel.listeners.delete(listener);
}

export async function emitAgentEvent(event: Omit<AgentEvent, 'sequence' | 'timestamp'>) {
  const channel = channels.get(event.runId);
  if (!channel) return;
  const full: AgentEvent = { ...event, sequence: ++channel.sequence, timestamp: new Date().toISOString() };
  channel.events.push(full);
  if (full.type === 'graph_completed' || full.type === 'graph_failed') channel.closed = true;
  for (const listener of channel.listeners) listener(full);
  await agentRunsRepo.addEvent(full.runId, full.sequence, full.type, full.nodeId ?? null, full);
}
