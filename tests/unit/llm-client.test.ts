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

// Mock the OpenAI SDK
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: { content: 'Hello from GPT!' },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 15,
              completion_tokens: 25,
            },
          }),
        },
      },
    })),
  };
});

describe('LLMClient', () => {
  describe('constructor', () => {
    it('should throw error if apiKey is not provided', () => {
      expect(() => new LLMClient({ apiKey: '' })).toThrow('API key is required');
    });

    it('should create client with valid apiKey (default OpenAI)', () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should create client with anthropic provider', () => {
      const client = new LLMClient({ provider: 'anthropic', apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should create client with openai provider', () => {
      const client = new LLMClient({ provider: 'openai', apiKey: 'test-key' });
      expect(client).toBeDefined();
    });
  });

  describe('chat with Anthropic', () => {
    let client: LLMClient;

    beforeEach(() => {
      client = new LLMClient({ provider: 'anthropic', apiKey: 'test-key' });
    });

    it('should return formatted response from Anthropic API', async () => {
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

  describe('chat with OpenAI', () => {
    let client: LLMClient;

    beforeEach(() => {
      client = new LLMClient({ provider: 'openai', apiKey: 'test-key' });
    });

    it('should return formatted response from OpenAI API', async () => {
      const response = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(response.content).toBe('Hello from GPT!');
      expect(response.stopReason).toBe('stop');
      expect(response.usage.inputTokens).toBe(15);
      expect(response.usage.outputTokens).toBe(25);
    });

    it('should handle system prompt', async () => {
      const response = await client.chat(
        [{ role: 'user', content: 'Hello' }],
        'You are a helpful assistant'
      );

      expect(response.content).toBe('Hello from GPT!');
    });
  });

  describe('complete', () => {
    it('should return just the content string (Anthropic)', async () => {
      const client = new LLMClient({ provider: 'anthropic', apiKey: 'test-key' });
      const result = await client.complete('Hello');

      expect(result).toBe('Hello from Claude!');
    });

    it('should return just the content string (OpenAI)', async () => {
      const client = new LLMClient({ provider: 'openai', apiKey: 'test-key' });
      const result = await client.complete('Hello');

      expect(result).toBe('Hello from GPT!');
    });
  });

  describe('default provider', () => {
    it('should default to OpenAI when no provider specified', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      const result = await client.complete('Hello');

      // Default is OpenAI, so should get GPT response
      expect(result).toBe('Hello from GPT!');
    });
  });

  describe('native function calling (OpenAI)', () => {
    // Note: Full native function call extraction is tested via Agent tests in agent.test.ts
    // (see: "should handle native function calls from OpenAI", "should prefer native function calls over text parsing")
    // Those tests mock the LLM client response with toolCalls and verify the Agent handles them correctly.

    it('should return undefined toolCalls when no tool calls in response', async () => {
      const client = new LLMClient({ provider: 'openai', apiKey: 'test-key' });
      const response = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(response.toolCalls).toBeUndefined();
    });
  });
});
