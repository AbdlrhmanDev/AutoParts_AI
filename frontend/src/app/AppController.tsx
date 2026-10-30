// @ts-nocheck — ported from the prototype's class component and loosely typed on purpose.
// Owns app state, the agent run (plan → search → rank), quote actions, persistence, and builds the view-model for AppView.
import React from 'react';
import { NODES, MAKE_AR, MODEL_AR, PART_TYPES, ICONS, WF_ICON, INTENT_L, S } from '../domain/constants';
import { T, WF_T } from '../domain/i18n';
import { GW, GH, WF_POS, WF_EDGES, wfPos, edgeGeom, deriveExpected, expectedFor, custState } from '../domain/workflow';
import { newConv, initialState, SETTINGS_KEYS } from '../domain/state';
import { vComplete, verify, CRANK, rank, priceOf, isOem, cleanVehicle } from '../domain/compat';
import { uid, sleep, latin } from '../lib/text';
import { sanitize, safeHref } from '../lib/sanitize';
import { api } from '../api/client';
import { AppView } from './AppView';

const errorText = error => String(error?.message || error || '');
const isDatabaseError = error => /database|postgres|docker compose|ECONNREFUSED[^\n]*5442/i.test(errorText(error));
const isOpenAiAuthError = error => /api key|invalidated|authentication|unauthorized|incorrect api key/i.test(errorText(error));
const isOpenAiError = error => /openai|language model|llm/i.test(errorText(error));
const isBackendConnectionError = error => /failed to fetch|networkerror|event stream closed|load failed/i.test(errorText(error));

export class AppController extends React.Component {
  state = { ...initialState(), loaded: false, dbError: false, health: { llm: false, llmStatus: 'unknown', model: '', search: false, db: false }, vw: typeof window !== 'undefined' ? window.innerWidth : 1400 };
  scrollRef = React.createRef();
  pending = { settings: false, vehicles: false, convs: new Set() };

  refreshHealth = async () => {
    try {
      const health = await api.health();
      this.setState({ health, dbError: !health.db });
      return health;
    } catch { return null; }
  };

  componentDidMount() {
    this.onResize = () => this.setState({ vw: window.innerWidth }); window.addEventListener('resize', this.onResize);
    this.refreshHealth();
    this.healthTimer = setInterval(this.refreshHealth, 10_000);
    api.loadState().then(data => {
      const s = data.settings || {}; const convs = data.convs && data.convs.length ? data.convs : [newConv()];
      const patch = {}; SETTINGS_KEYS.forEach(k => { if (s[k] !== undefined) patch[k] = s[k]; });
      if (!convs.some(c => c.id === patch.activeId)) patch.activeId = convs[0].id;
      const products = {}; (data.products || []).forEach(p => { products[p.id] = p; });
      this.setState({ ...patch, convs, vehicles: data.vehicles || [], quotes: data.quotes || [], products, loaded: true, dbError: false });
    }).catch(error => this.setState({ loaded: true, dbError: isDatabaseError(error) }));
  }
  componentWillUnmount() { window.removeEventListener('resize', this.onResize); clearTimeout(this.saveTimer); clearInterval(this.healthTimer); }

