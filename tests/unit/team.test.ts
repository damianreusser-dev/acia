/**
 * Unit tests for Team coordination
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Team } from '../../src/team/team.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';

// Mock LLMClient with tool call simulation
// DevAgent now requires actual tool calls or it will retry
vi.mock('../../src/core/llm/client.js', () => {
  return {
    LLMClient: vi.fn().mockImplementation(() => {
      let callCount = 0;
      return {
        chat: vi.fn().mockImplementation(() => {
          callCount++;
          // Alternate between tool calls and completions
          // This satisfies the DevAgent's tool call verification
          if (callCount % 2 === 1) {
            return Promise.resolve({
              content: '<tool_call>{"tool": "write_file", "params": {"path": "src/file.ts", "content": "code"}}</tool_call>',
              stopReason: 'end_turn',
              usage: { inputTokens: 10, outputTokens: 20 },
            });
          }
          return Promise.resolve({
            content: 'Task completed successfully. Wrote to src/file.ts.',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        }),
      };
    }),
  };
});

describe('Team', () => {
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
          name: 'list_directory',
          description: 'List directory',
          parameters: [
            { name: 'path', type: 'string', description: 'Path', required: true },
          ],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'file1.ts\nfile2.ts' }),
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
    it('should create a team with PM, Dev, and QA agents', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      expect(team.getPMAgent()).toBeDefined();
      expect(team.getDevAgent()).toBeDefined();
      expect(team.getQAAgent()).toBeDefined();
    });

    it('should give PM only read-only tools', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      const pmTools = team.getPMAgent().getAvailableTools();
      expect(pmTools).toContain('read_file');
      expect(pmTools).toContain('list_directory');
      expect(pmTools).not.toContain('write_file');
      expect(pmTools).not.toContain('run_test_file');
    });

    it('should give Dev all tools', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      const devTools = team.getDevAgent().getAvailableTools();
      expect(devTools).toContain('read_file');
      expect(devTools).toContain('write_file');
      expect(devTools).toContain('list_directory');
      expect(devTools).toContain('run_test_file');
    });

    it('should give QA all tools', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      const qaTools = team.getQAAgent().getAvailableTools();
      expect(qaTools).toContain('read_file');
      expect(qaTools).toContain('write_file');
      expect(qaTools).toContain('run_test_file');
    });

    it('should pass maxRetries to PM', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
        maxRetries: 5,
      });

      expect(team.getPMAgent().getMaxRetries()).toBe(5);
    });

    it('should set maxIterations', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
        maxIterations: 5,
      });

      expect(team.getMaxIterations()).toBe(5);
    });

    it('should default maxIterations to 5', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      expect(team.getMaxIterations()).toBe(5);
    });
  });

  describe('getWorkspace', () => {
    it('should return the workspace path', () => {
      const team = new Team({
        workspace: '/my/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      expect(team.getWorkspace()).toBe('/my/workspace');
    });
  });

  describe('executeTask', () => {
    it('should execute a simple task workflow', async () => {
      // Mock PM planning response
      const planResponse = `DEV_TASKS:
1. [Create module] - Create the main module

QA_TASKS:
1. [Test module] - Test the module

EXECUTION_ORDER:
1. DEV:1
2. QA:1`;

      // Mock responses for the workflow (now with tool call support)
      let callCount = 0;
      const mockChat = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // PM planning
          return Promise.resolve({
            content: planResponse,
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        } else if (callCount === 2) {
          // Dev tool call
          return Promise.resolve({
            content: '<tool_call>{"tool": "write_file", "params": {"path": "src/module.ts", "content": "code"}}</tool_call>',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        } else if (callCount === 3) {
          // Dev completion
          return Promise.resolve({
            content: 'Successfully created the module. Wrote to src/module.ts with the implementation.',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        } else {
          // QA and any other calls
          return Promise.resolve({
            content: 'All tests passed. 3 pass, 0 fail. Wrote to test-results.json.',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        }
      });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const team = new Team({
        workspace: '/test/workspace',
        llmClient: customMockClient,
        tools: mockTools,
      });

      const result = await team.executeTask('Create a greeting module');

      expect(result.success).toBe(true);
      expect(result.escalated).toBe(false);
      expect(result.devResults.length).toBe(1);
      expect(result.qaResults.length).toBe(1);
      expect(result.breakdown?.devTasks.length).toBe(1);
      expect(result.breakdown?.qaTasks.length).toBe(1);
      expect(result.iterations).toBe(1);
    });

    it('should escalate when planning fails', async () => {
      const errorMock = {
        chat: vi.fn().mockRejectedValue(new Error('LLM Error')),
      } as unknown as LLMClient;

      const team = new Team({
        workspace: '/test/workspace',
        llmClient: errorMock,
        tools: mockTools,
      });

      const result = await team.executeTask('Create something');

      expect(result.success).toBe(false);
      expect(result.escalated).toBe(true);
      expect(result.escalationReason).toContain('Failed to plan task');
    });

    it('should handle dev task failure and retry', async () => {
      // Mock responses: plan, dev fail (with tool call), PM analyze, dev retry success, QA pass
      // Now DevAgent requires tool calls, so we need to include tool calls in dev responses
      let callCount = 0;
      const mockChat = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // PM planning
          return Promise.resolve({
            content: `DEV_TASKS:
1. [Create module] - Create the module

QA_TASKS:
1. [Test module] - Test it

EXECUTION_ORDER:
1. DEV:1
2. QA:1`,
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        } else if (callCount === 2) {
          // Dev tool call (attempt 1)
          return Promise.resolve({
            content: '<tool_call>{"tool": "write_file", "params": {"path": "src/module.ts", "content": "code"}}</tool_call>',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        } else if (callCount === 3) {
          // Dev completion (attempt 1) - fails
          return Promise.resolve({
            content: 'Failed to write file: syntax error',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        } else if (callCount === 4) {
          // PM analyzes failure
          return Promise.resolve({
            content: 'Please fix the syntax error and try again.',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        } else if (callCount === 5) {
          // Dev tool call (attempt 2)
          return Promise.resolve({
            content: '<tool_call>{"tool": "write_file", "params": {"path": "src/module.ts", "content": "fixed code"}}</tool_call>',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        } else if (callCount === 6) {
          // Dev completion (attempt 2) - succeeds
          return Promise.resolve({
            content: 'Successfully created the module. Wrote to src/module.ts.',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        } else {
          // QA and any other calls
          return Promise.resolve({
            content: 'All tests passed. Wrote to test-results.json.',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        }
      });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const team = new Team({
        workspace: '/test/workspace',
        llmClient: customMockClient,
        tools: mockTools,
        maxRetries: 3,
      });

      const result = await team.executeTask('Create a module');

      expect(result.success).toBe(true);
      expect(result.devResults.length).toBe(2); // Initial + retry
    });

    it('should escalate after max retries', async () => {
      const mockChat = vi
        .fn()
        // PM planning
        .mockResolvedValueOnce({
          content: `DEV_TASKS:
1. [Create module] - Create module

QA_TASKS:
1. [Test] - Test

EXECUTION_ORDER:
1. DEV:1`,
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        })
        // All attempts fail
        .mockResolvedValue({
          content: 'Failed to complete task',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const team = new Team({
        workspace: '/test/workspace',
        llmClient: customMockClient,
        tools: mockTools,
        maxRetries: 1, // Only 1 attempt allowed
      });

      const result = await team.executeTask('Create something impossible');

      expect(result.success).toBe(false);
      expect(result.escalated).toBe(true);
    });

    it('should use provided priority', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: `DEV_TASKS:
1. [Task] - Description

QA_TASKS:

EXECUTION_ORDER:
1. DEV:1`,
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20 },
      });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const team = new Team({
        workspace: '/test/workspace',
        llmClient: customMockClient,
        tools: mockTools,
      });

      const result = await team.executeTask('Critical task', 'critical');

      expect(result.task.priority).toBe('critical');
    });

    it('should call onEscalation callback when escalating', async () => {
      const errorMock = {
        chat: vi.fn().mockRejectedValue(new Error('LLM Error')),
      } as unknown as LLMClient;

      const onEscalation = vi.fn();

      const team = new Team({
        workspace: '/test/workspace',
        llmClient: errorMock,
        tools: mockTools,
        onEscalation,
      });

      await team.executeTask('Create something');

      expect(onEscalation).toHaveBeenCalled();
      expect(onEscalation.mock.calls[0][0]).toContain('Failed to plan task');
    });

    it('should call onProgress callback during execution', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: `DEV_TASKS:
1. [Task] - Description

QA_TASKS:

EXECUTION_ORDER:
1. DEV:1`,
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20 },
      });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;
      const onProgress = vi.fn();

      const team = new Team({
        workspace: '/test/workspace',
        llmClient: customMockClient,
        tools: mockTools,
        onProgress,
      });

      await team.executeTask('Create something');

      expect(onProgress).toHaveBeenCalled();
      // Should have planning message
      expect(onProgress.mock.calls.some((call) => call[0].includes('Planning'))).toBe(
        true
      );
    });

    it('should track iterations', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: `DEV_TASKS:
1. [Task] - Description

QA_TASKS:

EXECUTION_ORDER:
1. DEV:1`,
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20 },
      });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const team = new Team({
        workspace: '/test/workspace',
        llmClient: customMockClient,
        tools: mockTools,
      });

      const result = await team.executeTask('Task');

      expect(result.iterations).toBeGreaterThanOrEqual(1);
    });
  });

  describe('specialized dev agents', () => {
    it('should have frontend and backend dev agents', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      expect(team.getFrontendDevAgent()).toBeDefined();
      expect(team.getBackendDevAgent()).toBeDefined();
      expect(team.getFrontendDevAgent().role).toBe('Frontend Developer');
      expect(team.getBackendDevAgent().role).toBe('Backend Developer');
    });

    it('should give frontend dev agent all tools', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      const frontendTools = team.getFrontendDevAgent().getAvailableTools();
      expect(frontendTools).toContain('read_file');
      expect(frontendTools).toContain('write_file');
    });

    it('should give backend dev agent all tools', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      const backendTools = team.getBackendDevAgent().getAvailableTools();
      expect(backendTools).toContain('read_file');
      expect(backendTools).toContain('write_file');
    });
  });

  describe('agent selection', () => {
    let team: Team;

    beforeEach(() => {
      team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });
    });

    it('should select frontend agent for React component tasks', () => {
      const task = {
        id: 'test-1',
        type: 'implement' as const,
        title: 'Create TodoList React component',
        description: 'Create a React component for displaying todos',
        status: 'pending' as const,
        priority: 'medium' as const,
        createdBy: 'test',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(team.selectDevAgentType(task)).toBe('frontend');
    });

    it('should select frontend agent for TSX file tasks', () => {
      const task = {
        id: 'test-2',
        type: 'implement' as const,
        title: 'Update header',
        description: 'Update the header',
        status: 'pending' as const,
        priority: 'medium' as const,
        createdBy: 'test',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        context: { files: ['src/components/Header.tsx'] },
      };

      expect(team.selectDevAgentType(task)).toBe('frontend');
    });

    it('should select backend agent for API endpoint tasks', () => {
      const task = {
        id: 'test-3',
        type: 'implement' as const,
        title: 'Create API endpoint for users',
        description: 'Create a REST API endpoint to get user data',
        status: 'pending' as const,
        priority: 'medium' as const,
        createdBy: 'test',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(team.selectDevAgentType(task)).toBe('backend');
    });

    it('should select backend agent for Express route tasks', () => {
      const task = {
        id: 'test-4',
        type: 'implement' as const,
        title: 'Add new route',
        description: 'Add express router for authentication',
        status: 'pending' as const,
        priority: 'medium' as const,
        createdBy: 'test',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(team.selectDevAgentType(task)).toBe('backend');
    });

    it('should select backend agent for database tasks', () => {
      const task = {
        id: 'test-5',
        type: 'implement' as const,
        title: 'Create user model',
        description: 'Create database model and schema for users',
        status: 'pending' as const,
        priority: 'medium' as const,
        createdBy: 'test',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(team.selectDevAgentType(task)).toBe('backend');
    });

    it('should respect explicit agent type in context', () => {
      const task = {
        id: 'test-6',
        type: 'implement' as const,
        title: 'Create something',
        description: 'Create something generic',
        status: 'pending' as const,
        priority: 'medium' as const,
        createdBy: 'test',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        context: { agentType: 'frontend' },
      };

      expect(team.selectDevAgentType(task)).toBe('frontend');
    });

    it('should default to general agent for ambiguous tasks', () => {
      const task = {
        id: 'test-7',
        type: 'implement' as const,
        title: 'Create utility function',
        description: 'Create a helper function',
        status: 'pending' as const,
        priority: 'medium' as const,
        createdBy: 'test',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(team.selectDevAgentType(task)).toBe('general');
    });
  });

  describe('iteration loop', () => {
    it('should create fix tasks when QA fails', async () => {
      let callCount = 0;
      const mockChat = vi.fn().mockImplementation(() => {
        callCount++;
        // PM planning (call 1)
        if (callCount === 1) {
          return Promise.resolve({
            content: `DEV_TASKS:
1. [Create feature] - Create the feature

QA_TASKS:
1. [Test feature] - Test the feature

EXECUTION_ORDER:
1. DEV:1
2. QA:1`,
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        }
        // Dev creates feature (call 2)
        if (callCount === 2) {
          return Promise.resolve({
            content: 'Successfully created feature.',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        }
        // QA fails first time (call 3)
        if (callCount === 3) {
          return Promise.resolve({
            content: 'Test failed: missing error handling',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        }
        // All subsequent calls succeed
        return Promise.resolve({
          content: 'All tests passed. Successfully completed.',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        });
      });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const team = new Team({
        workspace: '/test/workspace',
        llmClient: customMockClient,
        tools: mockTools,
        maxIterations: 3,
      });

      const result = await team.executeTask('Create feature');

      expect(result.success).toBe(true);
      expect(result.iterations).toBeGreaterThanOrEqual(1);
      expect(result.devResults.length).toBeGreaterThanOrEqual(1);
      expect(result.qaResults.length).toBeGreaterThanOrEqual(1);
    });

    it('should stop after maxIterations', async () => {
      let callCount = 0;
      const mockChat = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // PM planning
          return {
            content: `DEV_TASKS:
1. [Create feature] - Create the feature

QA_TASKS:
1. [Test feature] - Test the feature

EXECUTION_ORDER:
1. DEV:1
2. QA:1`,
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          };
        }
        // Dev needs tool calls now. Cycle: tool_call -> completion -> QA fail
        const responseNum = (callCount - 1) % 3;
        if (responseNum === 0) {
          // Dev tool call
          return {
            content: '<tool_call>{"tool": "write_file", "params": {"path": "src/file.ts", "content": "code"}}</tool_call>',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          };
        } else if (responseNum === 1) {
          // Dev completion
          return {
            content: 'Feature created successfully. Wrote to src/feature.ts with implementation.',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          };
        } else {
          // QA failure to trigger next iteration
          return {
            content: 'Test failed - feature not working correctly',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          };
        }
      });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const team = new Team({
        workspace: '/test/workspace',
        llmClient: customMockClient,
        tools: mockTools,
        maxIterations: 2,
      });

      const result = await team.executeTask('Create feature');

      expect(result.success).toBe(false);
      expect(result.escalated).toBe(true);
      expect(result.escalationReason).toContain('Max iterations');
      expect(result.iterations).toBe(2);
    });
  });

  describe('project path tracking', () => {
    it('should detect scaffold tasks', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      // Access private method via any cast for testing
      const isScaffold = (team as any).isScaffoldTask;

      expect(isScaffold({ title: 'Scaffold project', description: '' })).toBe(true);
      expect(isScaffold({ title: 'Create project', description: '' })).toBe(true);
      expect(isScaffold({ title: 'Use generate_project', description: '' })).toBe(true);
      expect(isScaffold({ title: 'Add feature', description: '' })).toBe(false);
    });

    it('should extract project path from scaffold result', () => {
      const team = new Team({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      // Access private method via any cast for testing
      const extractPath = (team as any).extractProjectPath.bind(team);

      // Test various output formats
      expect(extractPath(
        { success: true, output: 'Project created at: todo-app/backend' },
        { title: 'Scaffold', description: '' }
      )).toBe('todo-app/backend');

      expect(extractPath(
        { success: true, output: 'Created files in: my-api/backend' },
        { title: 'Scaffold', description: '' }
      )).toBe('my-api/backend');

      // Fallback to projectName in context
      expect(extractPath(
        { success: true, output: '' },
        { title: 'Scaffold', description: '', context: { projectName: 'my-project' } }
      )).toBe('my-project/backend');
    });

    it('should inject project path into task context', async () => {
      let capturedTask: any = null;

      // Mock that captures the task passed to agent
      const mockChat = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          content: '<tool_call>{"tool": "write_file", "params": {"path": "src/file.ts", "content": "code"}}</tool_call>\nCompleted.',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 20 },
        });
      });

      const customMockClient = { chat: mockChat } as unknown as LLMClient;

      const team = new Team({
        workspace: '/test/workspace',
        llmClient: customMockClient,
        tools: mockTools,
      });

      // Set active project path manually for testing
      (team as any).activeProjectPath = 'my-project/backend';

      // Create a mock task
      const task = {
        id: 'test-1',
        type: 'implement' as const,
        title: 'Add route',
        description: 'Add a new route',
        status: 'pending' as const,
        priority: 'medium' as const,
        createdBy: 'test',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Execute task through the private method
      await (team as any).executeDevTask(task);

      // Verify project path was injected
      expect(task.context?.projectPath).toBe('my-project/backend');
    });
  });
});
