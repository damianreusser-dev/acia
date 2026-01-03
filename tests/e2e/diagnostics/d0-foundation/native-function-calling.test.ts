/**
 * D0-2: Native Function Calling Test
 *
 * Tier 0 foundation test - verifies native OpenAI function calling works.
 * Tests that the LLM returns toolCalls in response when tools are provided.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { LLMClient } from '../../../../src/core/llm/client.js';
import { Tool, ToolDefinition, ToolResult } from '../../../../src/core/tools/types.js';
import {
  E2E_TIMEOUTS,
  canRunE2E,
  getAPIKey,
  getLLMProvider,
  logE2EEnvironment,
} from '../../config.js';

// Simple mock tool for testing
class MockGreetingTool implements Tool {
  definition: ToolDefinition = {
    name: 'greet_user',
    description: 'Greet a user by name. Use this tool when asked to greet someone.',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'The name of the person to greet',
        required: true,
      },
    ],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const name = params.name as string;
    return {
      success: true,
      output: `Hello, ${name}!`,
    };
  }
}

describe('D0-2: Native Function Calling', () => {
  beforeAll(() => {
    logE2EEnvironment('D0-2');
  });

  it.skipIf(!canRunE2E() || getLLMProvider() !== 'openai')(
    'should receive native tool calls from OpenAI',
    async () => {
      const client = new LLMClient({
        provider: 'openai',
        apiKey: getAPIKey(),
      });

      const mockTool = new MockGreetingTool();

      const response = await client.chat(
        [{ role: 'user', content: 'Please greet Alice using the greet_user tool.' }],
        'You have access to tools. When asked to greet someone, use the greet_user tool.',
        { tools: [mockTool] }
      );

      console.log('[D0-2] Response content:', response.content);
      console.log('[D0-2] Tool calls:', JSON.stringify(response.toolCalls, null, 2));
      console.log('[D0-2] Stop reason:', response.stopReason);

      // Should have tool calls
      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls!.length).toBeGreaterThan(0);

      // First tool call should be greet_user
      const firstCall = response.toolCalls![0];
      expect(firstCall.name).toBe('greet_user');
      expect(firstCall.id).toBeDefined();
      expect(firstCall.arguments).toBeDefined();
      expect(firstCall.arguments.name).toBeDefined();

      // Stop reason should indicate tool use
      expect(response.stopReason).toBe('tool_calls');

      console.log('[D0-2] PASSED: Native function calling working');
    },
    E2E_TIMEOUTS.TIER_0_FOUNDATION
  );

  it.skipIf(!canRunE2E() || getLLMProvider() !== 'openai')(
    'should return single tool call with parallel_tool_calls=false',
    async () => {
      const client = new LLMClient({
        provider: 'openai',
        apiKey: getAPIKey(),
      });

      // Create two tools
      const greetTool = new MockGreetingTool();

      class MockFarewellTool implements Tool {
        definition: ToolDefinition = {
          name: 'farewell_user',
          description: 'Say goodbye to a user. Use when asked to say goodbye.',
          parameters: [
            { name: 'name', type: 'string', description: 'Name to say bye to', required: true },
          ],
        };
        async execute(): Promise<ToolResult> {
          return { success: true, output: 'Goodbye!' };
        }
      }

      const farewellTool = new MockFarewellTool();

      // Ask for both greet and farewell - with parallel_tool_calls=false, should only get one
      const response = await client.chat(
        [{ role: 'user', content: 'Greet Bob AND say farewell to Bob using the tools.' }],
        'You have tools. Use them when asked.',
        { tools: [greetTool, farewellTool] }
      );

      console.log('[D0-2] Multi-tool response:', JSON.stringify(response.toolCalls, null, 2));

      // With parallel_tool_calls=false, should have exactly 1 tool call
      // (or 0 if model decides not to call tools)
      if (response.toolCalls && response.toolCalls.length > 0) {
        expect(response.toolCalls.length).toBe(1);
        console.log('[D0-2] PASSED: Single tool call enforced (parallel_tool_calls=false)');
      } else {
        console.log('[D0-2] Note: Model chose not to call tools');
      }
    },
    E2E_TIMEOUTS.TIER_0_FOUNDATION
  );

  it.skipIf(!canRunE2E() || getLLMProvider() !== 'openai')(
    'should force specific tool with toolChoice',
    async () => {
      const client = new LLMClient({
        provider: 'openai',
        apiKey: getAPIKey(),
      });

      const mockTool = new MockGreetingTool();

      // Force the greet_user tool even with ambiguous request
      const response = await client.chat(
        [{ role: 'user', content: 'Hello there!' }],
        'You have access to tools.',
        {
          tools: [mockTool],
          toolChoice: { name: 'greet_user' },
        }
      );

      console.log('[D0-2] Forced tool response:', JSON.stringify(response.toolCalls, null, 2));

      // Should have the forced tool call
      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls!.length).toBe(1);
      expect(response.toolCalls![0].name).toBe('greet_user');

      console.log('[D0-2] PASSED: Tool forcing working');
    },
    E2E_TIMEOUTS.TIER_0_FOUNDATION
  );
});
