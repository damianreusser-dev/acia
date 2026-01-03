/**
 * Unit tests for Base Agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../../src/agents/base/agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';

// Mock LLMClient
vi.mock('../../src/core/llm/client.js', () => {
  return {
    LLMClient: vi.fn().mockImplementation(() => ({
      chat: vi.fn().mockResolvedValue({
        content: 'Mock response',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20 },
      }),
    })),
  };
});

describe('Agent', () => {
  let agent: Agent;
  let mockLLMClient: LLMClient;

  beforeEach(() => {
    mockLLMClient = new LLMClient({ apiKey: 'test-key' });

    agent = new Agent({
      name: 'TestAgent',
      role: 'Tester',
      systemPrompt: 'You are a test agent',
      llmClient: mockLLMClient,
    });
  });

  describe('constructor', () => {
    it('should create an agent with correct properties', () => {
      expect(agent.name).toBe('TestAgent');
      expect(agent.role).toBe('Tester');
    });
  });

  describe('getInfo', () => {
    it('should return agent info', () => {
      const info = agent.getInfo();

      expect(info.name).toBe('TestAgent');
      expect(info.role).toBe('Tester');
      expect(info.historyLength).toBe(0);
    });
  });

  describe('processMessage', () => {
    it('should process a message and return response', async () => {
      const response = await agent.processMessage('Hello');

      expect(response).toBe('Mock response');
    });

    it('should add messages to history', async () => {
      await agent.processMessage('Hello');

      const history = agent.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(history[1]).toEqual({ role: 'assistant', content: 'Mock response' });
    });
  });

  describe('clearHistory', () => {
    it('should clear conversation history', async () => {
      await agent.processMessage('Hello');
      expect(agent.getHistory()).toHaveLength(2);

      agent.clearHistory();
      expect(agent.getHistory()).toHaveLength(0);
    });
  });

  describe('getHistory', () => {
    it('should return a copy of history, not the original', async () => {
      await agent.processMessage('Hello');

      const history1 = agent.getHistory();
      const history2 = agent.getHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe('tools', () => {
    const createMockTool = (name: string): Tool => ({
      definition: {
        name,
        description: `Mock ${name} tool`,
        parameters: [
          { name: 'input', type: 'string', description: 'Test input', required: true },
        ],
      },
      execute: vi.fn().mockResolvedValue({ success: true, output: 'Tool executed' }),
    });

    it('should register tools from config', () => {
      const tool1 = createMockTool('tool1');
      const tool2 = createMockTool('tool2');

      const agentWithTools = new Agent({
        name: 'ToolAgent',
        role: 'Tester',
        systemPrompt: 'Test',
        llmClient: mockLLMClient,
        tools: [tool1, tool2],
      });

      expect(agentWithTools.getAvailableTools()).toEqual(['tool1', 'tool2']);
      expect(agentWithTools.getInfo().toolCount).toBe(2);
    });

    it('should check if tool exists', () => {
      const tool = createMockTool('test_tool');

      const agentWithTools = new Agent({
        name: 'ToolAgent',
        role: 'Tester',
        systemPrompt: 'Test',
        llmClient: mockLLMClient,
        tools: [tool],
      });

      expect(agentWithTools.hasTool('test_tool')).toBe(true);
      expect(agentWithTools.hasTool('nonexistent')).toBe(false);
    });

    it('should execute a registered tool', async () => {
      const tool = createMockTool('test_tool');

      const agentWithTools = new Agent({
        name: 'ToolAgent',
        role: 'Tester',
        systemPrompt: 'Test',
        llmClient: mockLLMClient,
        tools: [tool],
      });

      const result = await agentWithTools.executeTool('test_tool', { input: 'test' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Tool executed');
      expect(tool.execute).toHaveBeenCalledWith({ input: 'test' });
    });

    it('should return error for non-existent tool', async () => {
      const result = await agent.executeTool('nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });
  });

  describe('processMessageWithTools', () => {
    it('should return response without tool call', async () => {
      const response = await agent.processMessageWithTools('Hello');

      expect(response).toBe('Mock response');
    });

    it('should execute tool and continue conversation', async () => {
      const tool: Tool = {
        definition: {
          name: 'greet',
          description: 'Greet someone',
          parameters: [{ name: 'name', type: 'string', description: 'Name', required: true }],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'Hello, World!' }),
      };

      // First response has tool call, second is final
      const mockChat = vi
        .fn()
        .mockResolvedValueOnce({
          content: '<tool_call>\n{"tool": "greet", "params": {"name": "World"}}\n</tool_call>',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        })
        .mockResolvedValueOnce({
          content: 'Greeted successfully!',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const agentWithTools = new Agent({
        name: 'ToolAgent',
        role: 'Tester',
        systemPrompt: 'Test',
        llmClient: customMockClient,
        tools: [tool],
      });

      const response = await agentWithTools.processMessageWithTools('Say hello');

      expect(tool.execute).toHaveBeenCalledWith({ name: 'World' });
      expect(response).toBe('Greeted successfully!');
      // Should have: user message, assistant with tool call, tool result, assistant final
      expect(agentWithTools.getHistory()).toHaveLength(4);
    });

    it('should stop at max iterations', async () => {
      const tool: Tool = {
        definition: {
          name: 'loop',
          description: 'Loop forever',
          parameters: [],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'Done' }),
      };

      // Always return tool call
      const mockChat = vi.fn().mockResolvedValue({
        content: '<tool_call>\n{"tool": "loop", "params": {}}\n</tool_call>',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20 },
      });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const agentWithTools = new Agent({
        name: 'ToolAgent',
        role: 'Tester',
        systemPrompt: 'Test',
        llmClient: customMockClient,
        tools: [tool],
      });

      const response = await agentWithTools.processMessageWithTools('Loop', 3);

      expect(tool.execute).toHaveBeenCalledTimes(3);
      expect(response).toContain('[Max iterations reached]');
    });

    it('should handle tool execution failure', async () => {
      const tool: Tool = {
        definition: {
          name: 'fail',
          description: 'Always fails',
          parameters: [],
        },
        execute: vi.fn().mockResolvedValue({ success: false, error: 'Intentional failure' }),
      };

      const mockChat = vi
        .fn()
        .mockResolvedValueOnce({
          content: '<tool_call>\n{"tool": "fail", "params": {}}\n</tool_call>',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        })
        .mockResolvedValueOnce({
          content: 'Tool failed, but I handled it.',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const agentWithTools = new Agent({
        name: 'ToolAgent',
        role: 'Tester',
        systemPrompt: 'Test',
        llmClient: customMockClient,
        tools: [tool],
      });

      const response = await agentWithTools.processMessageWithTools('Try to fail');

      expect(response).toBe('Tool failed, but I handled it.');
      // Check that error was passed to conversation
      const history = agentWithTools.getHistory();
      const toolResultMsg = history.find((h) => h.content.includes('tool_result'));
      expect(toolResultMsg?.content).toContain('Intentional failure');
    });

    it('should handle malformed tool call closing tag (</tool_call})', async () => {
      const tool: Tool = {
        definition: {
          name: 'greet',
          description: 'Greet someone',
          parameters: [{ name: 'name', type: 'string', description: 'Name', required: true }],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'Hello!' }),
      };

      // Simulate LLM outputting malformed closing tag
      const mockChat = vi
        .fn()
        .mockResolvedValueOnce({
          content: '<tool_call>\n{"tool": "greet", "params": {"name": "World"}}\n</tool_call}',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        })
        .mockResolvedValueOnce({
          content: 'Greeted successfully!',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const agentWithTools = new Agent({
        name: 'ToolAgent',
        role: 'Tester',
        systemPrompt: 'Test',
        llmClient: customMockClient,
        tools: [tool],
      });

      const response = await agentWithTools.processMessageWithTools('Say hello');

      // Tool should still be executed despite malformed tag
      expect(tool.execute).toHaveBeenCalledWith({ name: 'World' });
      expect(response).toBe('Greeted successfully!');
    });

    it('should handle native function calls from OpenAI', async () => {
      const tool: Tool = {
        definition: {
          name: 'read_file',
          description: 'Read a file',
          parameters: [{ name: 'path', type: 'string', description: 'File path', required: true }],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'File contents here' }),
      };

      // Simulate LLM returning native function calls (OpenAI style)
      const mockChat = vi
        .fn()
        .mockResolvedValueOnce({
          content: '',  // No text content when using native function calls
          stopReason: 'tool_calls',
          usage: { inputTokens: 10, outputTokens: 20 },
          toolCalls: [
            {
              id: 'call_abc123',
              name: 'read_file',
              arguments: { path: '/test/file.txt' },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: 'I read the file successfully!',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const agentWithTools = new Agent({
        name: 'ToolAgent',
        role: 'Tester',
        systemPrompt: 'Test',
        llmClient: customMockClient,
        tools: [tool],
      });

      const response = await agentWithTools.processMessageWithTools('Read the file');

      // Tool should be executed with native function call params
      expect(tool.execute).toHaveBeenCalledWith({ path: '/test/file.txt' });
      expect(response).toBe('I read the file successfully!');
    });

    it('should prefer native function calls over text parsing', async () => {
      const tool: Tool = {
        definition: {
          name: 'write_file',
          description: 'Write a file',
          parameters: [
            { name: 'path', type: 'string', description: 'File path', required: true },
            { name: 'content', type: 'string', description: 'Content', required: true },
          ],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'Written' }),
      };

      // Simulate LLM returning BOTH native function calls AND text-based tool call
      // Native should take priority
      const mockChat = vi
        .fn()
        .mockResolvedValueOnce({
          content: '<tool_call>{"tool": "different_tool", "params": {}}</tool_call>',
          stopReason: 'tool_calls',
          usage: { inputTokens: 10, outputTokens: 20 },
          toolCalls: [
            {
              id: 'call_xyz',
              name: 'write_file',
              arguments: { path: '/correct/path.txt', content: 'Native content' },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: 'Done!',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const agentWithTools = new Agent({
        name: 'ToolAgent',
        role: 'Tester',
        systemPrompt: 'Test',
        llmClient: customMockClient,
        tools: [tool],
      });

      const response = await agentWithTools.processMessageWithTools('Write the file');

      // Should use native function call, not text parsing
      expect(tool.execute).toHaveBeenCalledWith({
        path: '/correct/path.txt',
        content: 'Native content',
      });
      expect(response).toBe('Done!');
    });

    it('should fall back to text parsing when no native calls', async () => {
      const tool: Tool = {
        definition: {
          name: 'list_files',
          description: 'List files',
          parameters: [{ name: 'dir', type: 'string', description: 'Directory', required: true }],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'file1.txt\nfile2.txt' }),
      };

      // Simulate LLM returning only text-based tool call (no native)
      const mockChat = vi
        .fn()
        .mockResolvedValueOnce({
          content: '<tool_call>\n{"tool": "list_files", "params": {"dir": "/home"}}\n</tool_call>',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
          // No toolCalls property
        })
        .mockResolvedValueOnce({
          content: 'Found files!',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const agentWithTools = new Agent({
        name: 'ToolAgent',
        role: 'Tester',
        systemPrompt: 'Test',
        llmClient: customMockClient,
        tools: [tool],
      });

      const response = await agentWithTools.processMessageWithTools('List the files');

      // Should fall back to text-based parsing
      expect(tool.execute).toHaveBeenCalledWith({ dir: '/home' });
      expect(response).toBe('Found files!');
    });
  });
});
