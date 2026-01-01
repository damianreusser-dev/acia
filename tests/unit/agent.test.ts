/**
 * Unit tests for Base Agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../../src/agents/base/agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool, ToolDefinition, ToolResult } from '../../src/core/tools/types.js';

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
});
