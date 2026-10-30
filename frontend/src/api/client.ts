// Thin client for the Express API (server/index.ts). Every call throws on a non-2xx response.
async function call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    cache: path === '/api/health' ? 'no-store' : undefined,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  health: () => call('GET', '/api/health'),
  loadState: () => call('GET', '/api/state'),
  plan: (body: unknown) => call('POST', '/api/plan', body).then(r => r.plan),
  search: (body: unknown) => call('POST', '/api/search', body),
  startAgentRun: (body: unknown) => call<{ runId: string; threadId: string; eventsUrl: string }>('POST', '/api/agent/runs', body),
  cancelAgentRun: (runId: string) => call('POST', `/api/agent/runs/${encodeURIComponent(runId)}/cancel`),
  streamAgentRun: (eventsUrl: string, onEvent: (event: any) => void, onError: (error: Error) => void) => {
    const source = new EventSource(eventsUrl);
    const eventTypes = ['graph_started', 'context_compacted', 'node_started', 'node_completed', 'node_failed', 'tool_started', 'tool_completed', 'waiting_for_user', 'route_selected', 'graph_completed', 'graph_failed'];
    for (const type of eventTypes) source.addEventListener(type, raw => {
      try { onEvent(JSON.parse((raw as MessageEvent).data)); }
      catch { onError(new Error('Invalid agent event')); }
    });
    source.onerror = () => { if (source.readyState === EventSource.CLOSED) onError(new Error('Agent event stream closed')); };
    return () => source.close();
  },
  saveSettings: (data: unknown) => call('PUT', '/api/settings', data),
  saveVehicles: (list: unknown[]) => call('PUT', '/api/vehicles', list),
  verifyVin: (vin: string) => call('POST', '/api/vehicles/verify-vin', { vin }),
  saveConversation: (conv: { id: string }) => call('PUT', `/api/conversations/${encodeURIComponent(conv.id)}`, conv),
  getConversationMemory: (id: string) => call('GET', `/api/conversations/${encodeURIComponent(id)}/memory`),
  clearConversationMemory: (id: string) => call('DELETE', `/api/conversations/${encodeURIComponent(id)}/memory`),
  saveQuotation: (q: unknown) => call('POST', '/api/quotations', q),
  quotationPdfUrl: (no: string) => `/api/quotations/${encodeURIComponent(no)}/pdf`,
  reset: () => call('POST', '/api/reset'),
};
