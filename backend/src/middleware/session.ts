import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { ensureSchema } from '../db/migrate.js';
import { pool } from '../db/pool.js';
import { asyncHandler, consumeRateLimit } from './index.js';
import { isProduction } from '../config/env.js';

declare global {
  namespace Express {
    interface Request {
      ownerId: string;
    }
  }
}

const COOKIE_NAME = 'autoparts_session';
const YEAR_SECONDS = 365 * 24 * 60 * 60;
const NEW_SESSIONS_PER_IP_HOUR = 60;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function readCookie(header: string | undefined) {
  if (!header) return null;
  for (const item of header.split(';')) {
    const [name, ...parts] = item.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(parts.join('='));
  }
  return null;
}

function setSessionCookie(res: Parameters<RequestHandler>[1], token: string) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${YEAR_SECONDS}${secure}`);
}

/** Creates an unguessable browser identity and exposes only its database owner id to routes. */
export const browserSession: RequestHandler = asyncHandler(async (req, res, next) => {
  await ensureSchema();
  const token = readCookie(req.headers.cookie);
  if (token && /^[A-Za-z0-9_-]{40,80}$/.test(token)) {
    // Sliding expiry: re-issue the cookie at most once a day so an active browser keeps its session.
    const { rows } = await pool.query(
      `with prev as (select id, last_seen_at from browser_sessions where token_hash=$1)
       update browser_sessions b set last_seen_at=now() from prev where b.id=prev.id
       returning b.id, prev.last_seen_at < now() - interval '1 day' as renew`,
      [tokenHash(token)],
    );
    if (rows[0]?.id) {
      if (rows[0].renew) setSessionCookie(res, token);
      req.ownerId = String(rows[0].id);
      next();
      return;
    }
  }

  // Each new session is a database row; cap how fast one client can mint them.
  const { limited, retryAfter } = await consumeRateLimit(`session-ip:${req.ip ?? 'unknown'}`, NEW_SESSIONS_PER_IP_HOUR, 3600);
  if (limited) {
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const freshToken = randomBytes(32).toString('base64url');
  const ownerId = randomUUID();
  await pool.query('insert into browser_sessions (id, token_hash) values ($1,$2)', [ownerId, tokenHash(freshToken)]);
  setSessionCookie(res, freshToken);
  req.ownerId = ownerId;
  next();
});
