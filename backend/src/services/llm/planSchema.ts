import { z } from 'zod';

const nullableText = z.string().trim().min(1).nullable();

export const AgentPlanSchema = z.object({
  intent: z.enum(['diagnosis', 'parts_request', 'preference', 'quote', 'vehicle_info', 'general']),
  vehicle: z.object({
    make: nullableText,
    model: nullableText,
    year: z.number().int().min(1950).max(new Date().getFullYear() + 2).nullable(),
    engine: nullableText,
    trim: nullableText,
    market: nullableText,
    vin: nullableText,
  }).strict(),
  diagnosis: z.object({
    causes: z.array(z.object({
      title: z.string().trim().min(1),
      likelihood: z.enum(['high', 'medium', 'low']),
      why: z.string().trim().min(1),
    }).strict()).min(1).max(4),
    checks: z.array(z.string().trim().min(1)).max(6),
    safety: z.string().trim().min(1).nullable(),
  }).strict().nullable(),
  needsFollowUp: z.boolean(),
  followUpQuestion: z.string().trim().min(1).nullable(),
  search: z.object({
    partTypes: z.array(z.string().trim().min(1)).min(1).max(3),
    termsAr: z.string().trim().min(1),
    termsEn: z.string().trim().min(1),
  }).strict().nullable(),
  preference: z.enum(['oem', 'cheap']).nullable(),
  quickReplies: z.array(z.string().trim().min(1)).max(3),
  reply: z.string().trim().min(1),
}).strict().superRefine((plan, ctx) => {
  if (plan.needsFollowUp && !plan.followUpQuestion) {
    ctx.addIssue({ code: 'custom', path: ['followUpQuestion'], message: 'Required when needsFollowUp is true' });
  }
  if (!plan.needsFollowUp && plan.followUpQuestion) {
    ctx.addIssue({ code: 'custom', path: ['followUpQuestion'], message: 'Must be null when needsFollowUp is false' });
  }
});

export type AgentPlan = z.infer<typeof AgentPlanSchema>;

export function validateAgentPlan(value: unknown, allowedPartTypes: string[]): AgentPlan {
  const plan = AgentPlanSchema.parse(value);
  const invalid = plan.search?.partTypes.filter(type => !allowedPartTypes.includes(type)) ?? [];
  if (invalid.length) throw new Error(`Unsupported partTypes: ${invalid.join(', ')}`);
  return plan;
}
