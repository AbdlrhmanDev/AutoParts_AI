import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { ensureSchema } from '../db/migrate.js';
import { HttpError } from '../lib/errors.js';
import { pool } from '../db/pool.js';
import { randomUUID } from 'node:crypto';
import { isProduction } from '../config/env.js';

/** Forwards async errors to the error handler (Express 4 does not catch rejected promises). */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

/** Counts one request against a fixed window shared by every API instance. */
export async function consumeRateLimit(key: string, max: number, windowSeconds: number) {
  const { rows } = await pool.query(
    `insert into rate_limits (key,window_start,request_count) values ($1,now(),1)
     on conflict (key) do update set
       window_start=case when rate_limits.window_start < now()-make_interval(secs => $2) then now() else rate_limits.window_start end,
       request_count=case when rate_limits.window_start < now()-make_interval(secs => $2) then 1 else rate_limits.request_count+1 end
     returning request_count,extract(epoch from (window_start+make_interval(secs => $2)-now()))::int as retry_after`,
    [key, windowSeconds],
  );
  const limited = Number(rows[0]?.request_count) > max;
  return { limited, retryAfter: Math.max(1, Number(rows[0]?.retry_after) || windowSeconds) };
}

function rateLimit(name: string, max: number, windowSeconds: number, keyOf: (req: Request) => string): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    const { limited, retryAfter } = await consumeRateLimit(`${name}:${keyOf(req)}`, max, windowSeconds);
    if (!limited) return next();
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({ error: 'Too many requests' });
  });
}

/** Paid upstream calls (OpenAI, SerpApi, Tavily): per browser owner, plus per IP so fresh cookies cannot bypass it. */
export const agentRateLimit = rateLimit('agent', 20, 60, req => req.ownerId);
export const costlyIpRateLimit = rateLimit('costly-ip', 60, 60, req => req.ip ?? 'unknown');
/** Each PDF launches a headless Chrome. */
export const pdfRateLimit = rateLimit('pdf', 10, 60, req => req.ownerId);

/** The app page: own scripts only, Google Fonts, and product images from any HTTPS store. */
const PAGE_CSP = [
  "default-src 'self'", "script-src 'self'", "connect-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' https: data: blob:", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
].join('; ');
/** JSON and event streams never render, so they get nothing. */
const API_CSP = "default-src 'none'; frame-ancestors 'none'";

export const securityHeaders: RequestHandler = (req, res, next) => {
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', req.path.startsWith('/api') ? API_CSP : PAGE_CSP);
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
};

export const sameOriginMutations: RequestHandler = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // permits non-browser local/CI clients; browsers send Origin for JSON mutations.
  try {
    const url = new URL(origin);
    if (url.host === req.headers.host) return next();
  } catch { /* rejected below */ }
  res.status(403).json({ error: 'Cross-origin mutation rejected' });
};

export const requestLogger: RequestHandler = (req, res, next) => {
  const incoming = String(req.headers['x-request-id'] ?? '');
  const requestId = /^[A-Za-z0-9._-]{1,100}$/.test(incoming) ? incoming : randomUUID();
  const started = performance.now();
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => console.log(JSON.stringify({ type: 'http_request', requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Math.round(performance.now() - started) })));
  next();
};

/** Makes sure the tables exist before any route that touches the database. */
export const requireDatabase: RequestHandler = asyncHandler(async (_req, _res, next) => {
  await ensureSchema();
  next();
});

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', details: err.issues.map(i => `${i.path.join('.')}: ${i.message}`) });
    return;
  }
  if (err instanceof HttpError) {
    // Upstream/config messages can carry provider details; keep them in the log, not the response.
    if (isProduction && err.status >= 500) {
      console.error(err);
      res.status(err.status).json({ error: err.status === 503 ? 'Service temporarily unavailable' : 'Upstream service failed' });
      return;
    }
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Express/body-parser/serve-static errors carry their own 4xx status (413 too large, 404 missing file).
  const status = Number((err as any)?.status ?? (err as any)?.statusCode);
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: status === 404 ? 'Not found' : status === 413 ? 'Payload too large' : 'Invalid request' });
    return;
  }
  if (['ECONNREFUSED', 'EACCES', '57P01', '57P03'].includes(String((err as any)?.code ?? ''))) {
    res.status(503).json({ error: isProduction ? 'Database unavailable' : 'Database unavailable. Start Docker and run: docker compose up -d' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: isProduction || !(err instanceof Error) ? 'Internal error' : err.message });
};
