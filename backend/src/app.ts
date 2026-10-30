import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { isDatabaseUp } from './db/pool.js';
import { asyncHandler, errorHandler, requestLogger, sameOriginMutations, securityHeaders } from './middleware/index.js';
import { agentRouter } from './routes/agent.routes.js';
import { dataRouter } from './routes/data.routes.js';
import { getOpenAiHealth } from './services/llm/openai.js';
import { browserSession } from './middleware/session.js';
import { authorizedCatalogConfigured } from './services/catalog/authorizedCatalog.js';

/**
 * Serves the built frontend (frontend/dist) from the API origin so the page gets the same
 * security headers and same-origin cookies. Skipped in development, where Vite serves it.
 */
function serveFrontend(app: express.Express) {
  const dist = env.FRONTEND_DIST || fileURLToPath(new URL('../../frontend/dist', import.meta.url));
  if (!existsSync(`${dist}/index.html`)) return;
  // Hashed build assets never change; the HTML must always be revalidated.
  app.use('/assets', express.static(`${dist}/assets`, { immutable: true, maxAge: '1y' }), (_req, res) => res.status(404).end());
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(`${dist}/index.html`);
  });
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(requestLogger);
  app.use(securityHeaders);
  app.use(express.json({ limit: '2mb' }));

  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      const [llm, db] = await Promise.all([getOpenAiHealth(), isDatabaseUp()]);
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.json({
        llm: llm.ok, llmStatus: llm.status, model: env.OPENAI_MODEL,
        search: Boolean(env.SERPAPI_API_KEY || env.TAVILY_API_KEY),
        searchProvider: env.SERPAPI_API_KEY ? 'serpapi' : env.TAVILY_API_KEY ? 'tavily' : null,
        authorizedCatalog: authorizedCatalogConfigured(),
        db,
      });
    }),
  );
  app.use('/api', browserSession);
  app.use('/api', sameOriginMutations);
  app.use('/api', agentRouter);
  app.use('/api', dataRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  serveFrontend(app);

  app.use(errorHandler);
  return app;
}
