/**
 * D0-1: LLM Connectivity Test
 *
 * Tier 0 foundation test - verifies basic LLM API connectivity.
 * This is the most basic E2E test - if this fails, nothing else will work.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { LLMClient } from '../../../../src/core/llm/client.js';
import {
  E2E_TIMEOUTS,
  canRunE2E,
  getAPIKey,
  getLLMProvider,
  logE2EEnvironment,
} from '../../config.js';

describe('D0-1: LLM Connectivity', () => {
  beforeAll(() => {
    logE2EEnvironment('D0-1');
  });

  it.skipIf(!canRunE2E())(
    'should connect to LLM API and get a response',
    async () => {
      const client = new LLMClient({
        provider: getLLMProvider(),
        apiKey: getAPIKey(),
      });

      const response = await client.chat([
        { role: 'user', content: 'Reply with exactly: PONG' },
      ]);

      console.log('[D0-1] Response:', response.content);
      console.log('[D0-1] Stop reason:', response.stopReason);
      console.log('[D0-1] Tokens:', response.usage);

      // Basic connectivity assertions
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.usage.inputTokens).toBeGreaterThan(0);
      expect(response.usage.outputTokens).toBeGreaterThan(0);

      // Response should contain PONG (case insensitive)
      expect(response.content.toUpperCase()).toContain('PONG');

      console.log('[D0-1] PASSED: LLM connectivity working');
    },
    E2E_TIMEOUTS.TIER_0_FOUNDATION
  );

  it.skipIf(!canRunE2E())(
    'should handle system prompt correctly',
    async () => {
      const client = new LLMClient({
        provider: getLLMProvider(),
        apiKey: getAPIKey(),
      });

      const response = await client.chat(
        [{ role: 'user', content: 'What is my name?' }],
        'Your name is TestBot. Always introduce yourself when asked about names.'
      );

      console.log('[D0-1] System prompt response:', response.content);

      // Should use system prompt context
      expect(response.content.toLowerCase()).toContain('testbot');

      console.log('[D0-1] PASSED: System prompt handling working');
    },
    E2E_TIMEOUTS.TIER_0_FOUNDATION
  );
});
