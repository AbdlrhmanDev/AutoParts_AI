import { describe, expect, it } from 'vitest';
import { validateAgentPlan } from './planSchema.js';

const valid = {
  intent: 'parts_request',
  vehicle: { make: 'Toyota', model: 'Camry', year: 2018, engine: null, trim: null, market: null, vin: null },
  diagnosis: null,
  needsFollowUp: false,
  followUpQuestion: null,
  search: { partTypes: ['brake_pads_front'], termsAr: 'فحمات كامري', termsEn: 'Camry brake pads' },
  preference: null,
  quickReplies: [],
  reply: 'سأبحث عن القطعة المناسبة.',
};

describe('AgentPlanSchema', () => {
  it('accepts a complete plan with an allowed part type', () => {
    expect(validateAgentPlan(valid, ['brake_pads_front']).intent).toBe('parts_request');
  });

  it('rejects unknown fields and unsupported part types', () => {
    expect(() => validateAgentPlan({ ...valid, invented: true }, ['brake_pads_front'])).toThrow();
    expect(() => validateAgentPlan(valid, ['spark_plugs'])).toThrow(/Unsupported partTypes/);
  });

  it('requires follow-up text only when follow-up is requested', () => {
    expect(() => validateAgentPlan({ ...valid, needsFollowUp: true }, ['brake_pads_front'])).toThrow();
  });
});
