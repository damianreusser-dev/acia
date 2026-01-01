/**
 * Unit tests for LLM Client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMClient } from '../../src/core/llm/client.js';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Hello from Claude!' }],
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        }),
      },
    })),
  };
});

describe('LLMClient', () => {
  describe('constructor', () => {
    it('should throw error if apiKey is not provided', () => {
      expect(() => new LLMClient({ apiKey: '' })).toThrow('ANTHROPIC_API_KEY is required');
    });

    it('should create client with valid apiKey', () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });
  });

  describe('chat', () => {
    let client: LLMClient;

    beforeEach(() => {
      client = new LLMClient({ apiKey: 'test-key' });
    });

    it('should return formatted response from API', async () => {
      const response = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(response.content).toBe('Hello from Claude!');
      expect(response.stopReason).toBe('end_turn');
      expect(response.usage.inputTokens).toBe(10);
      expect(response.usage.outputTokens).toBe(20);
    });

    it('should handle system prompt', async () => {
      const response = await client.chat(
        [{ role: 'user', content: 'Hello' }],
        'You are a helpful assistant'
      );

      expect(response.content).toBe('Hello from Claude!');
    });
  });

  describe('complete', () => {
    it('should return just the content string', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.complete('Hello');

      expect(result).toBe('Hello from Claude!');
    });
  });
});
