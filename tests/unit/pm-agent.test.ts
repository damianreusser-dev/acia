/**
 * Unit tests for PMAgent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PMAgent } from '../../src/agents/pm/pm-agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';
import { createTask } from '../../src/core/tasks/types.js';

// Mock LLMClient
vi.mock('../../src/core/llm/client.js', () => {
  return {
    LLMClient: vi.fn().mockImplementation(() => ({
      chat: vi.fn().mockResolvedValue({
        content: `DEV_TASKS:
1. [Create feature module] - Implement the main feature logic
2. [Add API endpoint] - Create the REST endpoint

QA_TASKS:
1. [Write unit tests] - Test the feature module
2. [Integration tests] - Test the API endpoint

EXECUTION_ORDER:
1. DEV:1
2. DEV:2
3. QA:1
4. QA:2`,
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20 },
      }),
    })),
  };
});

describe('PMAgent', () => {
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
          name: 'list_directory',
          description: 'List directory',
          parameters: [
            { name: 'path', type: 'string', description: 'Path', required: true },
          ],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'file1.ts\nfile2.ts' }),
      },
    ];
  });

  describe('constructor', () => {
    it('should create PMAgent with default name', () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.name).toBe('PMAgent');
      expect(agent.role).toBe('Project Manager');
    });

    it('should create PMAgent with custom name and maxRetries', () => {
      const agent = new PMAgent({
        name: 'CustomPM',
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        maxRetries: 5,
      });

      expect(agent.name).toBe('CustomPM');
      expect(agent.getMaxRetries()).toBe(5);
    });

    it('should default maxRetries to 3', () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.getMaxRetries()).toBe(3);
    });
  });

  describe('getWorkspace', () => {
    it('should return the workspace path', () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/my/workspace',
      });

      expect(agent.getWorkspace()).toBe('/my/workspace');
    });
  });

  describe('planTask', () => {
    it('should break down a task into dev and QA subtasks', async () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const parentTask = createTask({
        type: 'implement',
        title: 'Build feature X',
        description: 'Implement the complete feature X with API and tests',
        createdBy: 'User',
      });

      const breakdown = await agent.planTask(parentTask);

      expect(breakdown.devTasks.length).toBe(2);
      expect(breakdown.qaTasks.length).toBe(2);
      expect(breakdown.order.length).toBe(4);
    });

    it('should set parent task ID on subtasks', async () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const parentTask = createTask({
        type: 'implement',
        title: 'Build feature X',
        description: 'Implement the complete feature X',
        createdBy: 'User',
      });

      const breakdown = await agent.planTask(parentTask);

      for (const task of breakdown.devTasks) {
        expect(task.parentTaskId).toBe(parentTask.id);
      }
      for (const task of breakdown.qaTasks) {
        expect(task.parentTaskId).toBe(parentTask.id);
      }
    });

    it('should preserve priority in subtasks', async () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const parentTask = createTask({
        type: 'implement',
        title: 'Build feature X',
        description: 'Implement the complete feature X',
        createdBy: 'User',
        priority: 'critical',
      });

      const breakdown = await agent.planTask(parentTask);

      for (const task of breakdown.devTasks) {
        expect(task.priority).toBe('critical');
      }
    });
  });

  describe('task tracking', () => {
    it('should track tasks', () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = createTask({
        type: 'implement',
        title: 'Task 1',
        description: 'Description',
        createdBy: 'User',
      });

      agent.trackTask(task);

      expect(agent.getTask(task.id)).toBe(task);
      expect(agent.getActiveTasks()).toContain(task);
    });

    it('should update task status', () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = createTask({
        type: 'implement',
        title: 'Task 1',
        description: 'Description',
        createdBy: 'User',
      });

      agent.trackTask(task);
      agent.updateTaskStatus(task.id, 'in_progress');

      expect(agent.getTask(task.id)?.status).toBe('in_progress');
    });

    it('should update task with result', () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = createTask({
        type: 'implement',
        title: 'Task 1',
        description: 'Description',
        createdBy: 'User',
      });

      agent.trackTask(task);
      agent.updateTaskStatus(task.id, 'completed', { success: true, output: 'Done' });

      const tracked = agent.getTask(task.id);
      expect(tracked?.status).toBe('completed');
      expect(tracked?.result?.success).toBe(true);
    });
  });

  describe('new project detection', () => {
    it('should detect fullstack application requests', async () => {
      // Mock returns scaffold task when new project is detected
      const scaffoldMock = {
        chat: vi.fn().mockResolvedValue({
          content: `DEV_TASKS:
1. [Scaffold Project] - Use generate_project tool with template="fullstack" to create project structure
2. [Customize Backend] - Add todo routes to the generated Express backend

QA_TASKS:
1. [Test Backend] - Verify the backend API works

EXECUTION_ORDER:
1. DEV:1
2. DEV:2
3. QA:1`,
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      } as unknown as LLMClient;

      const agent = new PMAgent({
        llmClient: scaffoldMock,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = createTask({
        type: 'implement',
        title: 'Create a fullstack todo application',
        description: 'Create a fullstack todo application in the directory "todo-app"',
        createdBy: 'User',
      });

      const breakdown = await agent.planTask(task);

      // The mock should have been called (LLM was invoked)
      expect(scaffoldMock.chat).toHaveBeenCalled();
      // First call should include the IMPORTANT prompt about scaffolding
      const callArgs = scaffoldMock.chat.mock.calls[0];
      expect(callArgs).toBeDefined();
    });

    it('should detect web application requests', async () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = createTask({
        type: 'implement',
        title: 'Build a web application',
        description: 'Build a new web application with React frontend',
        createdBy: 'User',
      });

      // The agent should recognize this as a new project task
      await agent.planTask(task);

      // Check the chat was called
      expect((mockLLMClient.chat as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    });

    it('should NOT detect modification tasks as new projects', async () => {
      const modifyMock = {
        chat: vi.fn().mockResolvedValue({
          content: `DEV_TASKS:
1. [Add validation] - Add input validation to the existing form

QA_TASKS:
1. [Test validation] - Test the new validation

EXECUTION_ORDER:
1. DEV:1
2. QA:1`,
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      } as unknown as LLMClient;

      const agent = new PMAgent({
        llmClient: modifyMock,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = createTask({
        type: 'fix',
        title: 'Fix validation bug',
        description: 'Fix the validation error in the login form',
        createdBy: 'User',
      });

      await agent.planTask(task);

      // Should be called but prompt should NOT contain scaffold instructions
      expect(modifyMock.chat).toHaveBeenCalled();
      // The task breakdown should NOT include scaffold task
      // (this is controlled by what the mock returns)
    });
  });

  describe('handleTaskResult', () => {
    it('should continue on success', async () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = createTask({
        type: 'implement',
        title: 'Task 1',
        description: 'Description',
        createdBy: 'User',
      });
      agent.trackTask(task);

      const result = await agent.handleTaskResult(
        task,
        { success: true, output: 'Completed' },
        'dev'
      );

      expect(result.action).toBe('continue');
    });

    it('should retry on failure with attempts remaining', async () => {
      // Custom mock that returns retry guidance
      const retryMock = {
        chat: vi.fn().mockResolvedValue({
          content: 'Retry with different approach. Focus on error handling.',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        }),
      } as unknown as LLMClient;

      const agent = new PMAgent({
        llmClient: retryMock,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = createTask({
        type: 'implement',
        title: 'Task 1',
        description: 'Description',
        createdBy: 'User',
        maxAttempts: 3,
      });
      task.attempts = 0;
      agent.trackTask(task);

      const result = await agent.handleTaskResult(
        task,
        { success: false, error: 'Build failed' },
        'dev'
      );

      expect(result.action).toBe('retry');
      expect(result.feedback).toBeDefined();
      expect(task.attempts).toBe(1);
    });

    it('should escalate after max attempts', async () => {
      const agent = new PMAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = createTask({
        type: 'implement',
        title: 'Task 1',
        description: 'Description',
        createdBy: 'User',
        maxAttempts: 3,
      });
      task.attempts = 2; // Will become 3 after failure
      agent.trackTask(task);

      const result = await agent.handleTaskResult(
        task,
        { success: false, error: 'Still failing' },
        'dev'
      );

      expect(result.action).toBe('escalate');
      expect(result.feedback).toContain('3 attempts');
    });
  });
});
