import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureSchema } from './db/migrate.js';
import { pool } from './db/pool.js';
import { agentRunsRepo, pruneSessions } from './repositories/index.js';
import { startAgentWorker, stopAgentWorker } from './services/agent/worker.js';

const server = createApp().listen(env.PORT, env.HOST, () => {
  console.log(`AutoParts AI API on http://${env.HOST}:${env.PORT}`);
  console.log(`  OpenAI: ${env.OPENAI_API_KEY ? env.OPENAI_MODEL : 'OPENAI_API_KEY missing'} · Search: ${env.SERPAPI_API_KEY ? 'SerpApi' : env.TAVILY_API_KEY ? 'Tavily fallback' : 'not configured'}`);
});
server.on('error', error => {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'EADDRINUSE') console.error(`API port ${env.PORT} is already in use. Stop the previous API process, then run npm run dev again.`);
  else console.error(error);
  stopAgentWorker();
  void pool.end().finally(() => process.exit(1));
});

let shuttingDown = false;
// Hourly housekeeping: expired rate-limit windows and dead or empty browser sessions.
async function housekeeping() {
  try {
    await pool.query("delete from rate_limits where window_start < now() - interval '1 day'");
    const pruned = await pruneSessions();
    if (pruned) console.log(JSON.stringify({ type: 'sessions_pruned', count: pruned }));
  } catch { /* database not up yet; next run retries */ }
}
setInterval(() => void housekeeping(), 3_600_000).unref();
async function initializeDatabase() {
  try {
    await ensureSchema();
    const recovered = await agentRunsRepo.recoverInterrupted();
    startAgentWorker();
    void housekeeping();
    console.log(`  PostgreSQL: ready${recovered ? ` · recovered ${recovered} interrupted run(s)` : ''}`);
  } catch (error) {
    console.warn(`  PostgreSQL: not reachable (${error instanceof Error ? error.message : String(error)}). Retrying in 5s; run: npm run db:up`);
    if (!shuttingDown) setTimeout(() => void initializeDatabase(), 5_000).unref();
  }
}
void initializeDatabase();

function shutdown() {
  shuttingDown = true;
  stopAgentWorker();
  server.close(() => void pool.end().finally(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
