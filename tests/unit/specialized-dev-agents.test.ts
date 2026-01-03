/**
 * Specialized Developer Agent Tests
 *
 * Tests for FrontendDevAgent and BackendDevAgent.
 * Updated to include tool call mocking for DevAgent inheritance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FrontendDevAgent } from '../../src/agents/dev/frontend-dev-agent.js';
import { BackendDevAgent } from '../../src/agents/dev/backend-dev-agent.js';
import { LLMClient, LLMResponse } from '../../src/core/llm/client.js';
import { createTask } from '../../src/core/tasks/types.js';
import { Tool, ToolResult } from '../../src/core/tools/types.js';

describe('FrontendDevAgent', () => {
  let mockLLMClient: LLMClient;
  let mockTool: Tool;
  let agent: FrontendDevAgent;

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn(),
    } as unknown as LLMClient;

    mockTool = {
      definition: {
        name: 'write_file',
        description: 'Write to a file',
        parameters: [],
      },
      execute: vi.fn().mockResolvedValue({ success: true, output: 'File written' } as ToolResult),
    };

    agent = new FrontendDevAgent({
      llmClient: mockLLMClient,
      tools: [mockTool],
      workspace: '/test/workspace',
    });
  });

  describe('constructor', () => {
    it('should create agent with default name', () => {
      expect(agent.name).toBe('FrontendDevAgent');
    });

    it('should have Frontend Developer role', () => {
      expect(agent.role).toBe('Frontend Developer');
    });

    it('should store workspace path', () => {
      expect(agent.getWorkspace()).toBe('/test/workspace');
    });
  });

  describe('executeTask', () => {
    it('should handle errors gracefully', async () => {
      vi.mocked(mockLLMClient.chat).mockRejectedValue(new Error('LLM Error'));

      const task = createTask({
        type: 'implement',
        title: 'Create component',
        description: 'Create a component',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);
      expect(result.success).toBe(false);
      expect(result.error).toBe('LLM Error');
    });
  });
});

describe('BackendDevAgent', () => {
  let mockLLMClient: LLMClient;
  let mockTool: Tool;
  let agent: BackendDevAgent;

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn(),
    } as unknown as LLMClient;

    mockTool = {
      definition: {
        name: 'write_file',
        description: 'Write to a file',
        parameters: [],
      },
      execute: vi.fn().mockResolvedValue({ success: true, output: 'File written' } as ToolResult),
    };

    agent = new BackendDevAgent({
      llmClient: mockLLMClient,
      tools: [mockTool],
      workspace: '/test/workspace',
    });
  });

  describe('constructor', () => {
    it('should create agent with default name', () => {
      expect(agent.name).toBe('BackendDevAgent');
    });

    it('should have Backend Developer role', () => {
      expect(agent.role).toBe('Backend Developer');
    });

    it('should store workspace path', () => {
      expect(agent.getWorkspace()).toBe('/test/workspace');
    });
  });

  describe('executeTask', () => {
    it('should handle errors gracefully', async () => {
      vi.mocked(mockLLMClient.chat).mockRejectedValue(new Error('LLM Error'));

      const task = createTask({
        type: 'implement',
        title: 'Create endpoint',
        description: 'Create an endpoint',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);
      expect(result.success).toBe(false);
      expect(result.error).toBe('LLM Error');
    });
  });
});

describe('Agent Selection', () => {
  it('FrontendDevAgent should have Frontend Developer role', () => {
    const agent = new FrontendDevAgent({
      llmClient: { chat: vi.fn() } as unknown as LLMClient,
      tools: [],
      workspace: '/test',
    });
    expect(agent.role).toBe('Frontend Developer');
  });

  it('BackendDevAgent should have Backend Developer role', () => {
    const agent = new BackendDevAgent({
      llmClient: { chat: vi.fn() } as unknown as LLMClient,
      tools: [],
      workspace: '/test',
    });
    expect(agent.role).toBe('Backend Developer');
  });
});
