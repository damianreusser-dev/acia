/**
 * Unit tests for DevAgent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevAgent } from '../../src/agents/dev/dev-agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';
import { Task } from '../../src/core/tasks/types.js';

// Mock LLMClient with tool call simulation
// First call returns a tool_call, second call returns completion
vi.mock('../../src/core/llm/client.js', () => {
  let callCount = 0;
  return {
    LLMClient: vi.fn().mockImplementation(() => ({
      chat: vi.fn().mockImplementation(() => {
        callCount++;
        // First call: return a tool call to trigger tool execution
        if (callCount % 2 === 1) {
          return Promise.resolve({
            content: '<tool_call>{"tool": "write_file", "params": {"path": "src/feature.ts", "content": "code"}}</tool_call>',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        }
        // Second call: return completion
        return Promise.resolve({
          content: 'Implementation completed successfully. Wrote to src/feature.ts with the new feature code.',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        });
      }),
    })),
  };
});

describe('DevAgent', () => {
  let mockLLMClient: LLMClient;
  let mockTools: Tool[];

  beforeEach(() => {
    mockLLMClient = new LLMClient({ apiKey: 'test-key' });

    mockTools = [
      {
        definition: {
          name: 'write_file',
          description: 'Write a file',
          parameters: [
            { name: 'path', type: 'string', description: 'Path', required: true },
            { name: 'content', type: 'string', description: 'Content', required: true },
          ],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'File written' }),
      },
      {
        definition: {
          name: 'read_file',
          description: 'Read a file',
          parameters: [
            { name: 'path', type: 'string', description: 'Path', required: true },
          ],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'File content' }),
      },
    ];
  });

  describe('constructor', () => {
    it('should create DevAgent with default name', () => {
      const agent = new DevAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.name).toBe('DevAgent');
      expect(agent.role).toBe('Developer');
    });

    it('should create DevAgent with custom name', () => {
      const agent = new DevAgent({
        name: 'CustomDev',
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.name).toBe('CustomDev');
    });

    it('should register provided tools', () => {
      const agent = new DevAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.getAvailableTools()).toEqual(['write_file', 'read_file']);
    });
  });

  describe('getWorkspace', () => {
    it('should return the workspace path', () => {
      const agent = new DevAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/my/workspace',
      });

      expect(agent.getWorkspace()).toBe('/my/workspace');
    });
  });

  describe('executeTask', () => {
    it('should execute a task and return success result', async () => {
      const agent = new DevAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Create feature X',
        description: 'Implement the feature X',
        status: 'pending',
        priority: 'medium',
        createdBy: 'PMAgent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      };

      const result = await agent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('completed');
    });

    it('should detect failure from response', async () => {
      const failingMock = {
        chat: vi.fn().mockResolvedValue({
          content: 'Failed to write file: permission denied',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      } as unknown as LLMClient;

      const agent = new DevAgent({
        llmClient: failingMock,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Create feature X',
        description: 'Implement the feature X',
        status: 'pending',
        priority: 'medium',
        createdBy: 'PMAgent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      };

      const result = await agent.executeTask(task);

      expect(result.success).toBe(false);
    });

    it('should extract modified files from response', async () => {
      // First call: return a tool call to trigger tool execution
      // Second call: return completion response
      let callCount = 0;
      const mockWithFiles = {
        chat: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              content: '<tool_call>{"tool": "write_file", "params": {"path": "src/feature.ts", "content": "code"}}</tool_call>',
              stopReason: 'end_turn',
              usage: { inputTokens: 10, outputTokens: 20 },
            });
          }
          return Promise.resolve({
            content: 'Successfully created "src/feature.ts" and wrote to "src/utils.ts"',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        }),
      } as unknown as LLMClient;

      const agent = new DevAgent({
        llmClient: mockWithFiles,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Create feature X',
        description: 'Implement the feature X',
        status: 'pending',
        priority: 'medium',
        createdBy: 'PMAgent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      };

      const result = await agent.executeTask(task);

      expect(result.filesModified).toContain('src/feature.ts');
    });

    it('should handle task context', async () => {
      const agent = new DevAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Create feature X',
        description: 'Implement the feature X',
        status: 'pending',
        priority: 'high',
        createdBy: 'PMAgent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        context: {
          relatedFiles: ['src/existing.ts'],
          requirements: ['Must be async'],
        },
      };

      const result = await agent.executeTask(task);

      // Should not throw and should process context
      expect(result).toBeDefined();
    });

    it('should handle LLM errors gracefully', async () => {
      const errorMock = {
        chat: vi.fn().mockRejectedValue(new Error('API Error')),
      } as unknown as LLMClient;

      const agent = new DevAgent({
        llmClient: errorMock,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Create feature X',
        description: 'Implement the feature X',
        status: 'pending',
        priority: 'medium',
        createdBy: 'PMAgent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      };

      const result = await agent.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });
});
