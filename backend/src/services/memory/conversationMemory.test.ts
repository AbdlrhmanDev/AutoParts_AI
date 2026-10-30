import { describe, expect, it } from 'vitest';
import { estimateMessagesTokens, estimateTextTokens, selectRecentMessages } from './conversationMemory.js';

describe('conversation context compaction', () => {
  it('estimates Arabic more conservatively than equally sized Latin text', () => {
    expect(estimateTextTokens('سيارة تويوتا كامري')).toBeGreaterThan(estimateTextTokens('toyota camry vehicle'));
  });

  it('keeps the newest turns within budget and starts on a user message', () => {
    const messages = Array.from({ length: 18 }, (_, index) => ({ role: index % 2 ? 'assistant' as const : 'user' as const, content: `message ${index} ${'x'.repeat(80)}` }));
    const selected = selectRecentMessages(messages, 220, 4);
    expect(selected.messages.at(-1)).toEqual(messages.at(-1));
    expect(selected.messages[0].role).toBe('user');
    expect(selected.startIndex).toBeGreaterThan(0);
    expect(estimateMessagesTokens(selected.messages)).toBeLessThanOrEqual(260);
  });

  it('always retains a minimum recent window even when a message is large', () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({ role: index % 2 ? 'assistant' as const : 'user' as const, content: 'س'.repeat(500) }));
    expect(selectRecentMessages(messages, 100, 6).messages.length).toBeGreaterThanOrEqual(5);
  });
});
