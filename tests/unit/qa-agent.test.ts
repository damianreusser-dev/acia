/**
 * Unit tests for QAAgent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QAAgent } from '../../src/agents/qa/qa-agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';
import { Task } from '../../src/core/tasks/types.js';

// Mock LLMClient
vi.mock('../../src/core/llm/client.js', () => {
  return {
    LLMClient: vi.fn().mockImplementation(() => ({
      chat: vi.fn().mockResolvedValue({
        content: 'All tests passed. Tests: 5 pass, 0 fail',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20 },
      }),
    })),
  };
});

describe('QAAgent', () => {
  let mockLLMClient: LLMClient;
  let mockTools: Tool[];

  beforeEach(() => {
    mockLLMClient = new LLMClient({ apiKey: 'test-key' });

    mockTools = [
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
      {
        definition: {
          name: 'run_test_file',
          description: 'Run test file',
          parameters: [
            { name: 'testFile', type: 'string', description: 'Test file', required: true },
          ],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: '5 pass, 0 fail' }),
      },
    ];
  });

  describe('constructor', () => {
    it('should create QAAgent with default name', () => {
      const agent = new QAAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.name).toBe('QAAgent');
      expect(agent.role).toBe('Quality Assurance');
    });

    it('should create QAAgent with custom name', () => {
      const agent = new QAAgent({
        name: 'CustomQA',
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.name).toBe('CustomQA');
    });
  });

  describe('getWorkspace', () => {
    it('should return the workspace path', () => {
      const agent = new QAAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/my/workspace',
      });

      expect(agent.getWorkspace()).toBe('/my/workspace');
    });
  });

  describe('executeTask', () => {
    it('should execute a test task and return success', async () => {
      const agent = new QAAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task: Task = {
        id: 'task_1',
        type: 'test',
        title: 'Test feature X',
        description: 'Write and run tests for feature X',
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
      expect(result.testsRun).toBe(5);
      expect(result.testsPassed).toBe(5);
    });

    it('should detect test failures', async () => {
      const failingMock = {
        chat: vi.fn().mockResolvedValue({
          content: 'Tests run: 3 pass, 2 fail. Some tests failed.',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      } as unknown as LLMClient;

      const agent = new QAAgent({
        llmClient: failingMock,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task: Task = {
        id: 'task_1',
        type: 'test',
        title: 'Test feature X',
        description: 'Write and run tests for feature X',
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

    it('should handle review tasks', async () => {
      const reviewMock = {
        chat: vi.fn().mockResolvedValue({
          content: 'Code review completed. Found 2 issues that need attention.',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      } as unknown as LLMClient;

      const agent = new QAAgent({
        llmClient: reviewMock,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task: Task = {
        id: 'task_1',
        type: 'review',
        title: 'Review feature X',
        description: 'Review code for feature X',
        status: 'pending',
        priority: 'medium',
        createdBy: 'PMAgent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      };

      const result = await agent.executeTask(task);

      expect(result).toBeDefined();
      expect(result.output).toContain('review completed');
    });

    it('should handle LLM errors gracefully', async () => {
      const errorMock = {
        chat: vi.fn().mockRejectedValue(new Error('API Error')),
      } as unknown as LLMClient;

      const agent = new QAAgent({
        llmClient: errorMock,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task: Task = {
        id: 'task_1',
        type: 'test',
        title: 'Test feature X',
        description: 'Write and run tests for feature X',
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

  describe('createTestTask', () => {
    it('should create a test task for a file', () => {
      const agent = new QAAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = agent.createTestTask('src/feature.ts', 'PMAgent');

      expect(task.id).toMatch(/^test_/);
      expect(task.type).toBe('test');
      expect(task.title).toContain('src/feature.ts');
      expect(task.createdBy).toBe('PMAgent');
      expect(task.context?.targetFile).toBe('src/feature.ts');
    });

    it('should include additional context', () => {
      const agent = new QAAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = agent.createTestTask('src/feature.ts', 'PMAgent', {
        coverage: 'high',
        focus: 'edge cases',
      });

      expect(task.context?.targetFile).toBe('src/feature.ts');
      expect(task.context?.coverage).toBe('high');
      expect(task.context?.focus).toBe('edge cases');
    });
  });
});