  componentDidUpdate(_, ps) {
    const s = this.state;
    if (s.loaded && ps.loaded) {
      if (SETTINGS_KEYS.some(k => ps[k] !== s[k])) this.pending.settings = true;
      if (ps.vehicles !== s.vehicles) this.pending.vehicles = true;
      if (ps.convs !== s.convs) s.convs.forEach(c => { if (!ps.convs.includes(c)) this.pending.convs.add(c.id); });
      if (this.pending.settings || this.pending.vehicles || this.pending.convs.size) { clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.flush(), 400); }
    }
    const el = this.scrollRef.current;
    if (el && (ps.convs !== s.convs || ps.busy !== s.busy || ps.page !== s.page || ps.stream !== s.stream)) el.scrollTop = el.scrollHeight;
  }

  async flush() {
    const s = this.state; const p = this.pending; this.pending = { settings: false, vehicles: false, convs: new Set() };
    const jobs = [];
    if (p.settings) { const o = {}; SETTINGS_KEYS.forEach(k => { o[k] = s[k]; }); jobs.push(api.saveSettings(o)); }
    if (p.vehicles) jobs.push(api.saveVehicles(s.vehicles));
    p.convs.forEach(id => { const c = s.convs.find(x => x.id === id); if (c) jobs.push(api.saveConversation(c)); });
    const res = await Promise.allSettled(jobs);
    const databaseFailed = res.some(r => r.status === 'rejected' && isDatabaseError(r.reason));
    if (databaseFailed !== this.state.dbError) this.setState({ dbError: databaseFailed });
  }

  t() { return T[this.state.lang]; }
  cur() { return this.state.convs.find(c => c.id === this.state.activeId) || this.state.convs[0]; }
  prod(id) { return this.state.products[id] || null; }
  updConv(fn, id) { const cid = id || this.state.activeId; this.setState(s => ({ convs: s.convs.map(c => c.id === cid ? fn(c) : c) })); }
  loc() { return this.state.lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB'; }
  money(n, lang) { const L = lang || this.state.lang; return new Intl.NumberFormat(L === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + (L === 'ar' ? ' ر.س' : ' SAR'); }
  vLabel(v, lang) {
    const L = lang || this.state.lang; if (!v || !v.make) return T[L].noVehicle;
    const mk = L === 'ar' ? (MAKE_AR[v.make] || v.make) : v.make; const md = v.model ? (L === 'ar' ? (MODEL_AR[v.model] || v.model) : v.model) : '';
    return [mk, md, v.year, v.trim, v.engine].filter(Boolean).join(' ');
  }

  startNew(vehicle, text) {
    const c = newConv(vehicle || {});
    this.setState(s => ({ convs: [c, ...s.convs].slice(0, 20), activeId: c.id, page: 'chat', run: null }), () => { if (text) this.send(text); });
  }

  async llmPlan(text, history, known) {
    const messages = history.filter(m => m.text).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    messages.push({ role: 'user', content: text });
    while (messages.length && messages[0].role !== 'user') messages.shift();
    const p = await api.plan({ messages, known: known || {}, lang: this.state.lang, partTypes: Object.keys(PART_TYPES) });
    if (p.search) p.search.partTypes = (p.search.partTypes || []).filter(x => PART_TYPES[x]);
    if (p.diagnosis && p.diagnosis.causes) p.diagnosis.causes = p.diagnosis.causes.map(c => ({ ...c, likelihood: ['high', 'medium', 'low'].includes(c.likelihood) ? c.likelihood : 'medium' }));
    return p;
  }

  canvasRef = el => {
    if (this.canvasEl === el) return;
    if (this.canvasEl) this.canvasEl.removeEventListener('wheel', this.onWheel);
    this.canvasEl = el;
    if (el) { el.addEventListener('wheel', this.onWheel, { passive: false }); setTimeout(() => { if (!this.state.view) this.fitView(); }, 40); }
  };
  fitView = () => { const el = this.canvasEl; if (!el || !el.clientWidth) return; const W = el.clientWidth, H = el.clientHeight; const k = Math.max(0.3, Math.min(1.1, (W - 56) / GW, (H - 90) / GH)); this.setState({ view: { k, x: (W - GW * k) / 2, y: (H - GH * k) / 2 + 20 } }); };
  zoomAt = (f, mx, my) => { const v = this.state.view || { x: 0, y: 0, k: 1 }; const k = Math.max(0.3, Math.min(2, v.k * f)); this.setState({ view: { k, x: mx - (mx - v.x) * k / v.k, y: my - (my - v.y) * k / v.k } }); };
  onWheel = e => { e.preventDefault(); const r = this.canvasEl.getBoundingClientRect(); this.zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top); };
  onPanStart = e => { if (e.target.closest && e.target.closest('[data-wf-node],[data-wf-ui]')) return; const v = this.state.view || { x: 0, y: 0, k: 1 }; this.pan = { sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y }; this.setState({ panning: true }); };
  onPanMove = e => { if (!this.pan) return; const v = this.state.view || { k: 1 }; this.setState({ view: { k: v.k, x: this.pan.vx + e.clientX - this.pan.sx, y: this.pan.vy + e.clientY - this.pan.sy } }); };
  onPanEnd = () => { if (this.pan) { this.pan = null; this.setState({ panning: false }); } };

  stopRun() {
    const ctx = this.ctx; if (!ctx || !this.state.busy) return;
    if (ctx.serverRunId) api.cancelAgentRun(ctx.serverRunId).catch(() => {});
    if (this.closeAgentStream) { this.closeAgentStream(); this.closeAgentStream = null; }
    this.runId = (this.runId || 0) + 1;
    ctx.steps.forEach(x => { if (x.status === 'running') { x.status = 'error'; x.output = { stopped: true }; } });
    this.finish(ctx.convId, { role: 'agent', text: (ctx.stream.text ? ctx.stream.text + '\n\n' : '') + this.t().stopped, retry: ctx.text, stopped: true }, ctx.steps, {});
  }

  async send(raw) {
    const text = String(raw ?? this.state.draft).trim();
    if (!text || this.state.busy) return;
    const rid = this.runId = (this.runId || 0) + 1;
    const alive = () => { if (rid !== this.runId) throw new Error('__stopped'); };
    const conv = this.cur(); const convId = conv.id; const history = conv.messages.slice(-10);
    this.updConv(c => ({ ...c, title: c.title || text.slice(0, 44), messages: [...c.messages, { id: uid(), role: 'user', text, ts: Date.now() }] }));
    const steps = []; const stream = { text: '', diagnosis: null, followUp: null, productIds: null, retrievedAt: null };
    const ctx = this.ctx = { convId, steps, stream, text, at: Date.now(), expected: ['understand'] };
    const runState = () => ({ steps: steps.map(x => ({ ...x })), expected: ctx.expected, at: ctx.at, text });
    const sync = () => { alive(); this.setState({ run: runState(), stream: { ...stream } }); };
    this.setState({ draft: '', dashDraft: '', busy: true, page: 'chat', streamConv: convId, selRun: null, run: runState(), stream: { ...stream } });
    try {
      const messages = history.filter(m => m.text).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
      messages.push({ role: 'user', content: text });
      while (messages.length && messages[0].role !== 'user') messages.shift();
      const run = await api.startAgentRun({ messages, known: conv.vehicle || {}, preferences: this.state.memoryConsent ? this.state.preferences : {}, lang: this.state.lang, partTypes: Object.keys(PART_TYPES), threadId: conv.id });
      ctx.serverRunId = run.runId;
      const final = await new Promise((resolve, reject) => {
        this.closeAgentStream = api.streamAgentRun(run.eventsUrl, event => {
          if (rid !== this.runId) return;
          if (event.type === 'node_started') {
            const retry = [...steps].reverse().find(item => item.id === event.nodeId && item.status === 'error');
            if (retry) {
              retry.retries = [...(retry.retries || []), retry.output].filter(Boolean);
              retry.status = 'running'; retry.ms = null; retry.output = null;
              retry.startedAt = Date.parse(event.timestamp); retry.attempts = (retry.attempts || 1) + 1;
            } else {
              steps.push({ id: event.nodeId, status: 'running', ms: null, input: { runId: event.runId }, output: null, startedAt: Date.parse(event.timestamp), attempts: 1, retries: [] });
            }
            // Reveal the active customer-facing phase as soon as its first node starts.
            // Previously `expected` stayed at only "understand" until the entire graph
            // finished, which made a live product search look frozen after understanding.
            ctx.expected = deriveExpected(steps);
            sync();
          } else if (event.type === 'node_completed' || event.type === 'node_failed') {
            const step = [...steps].reverse().find(item => item.id === event.nodeId && item.status === 'running');
            if (step) { step.status = event.type === 'node_failed' ? 'error' : 'done'; step.ms = event.durationMs ?? null; step.output = event.data ?? {}; sync(); }
          } else if (event.type === 'graph_completed') {
            this.closeAgentStream?.(); this.closeAgentStream = null; resolve(event.data);
          } else if (event.type === 'graph_failed') {
            this.closeAgentStream?.(); this.closeAgentStream = null; reject(new Error(event.data?.error || 'Agent run failed'));
          }
        }, reject);
      });
      alive();
      const plan = final.plan || {}; const vehicle = final.vehicle || conv.vehicle || {};
      const found = final.products || []; const searchMeta = final.searchMeta || {};
      if (found.length) this.setState(st => { const products = { ...st.products }; found.forEach(p => { products[p.id] = p; }); return { products }; });
      const results = found.length ? rank(found, vehicle).slice(0, 5).map(p => p.id) : null;
      const retrievedAt = searchMeta.retrievedAt ? Date.parse(searchMeta.retrievedAt) : null;
      stream.text = plan.reply || ''; stream.diagnosis = plan.diagnosis || null; stream.followUp = plan.followUpQuestion || null; stream.productIds = results; stream.retrievedAt = retrievedAt;
      ctx.expected = deriveExpected(steps);
      this.finish(convId, {
        role: 'agent', text: plan.reply || '', diagnosis: plan.diagnosis || null,
        followUp: plan.needsFollowUp ? plan.followUpQuestion : null, productIds: results,
        retrievedAt, source: searchMeta.provider || null, quick: plan.quickReplies, isQuote: plan.intent === 'quote',
      }, steps, { vehicle, diagnosis: plan.diagnosis || conv.diagnosis, lastResults: results || conv.lastResults });
    } catch (err) {
      if (String(err && err.message) === '__stopped') return;
      this.closeAgentStream?.(); this.closeAgentStream = null;
      const checkedHealth = await this.refreshHealth();
      const databaseFailure = isDatabaseError(err) || checkedHealth?.db === false;
      const invalidKey = isOpenAiAuthError(err) || checkedHealth?.llmStatus === 'invalid';
      const openAiFailure = !databaseFailure && (invalidKey || isOpenAiError(err) || checkedHealth?.llm === false);
      const backendFailure = !databaseFailure && !openAiFailure && isBackendConnectionError(err);
      if (databaseFailure) this.setState({ dbError: true });
      const message = databaseFailure ? this.t().dbError
        : invalidKey ? this.t().errInvalidKey
        : openAiFailure ? this.t().errLive
        : backendFailure ? this.t().errBackend
        : this.t().errAgent;
      this.finish(convId, { role: 'agent', text: message, isError: true, retry: text }, steps, {});
    }
  }

  finish(convId, msg, steps, patch) {
    const ctx = this.ctx || {};
    const route = steps.filter(x => x.status === 'done').map(x => x.id);
    const totalMs = steps.reduce((a, x) => a + (x.ms || 0), 0);
    const run = { id: uid(), at: ctx.at || Date.now(), text: ctx.text || '', steps: steps.map(x => ({ ...x, retrying: false })), expected: ctx.expected || ['understand'], totalMs, status: msg.stopped ? 'stopped' : steps.some(x => x.status === 'error') ? 'error' : 'done' };
    this.ctx = null;
    this.updConv(c => ({ ...c, ...patch, trace: run.steps, runs: [run, ...(c.runs || [])].slice(0, 12), messages: [...c.messages, { id: uid(), ts: Date.now(), route, totalMs, runId: run.id, ...msg }] }), convId);
    this.setState({ busy: false, run: null, stream: null, selRun: null, selNode: steps.length ? steps[steps.length - 1].id : 'intent' });
  }

  addToQuote(pid) {
    const p = this.prod(pid);
    this.setState(s => {
      const has = s.quote.items.find(i => i.pid === pid);
      if (!has && (!p || p.price === null)) return null;
      const items = has ? s.quote.items.filter(i => i.pid !== pid) : [...s.quote.items, { pid, qty: 1 }];
      return { quote: { ...s.quote, items, status: 'draft' } };
    });
  }
  removeProduct(pid) {
    const p = this.prod(pid);
    if (p) this.setState({ deleteProductId: pid });
  }
  cancelRemoveProduct = () => this.setState({ deleteProductId: null });
  confirmRemoveProduct = () => {
    const pid = this.state.deleteProductId;
    if (!pid) return;
    this.setState(s => ({
      deleteProductId: null,
      compare: s.compare.filter(id => id !== pid),
      convs: s.convs.map(c => c.id !== s.activeId ? c : ({
        ...c,
        lastResults: (c.lastResults || []).filter(id => id !== pid),
        messages: (c.messages || []).map(m => m.productIds
          ? { ...m, productIds: m.productIds.filter(id => id !== pid) }
          : m),
      })),
    }));
  }
  setQty(pid, d) { this.setState(s => ({ quote: { ...s.quote, status: 'draft', items: s.quote.items.map(i => i.pid === pid ? { ...i, qty: Math.max(1, i.qty + d) } : i) } })); }
  totals(lang) {
    const s = this.state; const sub = s.quote.items.reduce((a, i) => { const p = this.prod(i.pid); return a + (p && p.price !== null ? p.price * i.qty : 0); }, 0);
    const vat = sub * (+s.vat || 0) / 100; const shipN = s.quote.shipping === '' ? null : +s.quote.shipping || 0;
    return { subtotalN: sub, subtotal: this.money(sub, lang), vat: this.money(vat, lang), shipping: shipN === null ? (lang === 'ar' || (!lang && s.lang === 'ar') ? 'غير محدد' : 'Not set') : this.money(shipN, lang), totalN: sub + vat + (shipN || 0), total: this.money(sub + vat + (shipN || 0), lang) };
  }
  confirmQuote() {
    const s = this.state; if (!s.quote.items.length) return;
    const now = new Date(); const no = `AP-${now.getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const veh = this.cur().vehicle; const tot = this.totals('ar');
    const items = s.quote.items.map(i => { const p = this.prod(i.pid); return { pid: i.pid, qty: i.qty, title: p ? p.ar : '', partNo: p ? p.partNo : null, unitPrice: p ? p.price : null, seller: p ? p.seller.en : null, url: p ? p.url : null, source: p ? p.source : null, retrievedAt: p ? p.retrievedAt : null }; });
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const record = { no, date: now.toISOString(), expiresAt, totalN: tot.totalN, count: s.quote.items.length, vehicle: veh, items, vat: +s.vat || 0, shipping: s.quote.shipping === '' ? null : +s.quote.shipping, customer: s.customer, company: s.company };
    api.saveQuotation(record).catch(error => { if (isDatabaseError(error)) this.setState({ dbError: true }); });
    this.setState(st => ({
      quote: { ...st.quote, status: 'confirmed', no, date: now.toISOString(), expiresAt, vehicle: veh },
      quotes: [{ no, date: record.date, totalN: tot.totalN, count: record.count, vehicle: veh }, ...st.quotes].slice(0, 10),
      quoteTrace: [
        { id: 'quote', status: 'done', ms: 4, input: { items: st.quote.items, vatRate: st.vat, shipping: st.quote.shipping || null }, output: { quotationId: no, subtotal: tot.subtotalN, total: tot.totalN, currency: 'SAR', confirmedByUser: true } },
        { id: 'pdf', status: 'done', ms: 0, input: { quotationId: no }, output: { renderer: 'browser print', layout: 'A4, dir=rtl, IBM Plex Sans Arabic' } },
      ],
    }));
  }
  async resetAll() {
    try { await api.reset(); } catch (error) { if (isDatabaseError(error)) this.setState({ dbError: true }); return; }
    clearTimeout(this.saveTimer); this.pending = { settings: false, vehicles: false, convs: new Set() };
    this.setState({ ...initialState(), page: 'settings', loaded: true, dbError: false });
  }

  async loadConversationMemory() {
    const id = this.state.activeId;
    this.setState({ memoryLoading: true, confirmMemoryClear: false });
    try {
      const response = await api.getConversationMemory(id);
      if (this.state.activeId === id) this.setState({ conversationMemory: response.memory, memoryLoading: false });
    } catch { if (this.state.activeId === id) this.setState({ conversationMemory: null, memoryLoading: false }); }
  }

  async clearCurrentConversationMemory() {
    const id = this.state.activeId;
    try {
      await api.clearConversationMemory(id);
      if (this.state.activeId === id) this.setState({ conversationMemory: null, confirmMemoryClear: false });
    } catch (error) { if (isDatabaseError(error)) this.setState({ dbError: true }); }
  }

  renderVals() {
    const s = this.state; const L = s.lang; const t = T[L]; const conv = this.cur(); const veh = conv.vehicle || {};
    const go = page => () => this.setState({ page }, () => { if (page === 'settings') this.loadConversationMemory(); });
    const dark = (on) => ({ bg: on ? '#263140' : 'transparent', fg: on ? '#F8FAFC' : '#8B98A9' });
    const likC = { high: ['#2A1A0E', '#FDBA74'], medium: ['#2A2110', '#FBBF24'], low: ['#1A212C', '#A9B4C2'] };
    const compC = { verified: ['#0F2A1E', '#4ADE80'], incompatible: ['#2A1215', '#F87171'], unverified: ['#2A2110', '#FBBF24'] };
    const fmtTime = ts => new Date(ts).toLocaleTimeString(this.loc(), { hour: '2-digit', minute: '2-digit' });
    const card = (id) => {
      const p = this.prod(id); if (!p) return null; const c = verify(veh, p);
      const inQ = s.quote.items.some(i => i.pid === id); const inC = s.compare.includes(id); const noPrice = p.price === null;
      return { id, title: p[L], brand: p.brand[L], seller: p.seller[L], partNo: p.partNo || '—', url: safeHref(p.url), hasUrl: !!safeHref(p.url), image: p.image || null, price: noPrice ? t.priceUnknown : this.money(p.price), priceN: noPrice ? Infinity : p.price, status: c.status, compatLabel: t.compat[c.status], compatBg: compC[c.status][0], compatFg: compC[c.status][1], evidence: c.evidence[L], avail: p.avail ? p.avail : t.availUnknown, typeLabel: PART_TYPES[p.type] ? PART_TYPES[p.type][L] : '', imgNote: t.noImage,
        addLabel: inQ ? t.inQuote + ' ✓' : noPrice ? t.noPriceAdd : t.addQuote, addDisabled: !inQ && noPrice, addBg: inQ ? '#0F2A1E' : noPrice ? '#1A212C' : 'linear-gradient(180deg, #FB8A3C, #EA6A10)', addFg: inQ ? '#4ADE80' : noPrice ? '#5C6878' : '#0A0E13', onAdd: () => this.addToQuote(id),
        cmpLabel: inC ? t.comparing : t.compare, cmpBg: inC ? '#1E2733' : 'transparent', cmpFg: inC ? '#F1F5F9' : '#E6EDF5',
        onCompare: () => this.setState(st => ({ compare: st.compare.includes(id) ? st.compare.filter(x => x !== id) : [...st.compare, id].slice(-3) })),
        onDelete: () => this.removeProduct(id) };
    };
    const causeView = c => ({ title: c.title, why: c.why || '', likLabel: t.lik[c.likelihood] || t.lik.medium, likBg: (likC[c.likelihood] || likC.medium)[0], likFg: (likC[c.likelihood] || likC.medium)[1] });

    const W = WF_T[L];
    const confirmedAfter = run => !!(run && s.quote.status === 'confirmed' && s.quote.date && new Date(s.quote.date).getTime() >= run.at && run.steps.some(x => x.id === 'quotation_management' && x.status === 'done'));
    const runs = conv.runs && conv.runs.length ? conv.runs : (conv.trace && conv.trace.length ? [{ id: 'legacy', at: conv.createdAt || 0, text: '', steps: conv.trace, expected: deriveExpected(conv.trace), totalMs: 0, status: 'done' }] : []);
    const liveRun = s.busy && s.run && s.streamConv === conv.id ? { id: 'live', live: true, at: s.run.at, text: s.run.text, steps: s.run.steps, expected: s.run.expected || ['understand'], status: 'live' } : null;
    const CS_COL = { done: ['#22C55E', '#161D27', '#22C55E'], running: ['#22D3EE', '#161D27', '#22D3EE'], pending: ['#161D27', '#7C8A9C', '#2A3442'], failed: ['#EF4444', '#161D27', '#EF4444'], skipped: ['#0B0F14', '#5C6878', '#222B37'], waiting: ['#FBBF24', '#0A0E13', '#F59E0B'] };
    const CS_FG = { done: '#4ADE80', running: '#67E8F9', pending: '#7C8A9C', failed: '#F87171', skipped: '#5C6878', waiting: '#FBBF24' };
    const csView = (list, notes) => list.map((it, i) => { const st = it.st; const c = it.c; const prev = list[i - 1];
      return { label: c[L], icon: WF_ICON[c.icon], bg: CS_COL[st][0], fg: CS_COL[st][1], border: CS_COL[st][2], stLabel: W.cst[st], stFg: CS_FG[st], labelFg: st === 'pending' || st === 'skipped' ? '#8B98A9' : '#E6EDF5', anim: st === 'running' ? 'wfPulse 1.6s ease-in-out infinite' : 'none',
        notLast: i < list.length - 1, line: st === 'done' ? '#22C55E' : '#222B37', lineIn: i === 0 ? 'transparent' : (prev.st === 'done' ? '#22C55E' : '#222B37'), lineOut: i === list.length - 1 ? 'transparent' : (st === 'done' ? '#22C55E' : '#222B37'), note: notes ? notes(c.id, st) : '' }; });
    const MARK = { done: ['✓', '#0F2A1E', '#4ADE80'], waiting: ['•', '#2A2110', '#FBBF24'], failed: ['✕', '#2A1215', '#F87171'], skipped: ['–', '#0B0F14', '#7C8A9C'], pending: ['–', '#0B0F14', '#7C8A9C'], running: ['…', '#0B2A30', '#67E8F9'] };
    const lastIdx = conv.messages.length - 1;
    const view = (m, idx, live) => {
      const u = m.role === 'user'; const prods = (m.productIds || []).map(card).filter(Boolean); const d = m.diagnosis;
      let quick = [];
      if (!live && !u && idx === lastIdx && !s.busy) {
        if (m.retry) quick = [{ text: t.retry, go: () => this.send(m.retry) }];
        else quick = (m.quick || []).slice(0, 3).map(x => ({ text: x, go: () => this.send(x) }));
      }
      const run = !u && !live && m.runId ? runs.find(r => r.id === m.runId) : null;
      const done = run ? custState(run, confirmedAfter(run)).map(x => ({ label: x.c[L], mark: MARK[x.st][0], bg: MARK[x.st][1], fg: MARK[x.st][2] })) : [];
      return { id: m.id, isAgent: !u, text: live ? (m.text || '') + '▍' : m.text, hasText: !!m.text, align: u ? 'flex-end' : 'flex-start', bg: u ? '#2A1A0E' : (m.isError ? '#2A1215' : '#131922'), fg: u ? '#FDE7D4' : (m.isError ? '#FCA5A5' : '#E6EDF5'), border: u ? '#4A2A12' : '#222B37',
        hasSteps: live, cust: live && liveRun ? csView(custState(liveRun, false)) : [],
        hasDiag: !!(d && d.causes && d.causes.length), causes: d && d.causes ? d.causes.map(causeView) : [], checks: d && d.checks ? d.checks.map((c, i) => ({ n: i + 1, text: c })) : [], hasSafety: !!(d && d.safety), safety: d ? d.safety : '',
        hasFollow: !!m.followUp, followUp: m.followUp || '', hasProducts: prods.length > 0, products: prods.slice(0, 5),
        sourceLine: t.source + ': ' + (m.source === 'serpapi' ? 'Google Shopping / SerpApi' : m.source || 'Tavily') + ' · ' + t.retrieved + ' ' + (m.retrievedAt ? fmtTime(m.retrievedAt) : ''),
        isQuote: !!m.isQuote, hasQuick: quick.length > 0, quick,
        hasRoute: done.length > 0, doneSteps: done, openRun: () => this.setState({ page: 'graph', graphView: 'dev', selRun: m.runId, view: null }) };
    };
    const messages = conv.messages.map((m, i) => view(m, i, false));
    if (s.busy && s.stream && s.streamConv === conv.id) messages.push(view({ id: 'stream', role: 'agent', ...s.stream }, -1, true));
    const panelRun = liveRun || runs[0] || null;
    const panelSteps = panelRun ? csView(custState(panelRun, confirmedAfter(panelRun))) : [];

    let results = (conv.lastResults || []).map(card).filter(Boolean);
    if (s.sort === 'low') results.sort((a, b) => a.priceN - b.priceN);
    else if (s.sort === 'high') results.sort((a, b) => (b.priceN === Infinity ? -1 : b.priceN) - (a.priceN === Infinity ? -1 : a.priceN));
    else results.sort((a, b) => CRANK[a.status] - CRANK[b.status] || a.priceN - b.priceN);
    const cmp = s.compare.map(card).filter(Boolean);
    const compareRows = [['price', t.price], ['brand', t.brandL], ['seller', t.seller], ['partNo', t.partNo], ['compatLabel', t.compatL], ['evidence', t.evidence], ['avail', t.availability]].map(([k, label]) => ({ label, cells: cmp.map(p => ({ v: p[k] })) }));

    const qRows = s.quote.items.map(i => { const p = this.prod(i.pid); if (!p || p.price === null) return null; const c = verify(veh, p);
      return { title: p[L], meta: [p.brand[L], p.partNo, p.seller[L]].filter(Boolean).join(' · '), compatLabel: t.compat[c.status], compatBg: compC[c.status][0], compatFg: compC[c.status][1], unit: this.money(p.price), qty: i.qty, total: this.money(p.price * i.qty), inc: () => this.setQty(i.pid, 1), dec: () => this.setQty(i.pid, -1), remove: () => this.addToQuote(i.pid) }; }).filter(Boolean);
    const qVeh = s.quote.vehicle || veh;
    const sheetRows = s.quote.items.map(i => this.prod(i.pid)).map((p, n) => { if (!p || p.price === null) return null; const i = s.quote.items[n]; return { n: n + 1, title: p.ar, brand: p.brand.ar, compat: T.ar.compat[verify(qVeh, p).status], partNo: p.partNo || '—', qty: i.qty, unit: this.money(p.price, 'ar'), total: this.money(p.price * i.qty, 'ar') }; }).filter(Boolean);
    const sources = s.quote.items.map(i => this.prod(i.pid)).filter(Boolean);
    const qDate = s.quote.date ? new Date(s.quote.date) : null;
    const qExpiry = s.quote.expiresAt ? new Date(s.quote.expiresAt) : null;

    const isDark = s.wfTheme === 'dark'; const rtl = L === 'ar';
    const wf = isDark
      ? { canvas: '#0B0F14', dot: '#1E2631', border: '#1E2631', node: '#131922', text: '#E6EDF5', sub: '#7C8A9C', edge: '#334050', panel: '#0F141B', panelLine: '#1C2430', pre: '#0B0F14', preFg: '#CBD5E1', chipBg: '#131922', ctrl: '#131922' }
      : { canvas: '#F4F6F9', dot: '#D5DCE5', border: '#DCE3EB', node: '#FFFFFF', text: '#0F172A', sub: '#64748B', edge: '#B8C3D1', panel: '#FFFFFF', panelLine: '#E5EAF0', pre: '#F4F6F9', preFg: '#0F172A', chipBg: '#FFFFFF', ctrl: '#FFFFFF' };
    const SC = isDark
      ? { done: { b: '#166534', ib: '#0F2A1E', if: '#4ADE80', fg: '#4ADE80' }, running: { b: '#22D3EE', ib: '#0B2A30', if: '#67E8F9', fg: '#67E8F9' }, retrying: { b: '#22D3EE', ib: '#0B2A30', if: '#67E8F9', fg: '#FBBF24' }, failed: { b: '#7F1D1D', ib: '#2A1215', if: '#F87171', fg: '#F87171' }, waiting: { b: '#92400E', ib: '#2A2110', if: '#FBBF24', fg: '#FBBF24' }, pending: { b: '#2A3442', ib: '#18202A', if: '#7C8A9C', fg: '#7C8A9C' }, skipped: { b: '#222B37', ib: '#131922', if: '#4B5768', fg: '#4B5768' } }
      : { done: { b: '#86EFAC', ib: '#DCFCE7', if: '#166534', fg: '#166534' }, running: { b: '#06B6D4', ib: '#CFFAFE', if: '#0E7490', fg: '#0E7490' }, retrying: { b: '#06B6D4', ib: '#CFFAFE', if: '#0E7490', fg: '#B45309' }, failed: { b: '#FCA5A5', ib: '#FEE2E2', if: '#991B1B', fg: '#991B1B' }, waiting: { b: '#FCD34D', ib: '#FEF3C7', if: '#92400E', fg: '#92400E' }, pending: { b: '#DCE3EB', ib: '#F1F5F9', if: '#64748B', fg: '#64748B' }, skipped: { b: '#DCE3EB', ib: '#F1F5F9', if: '#94A3B8', fg: '#94A3B8' } };
    const curRun = (s.selRun && runs.find(r => r.id === s.selRun)) || liveRun || runs[0] || null;
    const NODE_ALL = NODES;
    const metaOf = id => NODE_ALL.find(n => n.id === id);
    const runStep = (run, id) => {
      if (!run) return null;
      if (id === 'confirm' || id === 'pdf') {
        if (!confirmedAfter(run)) return null;
        if (id === 'confirm') return { id, status: 'done', ms: null, input: { quotationId: s.quote.no }, output: { confirmedByCustomer: true, confirmedAt: s.quote.date } };
        return (s.quoteTrace || []).find(x => x.id === 'pdf') || null;
      }
      return run.steps.find(x => x.id === id) || null;
    };
    const nodeState = id => {
      if (!curRun) return 'pending';
      if (id === 'confirm' || id === 'pdf') { const q = curRun.steps.find(x => x.id === 'quotation_management'); if (!q || q.status !== 'done') return curRun.live ? 'pending' : 'skipped'; if (confirmedAfter(curRun)) return 'done'; return id === 'confirm' ? 'waiting' : 'pending'; }
      const st = curRun.steps.find(x => x.id === id);
      if (st) return st.retrying ? 'retrying' : st.status === 'error' ? 'failed' : st.status;
      return curRun.live ? 'pending' : 'skipped';
    };
    const fmtMs = st => !st ? '' : st.sharedWith ? W.sharedMs : (st.ms === null || st.ms === undefined) ? '' : st.ms < 1 ? '<1 ms' : Math.round(st.ms) + ' ms';
    const runningStep = curRun ? curRun.steps.find(x => x.status === 'running') : null;
    const selId = curRun && curRun.live && runningStep ? runningStep.id : (WF_POS[s.selNode] ? s.selNode : 'intent_detection');
    const wfNodes = Object.keys(WF_POS).map(id => { const p = wfPos(id, rtl); const m = metaOf(id); const st = nodeState(id); const c = SC[st]; const step = runStep(curRun, id);
      return { x: p.x, y: p.y, label: m[L], tool: m.tool, icon: WF_ICON[id], stLabel: st === 'retrying' ? W.st.retrying + ' ' + (step ? step.attempts : 2) + '/2' : W.st[st], stFg: c.fg, ms: fmtMs(step),
        border: c.b, borderW: st === 'running' || st === 'retrying' ? '2px' : '1.5px', borderStyle: st === 'skipped' || id === 'confirm' ? 'dashed' : 'solid', bg: wf.node, iconBg: c.ib, iconFg: c.if, opacity: st === 'skipped' ? 0.5 : 1,
        anim: st === 'running' || st === 'retrying' ? 'wfPulse 1.6s ease-in-out infinite' : 'none', outline: selId === id ? '2px solid #F97316' : '0px solid transparent', shadow: isDark ? '0 1px 0 rgba(0,0,0,0.3)' : '0 1px 2px rgba(15,23,42,0.06)',
        select: () => this.setState({ selNode: id }) }; });
    const doneSeq = curRun ? curRun.steps.filter(x => x.status === 'done').map(x => x.id) : [];
    const taken = new Set(); for (let i = 1; i < doneSeq.length; i++) taken.add(doneSeq[i - 1] + '>' + doneSeq[i]);
    if (nodeState('confirm') === 'done' || nodeState('confirm') === 'waiting') taken.add('quotation_management>confirm');
    if (nodeState('confirm') === 'done') taken.add('confirm>pdf');
    const errStep = curRun ? curRun.steps.find(x => x.status === 'error') : null; const lastDone = doneSeq[doneSeq.length - 1];
    const activeKey = runningStep && lastDone ? lastDone + '>' + runningStep.id : null;
    const failKey = errStep && lastDone ? lastDone + '>' + errStep.id : null;
    const EC = isDark ? { taken: '#22C55E', active: '#22D3EE', failed: '#EF4444' } : { taken: '#16A34A', active: '#06B6D4', failed: '#DC2626' };
    const wfEdges = []; const wfLabels = [];
    WF_EDGES.forEach(e => { const key = e[0] + '>' + e[2]; const g = edgeGeom(e, rtl);
      const k = key === activeKey ? 'active' : key === failKey ? 'failed' : taken.has(key) ? 'taken' : 'idle';
      const muted = k === 'idle' && !!curRun && !curRun.live;
      wfEdges.push({ d: g.d, arrow: g.arrow, color: k === 'idle' ? wf.edge : EC[k], w: k === 'idle' ? 1.5 : 2.25, dash: k === 'active' ? '6 6' : 'none', anim: k === 'active' ? 'wfDash 0.9s linear infinite' : 'none', op: muted ? 0.45 : 1 });
      if (e[4]) wfLabels.push({ x: Math.round(g.mid[0]), y: Math.round(g.mid[1]), text: e[4][L], bg: k === 'taken' ? (isDark ? '#0F2A1E' : '#DCFCE7') : wf.chipBg, fg: k === 'taken' ? (isDark ? '#4ADE80' : '#166534') : wf.sub, border: k === 'taken' ? 'transparent' : wf.border, op: muted ? 0.6 : 1 }); });
    const wfNodeIds = Object.keys(WF_POS);
    const wfConnections = WF_EDGES.map((edge, i) => ({
      source: wfNodeIds.indexOf(edge[0]), target: wfNodeIds.indexOf(edge[2]),
      label: edge[4] ? edge[4][L] : '', visual: wfEdges[i],
    })).filter(edge => edge.source >= 0 && edge.target >= 0);
    const wfLegend = ['pending', 'running', 'done', 'failed', 'skipped'].map(k => ({ label: W.st[k], bg: SC[k].ib, border: SC[k].b, style: k === 'skipped' ? 'dashed' : 'solid' }));
    const summarize = (id, st) => {
      const o = st.output || {}; const ar = L === 'ar';
      if (st.status === 'error') return (ar ? 'فشلت الخطوة: ' : 'Step failed: ') + (o.error || '');
      if (st.status === 'running') return ar ? 'الخطوة قيد التنفيذ الآن.' : 'This step is running now.';
      switch (id) {
        case 'intent_detection': return (ar ? 'النية المكتشفة: ' : 'Detected intent: ') + ((INTENT_L[o.intent] || S(o.intent || '—', o.intent || '—'))[L]);
        case 'vehicle_extraction': return (ar ? 'المركبة: ' : 'Vehicle: ') + this.vLabel(o.vehicle);
        case 'missing_information': return (ar ? 'الحقول الناقصة: ' : 'Missing fields: ') + ((o.missingFields || []).join(', ') || '—');
        case 'automotive_diagnosis': return ar ? (o.causes + ' أسباب محتملة. لا يُعد تشخيصاً مؤكداً.') : (o.causes + ' possible causes. Not a confirmed diagnosis.');
        case 'followup_questions': return (ar ? 'سؤال للعميل: ' : 'Question: ') + (o.question || '');
        case 'google_shopping_search': case 'tavily_fallback_search': return ar ? ('تم العثور على ' + o.count + ' نتائج عبر ' + (o.provider || '—') + '.') : (o.count + ' results via ' + (o.provider || '—') + '.');
        case 'product_normalization': case 'duplicate_detection': case 'compatibility_verification': return (ar ? 'النتائج بعد هذه المرحلة: ' : 'Results after this stage: ') + (o.count ?? 0);
        case 'product_ranking': case 'product_recommendations': return ar ? ('عرض ' + (o.productIds || []).length + ' منتجات مرتبة.') : ((o.productIds || []).length + ' ranked products.');
        case 'quotation_management': return ar ? 'تم إعداد مسودة العرض وتنتظر تأكيد العميل.' : 'Quotation draft prepared; waiting for confirmation.';
        case 'confirm': return ar ? 'أكّد العميل عرض السعر.' : 'The customer confirmed the quotation.';
        case 'pdf': return ar ? 'تم تجهيز ملف PDF عبر طباعة المتصفح.' : 'PDF produced via browser print.';
      }
      return '';
    };
    const selM = metaOf(selId); const selStep = runStep(curRun, selId); const selState = nodeState(selId); const selC = SC[selState];
    const execIds = NODE_ALL.map(n => n.id).filter(id => !['pending', 'skipped'].includes(nodeState(id)));
    const ei = execIds.indexOf(selId);
    const goSel = dlt => () => { const id = execIds[ei + dlt]; if (id) this.setState({ selNode: id }); };
    const sel = { label: selM[L], tool: selM.tool, icon: WF_ICON[selId], stLabel: W.st[selState], stBg: selC.ib, stFg: selC.fg, iconBg: selC.ib, iconFg: selC.if,
      summary: selStep ? summarize(selId, selStep) : (selState === 'waiting' ? (L === 'ar' ? 'بانتظار تأكيد العميل من صفحة عرض السعر.' : 'Waiting for the customer to confirm on the Quotation page.') : W.notRun),
      isShared: !!(selStep && selStep.sharedWith), isFailed: selState === 'failed', errorText: selStep && selStep.output ? String(selStep.output.error || '') : '',
      hasRetries: !!(selStep && selStep.errors && selStep.errors.length), retries: selStep && selStep.errors ? selStep.errors.map((e, i) => ({ n: i + 1, text: sanitize(e) })) : [],
      meta: [{ k: W.tool, v: selM.tool }, { k: W.status, v: W.st[selState] }, { k: W.duration, v: fmtMs(selStep) || '—' }, { k: W.attempts, v: selStep && selStep.attempts ? String(selStep.attempts) : '—' }, { k: W.startedAt, v: selStep && selStep.startedAt ? new Date(selStep.startedAt).toLocaleTimeString(this.loc()) : '—' }],
      input: selStep ? JSON.stringify(sanitize(selStep.input), null, 2) : '—', output: selStep ? JSON.stringify(sanitize(selStep.output), null, 2) : '—',
      prev: goSel(-1), next: goSel(1), noPrev: ei <= 0, noNext: ei < 0 || ei >= execIds.length - 1, prevFg: ei > 0 ? wf.text : wf.sub, nextFg: ei >= 0 && ei < execIds.length - 1 ? wf.text : wf.sub };
    const tab = s.inspTab || 'summary';
    const searchStep = curRun ? [...curRun.steps].reverse().find(x => ['google_shopping_search','tavily_fallback_search'].includes(x.id) && x.output && x.status === 'done') : null;
    const src = searchStep ? { provider: searchStep.output.provider || 'tavily', at: searchStep.output.retrievedAt ? new Date(searchStep.output.retrievedAt).toLocaleString(this.loc()) : '—', items: (searchStep.output.items || []).map(it => ({ partNo: it.partNo || '—', seller: it.seller, url: it.url || W.noUrl })) } : { provider: '', at: '', items: [] };
    const runChips = [...(liveRun ? [liveRun] : []), ...runs].slice(0, 8).map(r => { const on = !!curRun && r.id === curRun.id; const n = r.live ? W.live : '#' + (runs.length - runs.indexOf(r));
      return { label: n + ' · ' + new Date(r.at || Date.now()).toLocaleTimeString(this.loc(), { hour: '2-digit', minute: '2-digit' }), title: r.text || '', dot: r.live ? '#22D3EE' : r.status === 'error' ? '#EF4444' : r.status === 'stopped' ? '#F59E0B' : '#22C55E', bg: on ? '#23170D' : '#161D27', border: on ? '#F97316' : '#222B37', go: () => this.setState({ selRun: r.live ? null : r.id }) }; });
    const outOf = id => { const x = curRun && curRun.steps.find(y => y.id === id); return x && x.output ? x.output : null; };
    const cNote = (id, st) => {
      if (st === 'pending' || st === 'skipped') return '';
      const ar = L === 'ar';
      if (id === 'understand') { const o = outOf('vehicle_extraction'); return o && o.vehicle && o.vehicle.make ? this.vLabel(o.vehicle) : ''; }
      if (id === 'analyze') { const o = outOf('automotive_diagnosis'); return o && o.causes ? (ar ? o.causes + ' أسباب محتملة' : o.causes + ' possible causes') : ''; }
      if (id === 'search') { const o = outOf('tavily_fallback_search') || outOf('google_shopping_search'); return o && o.count !== undefined ? o.count + (ar ? ' نتائج · ' : ' results · ') + (o.provider || '—') : ''; }
      if (id === 'verify') { const o = outOf('compatibility_verification'); return o ? (ar ? o.count + ' متوافق' : o.count + ' verified') : ''; }
      if (id === 'results') { const o = outOf('product_recommendations'); return o && o.productIds ? (ar ? 'عرض ' + o.productIds.length + ' منتجات' : o.productIds.length + ' products') : ''; }
      if (id === 'quote') return st === 'waiting' ? (ar ? 'راجع العرض وأكّده لإنشاء PDF' : 'Review and confirm to create the PDF') : st === 'done' ? (ar ? 'تم تأكيد العرض وإنشاء PDF' : 'Confirmed, PDF created') : '';
      return '';
    };
    const cvStatus = curRun ? (curRun.live ? 'live' : curRun.status) : 'done';
    const cv = curRun ? { text: curRun.text || '—', statusLine: W.runSt[cvStatus] || '', statusFg: cvStatus === 'error' ? '#F87171' : cvStatus === 'live' ? '#67E8F9' : '#8B98A9', steps: csView(custState(curRun, confirmedAfter(curRun)), cNote), hasProducts: !!outOf('product_recommendations'), hasQuote: curRun.steps.some(x => x.id === 'quotation_management') } : { text: '', statusLine: '', statusFg: '#8B98A9', steps: [], hasProducts: false, hasQuote: false };
    const v = s.view || { x: 0, y: 0, k: 1 };
    const gView = s.graphView === 'dev' ? 'dev' : 'customer';
    const vKeys = ['make', 'model', 'year', 'engine', 'trim', 'market', 'vin'];
    const vFields = vKeys.map(k => ({ label: t.v[k], value: veh[k] ?? '', span: k === 'vin' ? '1 / -1' : 'auto', border: veh[k] ? '#3A4757' : '#222B37', onChange: e => { const val = e.target.value; this.updConv(c => ({ ...c, vehicle: { ...c.vehicle, [k]: k === 'year' ? (val ? +latin(val) || val : '') : val } })); } }));
    const isSaved = vComplete(veh) && s.vehicles.some(v => v.make === veh.make && v.model === veh.model && v.year === veh.year);
    const mkField = (grp, k, label) => ({ label, value: s[grp][k] || '', onChange: e => { const val = e.target.value; this.setState(st => ({ [grp]: { ...st[grp], [k]: val } })); } });

    const h = s.health; const ok = '#22C55E', bad = '#EF4444';
    const conns = [
      { name: t.conn.llm, dot: h.llm ? ok : bad, short: h.llm ? 'OpenAI' : h.llmStatus === 'invalid' ? (L === 'ar' ? 'المفتاح مرفوض' : 'Invalid key') : (L === 'ar' ? 'غير متصل' : 'Not connected'), long: h.llm ? 'OpenAI · ' + h.model : h.llmStatus === 'invalid' ? (L === 'ar' ? 'مفتاح OpenAI الحالي ملغى أو غير صالح. استبدله في backend/.env ثم أعد تشغيل الخادم.' : 'The OpenAI key is revoked or invalid. Replace it in backend/.env, then restart the server.') : (L === 'ar' ? 'تحقق من OPENAI_API_KEY والاتصال بالإنترنت.' : 'Check OPENAI_API_KEY and the internet connection.') },
      { name: t.conn.search, dot: h.search ? ok : bad, short: h.search ? (h.searchProvider === 'serpapi' ? 'SerpApi · Google Shopping' : 'Tavily') : (L === 'ar' ? 'غير مضبوط' : 'Not set'), long: h.search ? (L === 'ar' ? 'بحث منتجات حقيقي مع تحقق من صفحة المصدر.' : 'Live product search with source-page verification.') : (L === 'ar' ? 'اضبط SERPAPI_API_KEY أو TAVILY_API_KEY.' : 'Set SERPAPI_API_KEY or TAVILY_API_KEY.') },
      { name: t.conn.db, dot: h.db && !s.dbError ? ok : bad, short: 'PostgreSQL', long: h.db && !s.dbError ? (L === 'ar' ? 'PostgreSQL داخل Docker.' : 'PostgreSQL in Docker.') : t.dbError },
      { name: t.conn.pdf, dot: ok, short: L === 'ar' ? 'طباعة المتصفح' : 'Browser print', long: L === 'ar' ? 'طباعة المتصفح بخط عربي واتجاه RTL.' : 'Browser print with Arabic font and RTL.' },
    ];
    const pageTitles = { dashboard: t.nav.dashboard, chat: conv.title || t.nav.chat, products: t.nav.products, quote: s.quote.no ? `${t.nav.quote} · ${s.quote.no}` : t.nav.quote, graph: t.nav.graph, settings: t.nav.settings };
    const tot = this.totals();
    const startDash = () => { const x = s.dashDraft.trim(); if (x) this.startNew(null, x); };
    const pendingDelete = s.deleteProductId ? this.prod(s.deleteProductId) : null;

    return {
      t, lang: L, dir: L === 'ar' ? 'rtl' : 'ltr', pageTitle: pageTitles[s.page], dbError: s.dbError,
      deleteDialog: pendingDelete ? {
        open: true, title: t.deleteProductTitle, body: t.deleteProductBody, product: pendingDelete[L],
        cancelLabel: t.deleteProductCancel, confirmLabel: t.deleteProductConfirm,
        cancel: this.cancelRemoveProduct, confirm: this.confirmRemoveProduct,
      } : { open: false },
      nav: ['dashboard', 'chat', 'products', 'quote', 'graph', 'settings'].map(id => ({ label: t.nav[id], d: ICONS[id], go: go(id), bg: s.page === id ? '#1F1610' : 'transparent', fg: s.page === id ? '#FB923C' : '#A9B4C2', hasBadge: s.vw < 1000 ? false : id === 'quote' ? s.quote.items.length > 0 : id === 'products' ? (conv.lastResults || []).length > 0 : false, badge: id === 'quote' ? s.quote.items.length : (conv.lastResults || []).length })),
      convList: s.convs.slice(0, 6).map(c => ({ title: c.title || t.untitled, meta: `${this.vLabel(c.vehicle)} · ${c.messages.length} ${t.msgs}`, bg: c.id === s.activeId ? '#161E28' : 'transparent', open: () => this.setState({ activeId: c.id, page: 'chat' }) })),
      newChat: () => this.startNew(), conns,
      langBtns: [['ar', 'ع', 'العربية'], ['en', 'EN', 'English']].map(([k, label, labelLong]) => ({ label, labelLong, ...dark(L === k), on: () => this.setState({ lang: k }) })),
      memoryConsent: s.memoryConsent,
      memoryToggle: e => this.setState({ memoryConsent: e.target.checked, ...(!e.target.checked ? { preferences: { preferredBrand: '', buyingPreference: '', notes: '' } } : {}) }),
      preferenceFields: [
        { key: 'preferredBrand', label: L === 'ar' ? 'العلامة المفضلة' : 'Preferred brand', value: s.preferences.preferredBrand || '' },
        { key: 'notes', label: L === 'ar' ? 'ملاحظات التفضيل' : 'Preference notes', value: s.preferences.notes || '' },
      ].map(field => ({ ...field, onChange: e => this.setState(st => ({ preferences: { ...st.preferences, [field.key]: e.target.value } })) })),
      buyingPreference: s.preferences.buyingPreference || '',
      onBuyingPreference: e => this.setState(st => ({ preferences: { ...st.preferences, buyingPreference: e.target.value } })),
      memoryLoading: s.memoryLoading,
      conversationMemory: s.conversationMemory,
      askClearMemory: () => this.setState({ confirmMemoryClear: true }),
      cancelClearMemory: () => this.setState({ confirmMemoryClear: false }),
      confirmMemoryClear: s.confirmMemoryClear,
      clearConversationMemory: () => this.clearCurrentConversationMemory(),
      isDashboard: s.page === 'dashboard', isChat: s.page === 'chat', isProducts: s.page === 'products', isQuote: s.page === 'quote', isGraph: s.page === 'graph', isSettings: s.page === 'settings',
      dashDraft: s.dashDraft, onDashDraft: e => this.setState({ dashDraft: e.target.value }), onDashKey: e => { if (e.key === 'Enter') { e.preventDefault(); startDash(); } }, dashStart: startDash,
      examples: t.examples.map(text => ({ text, go: () => { if (s.page === 'chat' && conv.messages.length === 0) this.send(text); else this.startNew(null, text); } })),
      savedVehicles: s.vehicles.map(v => ({ label: this.vLabel(v), meta: [v.market, v.vin].filter(Boolean).join(' · ') || (L === 'ar' ? 'بدون رقم هيكل' : 'No VIN'), chat: () => this.startNew({ ...v }), remove: () => this.setState(st => ({ vehicles: st.vehicles.filter(x => x !== v) })) })),
      noVehicles: s.vehicles.length === 0, noQuotes: s.quotes.length === 0,
      recentQuotes: s.quotes.map(q => ({ no: q.no, total: this.money(q.totalN), meta: `${new Date(q.date).toLocaleDateString(this.loc())} · ${this.vLabel(q.vehicle)} · ${q.count} ${L === 'ar' ? 'بنود' : 'items'}` })),
      sideW: s.vw < 1000 ? '72px' : '232px', showLabels: s.vw >= 1000,
      showPanel: (s.panelPref === null || s.panelPref === undefined) ? s.vw >= 1200 : s.panelPref, panelToggleLabel: ((s.panelPref === null || s.panelPref === undefined) ? s.vw >= 1200 : s.panelPref) ? t.panelHide : t.panelShow, togglePanel: () => this.setState({ panelPref: !((s.panelPref === null || s.panelPref === undefined) ? s.vw >= 1200 : s.panelPref) }),
      quoteBarText: s.quote.items.reduce((a, i) => a + i.qty, 0) + ' ' + t.quoteBar + ' · ' + tot.total,
      notBusy: !s.busy, sendDisabled: !s.draft.trim(), sendBg: s.draft.trim() ? 'linear-gradient(180deg, #FB8A3C, #EA6A10)' : '#1A212C', sendFg: s.draft.trim() ? '#0A0E13' : '#5C6878', stopRun: () => this.stopRun(),
      scrollRef: this.scrollRef, chatEmpty: conv.messages.length === 0, messages, busy: s.busy,
      draft: s.draft, onDraft: e => this.setState({ draft: e.target.value }), onDraftKey: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } }, sendDraft: () => this.send(),
      goProducts: go('products'), goQuote: go('quote'), goChat: go('chat'), goGraph: go('graph'),
      vFields, saveVehicleLabel: isSaved ? t.saved : t.saveVehicle,
      saveVehicle: () => { if (!vComplete(veh) || isSaved) return; this.setState(st => ({ vehicles: [{ ...veh }, ...st.vehicles] })); },
      panelSteps, noRun: panelSteps.length === 0,
      diagCauses: conv.diagnosis && conv.diagnosis.causes ? conv.diagnosis.causes.map(causeView) : [], noDiag: !(conv.diagnosis && conv.diagnosis.causes && conv.diagnosis.causes.length),
      sourceBanner: t.sourceBanner.replace('Tavily', h.searchProvider === 'serpapi' ? 'Google Shopping / SerpApi' : 'Tavily'),
      vehicleLabel: this.vLabel(veh), productsSource: `${t.source}: ${h.searchProvider === 'serpapi' ? 'Google Shopping / SerpApi' : 'Tavily'} · ${results.length} ${L === 'ar' ? 'نتائج' : 'results'}`,
      sortBtns: [['compat', t.sortCompat], ['low', t.sortLow], ['high', t.sortHigh]].map(([k, label]) => ({ label, ...dark(s.sort === k), on: () => this.setState({ sort: k }) })),
      results, noResults: results.length === 0, showCompare: cmp.length >= 2, compareHead: cmp.map(p => ({ title: p.title })), compareRows,
      quoteEmpty: s.quote.items.length === 0, quoteHas: s.quote.items.length > 0, quoteRows: qRows, totals: tot, vatRate: s.vat, shipping: s.quote.shipping, shipUnknown: s.quote.shipping === '',
      onShipping: e => { const v = latin(e.target.value).replace(/[^\d.]/g, ''); this.setState(st => ({ quote: { ...st.quote, shipping: v, status: 'draft' } })); },
      quoteStatusLabel: s.quote.status === 'confirmed' ? t.confirmed : t.draft, quoteStatusBg: s.quote.status === 'confirmed' ? '#0F2A1E' : '#1A212C', quoteStatusFg: s.quote.status === 'confirmed' ? '#4ADE80' : '#A9B4C2',
      isDraft: s.quote.status !== 'confirmed', isConfirmed: s.quote.status === 'confirmed' && s.quote.items.length > 0,
      confirmQuote: () => this.confirmQuote(), downloadQuote: () => { if (s.quote.no) window.location.assign(api.quotationPdfUrl(s.quote.no)); }, printQuote: () => window.print(),
      customerLine: [s.customer.name || (L === 'ar' ? 'لم يُدخل الاسم — من الإعدادات' : 'No name — set in Settings'), s.customer.phone, s.customer.city].filter(Boolean).join(' · '),
      company: s.company, customer: s.customer, quoteNo: s.quote.no || '', quoteDate: qDate ? qDate.toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) : '', quoteExpiry: qExpiry ? qExpiry.toLocaleString('ar-SA-u-nu-latn') : '',
      sheetVehicle: this.vLabel(qVeh, 'ar'), sheetVin: qVeh.vin ? 'VIN ' + qVeh.vin : '', sheetRows, sheetTotals: this.totals('ar'),
      sheetSources: sources.length ? sources.map(p => {
        let host = 'رابط المصدر';
        try { host = new URL(p.url).hostname.replace(/^www\./, ''); } catch { /* keep the safe label */ }
        return { seller: p.seller.ar || p.seller.en || 'المصدر', host, url: safeHref(p.url), retrieved: p.retrievedAt ? new Date(p.retrievedAt).toLocaleString('ar-SA-u-nu-latn') : '—' };
      }) : [],
      w: W, wf, wfTheme: isDark ? 'dark' : 'light', wfNodes, wfEdges, wfLabels, wfConnections, wfLegend, sel, src, hasSources: src.items.length > 0, noSources: src.items.length === 0, runChips, cv,
      noRuns: !curRun, isDevView: gView === 'dev', showDevView: !!curRun && gView === 'dev', showCustomerView: !!curRun && gView === 'customer',
      graphPageH: s.vw >= 1100 && gView === 'dev' && curRun ? 'calc(100vh - 64px)' : 'auto',
      viewBtns: [['customer', W.customer], ['dev', W.developer]].map(([k, label]) => ({ label, ...dark(gView === k), on: () => this.setState({ graphView: k, view: null }) })),
      themeBtns: [['light', W.light], ['dark', W.dark]].map(([k, label]) => ({ label, ...dark((s.wfTheme || 'light') === k), on: () => this.setState({ wfTheme: k }) })),
      tabBtns: [['summary', W.summary], ['io', W.io], ['sources', W.sources]].map(([k, label]) => ({ label, bg: tab === k ? (isDark ? '#1C2531' : '#1E2733') : 'transparent', fg: tab === k ? '#F1F5F9' : wf.sub, on: () => this.setState({ inspTab: k }) })),
      isTabSummary: tab === 'summary', isTabIO: tab === 'io', isTabSources: tab === 'sources',
      toDevView: () => this.setState({ graphView: 'dev', view: null }), openInspector: () => this.setState({ page: 'graph', graphView: 'dev', selRun: null, view: null }),
      canvasRef: this.canvasRef, onPanStart: this.onPanStart, onPanMove: this.onPanMove, onPanEnd: this.onPanEnd, fitView: this.fitView,
      zoomIn: () => { const el = this.canvasEl; if (el) this.zoomAt(1.2, el.clientWidth / 2, el.clientHeight / 2); }, zoomOut: () => { const el = this.canvasEl; if (el) this.zoomAt(1 / 1.2, el.clientWidth / 2, el.clientHeight / 2); },
      viewTransform: 'translate(' + v.x + 'px, ' + v.y + 'px) scale(' + v.k + ')', gridSize: (22 * v.k) + 'px ' + (22 * v.k) + 'px', gridPos: v.x + 'px ' + v.y + 'px', panCursor: s.panning ? 'grabbing' : 'grab',
      custFields: [mkField('customer', 'name', t.f.name), mkField('customer', 'phone', t.f.phone), mkField('customer', 'city', t.f.city), mkField('customer', 'email', t.f.email)],
      compFields: [mkField('company', 'name', t.f.cname), mkField('company', 'cr', t.f.cr), mkField('company', 'vatNo', t.f.vatNo), mkField('company', 'address', t.f.address)],
      onVat: e => { const v = latin(e.target.value).replace(/[^\d.]/g, ''); this.setState(st => ({ vat: v === '' ? '' : +v, quote: { ...st.quote, status: 'draft' } })); },
      resetAll: () => this.resetAll(),
    };
  }

  render() {
    const vm = this.renderVals();
    if (typeof document !== 'undefined') { document.documentElement.dir = vm.dir; document.documentElement.lang = vm.lang; }
    return <AppView vm={vm} />;
  }
}
