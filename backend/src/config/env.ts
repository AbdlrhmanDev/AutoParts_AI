import 'dotenv/config';
import { z } from 'zod';

const DEV_DATABASE_URL = 'postgres://autoparts:autoparts@127.0.0.1:5442/autoparts';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().url().default(DEV_DATABASE_URL),
  // Hops of reverse proxies in front of the API (0 when exposed directly). Decides whether X-Forwarded-For is believed.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  // Chrome's sandbox is kept on; disable only inside a container that cannot provide it.
  CHROME_NO_SANDBOX: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  OPENAI_API_KEY: z.string().trim().default(''),
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-4.1-mini'),
  CONTEXT_TOKEN_BUDGET: z.coerce.number().int().min(1000).max(50000).default(6000),
  RECENT_CONTEXT_TOKEN_BUDGET: z.coerce.number().int().min(500).max(20000).default(2600),
  SUMMARY_TRIGGER_TOKENS: z.coerce.number().int().min(500).max(40000).default(4200),
  SUMMARY_TRIGGER_MESSAGES: z.coerce.number().int().min(6).max(100).default(12),
  SERPAPI_API_KEY: z.string().trim().default(''),
  TAVILY_API_KEY: z.string().trim().default(''),
  AUTHORIZED_CATALOG_URL: z.string().trim().default('').refine(value => !value || /^https:\/\//i.test(value), 'AUTHORIZED_CATALOG_URL must use HTTPS'),
  AUTHORIZED_CATALOG_API_KEY: z.string().trim().default(''),
  CHROME_EXECUTABLE_PATH: z.string().trim().default(''),
  // Built frontend to serve from the API. Defaults to ../frontend/dist when it exists.
  FRONTEND_DIST: z.string().trim().default(''),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && value.DATABASE_URL === DEV_DATABASE_URL) {
    ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Set a production DATABASE_URL; the development credentials are not allowed' });
  }
});

/** Validated environment. Read once at startup: restart the API after editing backend/.env. */
export const env = EnvSchema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
