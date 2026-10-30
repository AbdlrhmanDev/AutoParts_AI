import { z } from 'zod';

const nullishToUndef = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform(v => v ?? undefined);
/** Caps free-form JSON documents that are stored as-is. */
const maxJsonBytes = (limit: number) => (value: unknown, ctx: z.RefinementCtx) => {
  if (Buffer.byteLength(JSON.stringify(value)) > limit) ctx.addIssue({ code: 'custom', message: `Payload exceeds ${limit} bytes` });
};
const field = z.string().max(80);

export const VehicleSchema = z.object({
  make: nullishToUndef(field),
  model: nullishToUndef(field),
  year: nullishToUndef(z.coerce.number().int()),
  engine: nullishToUndef(field),
  trim: nullishToUndef(field),
  market: nullishToUndef(field),
  vin: nullishToUndef(z.string().max(32)),
}).partial();

export const PlanRequestSchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(8000) })).min(1).max(30),
  known: VehicleSchema.default({}),
  lang: z.enum(['ar', 'en']).default('ar'),
  partTypes: z.array(z.string().max(60)).max(40).default([]),
  preferences: z.object({ preferredBrand: z.string().trim().max(80).optional(), buyingPreference: z.enum(['oem', 'cheap']).optional(), notes: z.string().trim().max(300).optional() }).default({}),
});

export const SearchRequestSchema = z.object({
  vehicle: VehicleSchema,
  partTypes: z.array(z.string().max(60)).min(1).max(5),
  termsAr: z.string().max(200).optional(),
  termsEn: z.string().max(200).optional(),
});

export const AgentRunRequestSchema = PlanRequestSchema.extend({
  threadId: z.string().trim().min(1).max(120).optional(),
}).strict();

export const ConversationSchema = z
  .object({ id: z.string().min(1).max(120), title: z.string().max(300).default(''), createdAt: z.number().default(() => Date.now()) })
  .passthrough()
  .superRefine(maxJsonBytes(1_000_000));

export const QuotationSchema = z
  .object({ no: z.string().min(1).max(64), date: z.string().datetime().optional(), expiresAt: z.string().datetime().optional(), totalN: z.number().optional(), count: z.number().int().optional(), vehicle: VehicleSchema.optional() })
  .passthrough()
  .superRefine(maxJsonBytes(256_000));

export const SettingsSchema = z.record(z.string().max(80), z.unknown()).superRefine(maxJsonBytes(32_000));
export const VehicleListSchema = z.array(VehicleSchema).max(50);
export const VinSchema = z.object({ vin: z.string().trim().toUpperCase().length(17) }).strict();
