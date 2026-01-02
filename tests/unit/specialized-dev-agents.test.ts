/**
 * Specialized Developer Agent Tests
 *
 * Tests for FrontendDevAgent and BackendDevAgent.
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

    it('should create agent with custom name', () => {
      const customAgent = new FrontendDevAgent({
        name: 'MyFrontendDev',
        llmClient: mockLLMClient,
        tools: [],
        workspace: '/test',
      });
      expect(customAgent.name).toBe('MyFrontendDev');
    });

    it('should have Frontend Developer role', () => {
      expect(agent.role).toBe('Frontend Developer');
    });

    it('should store workspace path', () => {
      expect(agent.getWorkspace()).toBe('/test/workspace');
    });
  });

  describe('executeTask', () => {
    it('should execute a frontend task and return success', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'I created the React component TodoList.tsx successfully.',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Create TodoList component',
        description: 'Create a React component that displays a list of todos',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('created');
    });

    it('should detect failure from response', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'Failed to create the component due to a syntax error.',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Create component',
        description: 'Create a component',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);

      expect(result.success).toBe(false);
    });

    it('should include API contract in prompt when provided', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'Created component with API integration successfully.',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Create TodoList with API',
        description: 'Create TodoList that fetches from API',
        createdBy: 'test',
        context: {
          apiContract: {
            method: 'GET',
            path: '/api/todos',
            responseType: 'Todo[]',
          },
        },
      });

      await agent.executeTask(task);

      expect(mockLLMClient.chat).toHaveBeenCalled();
      // The prompt is passed as the first message in the messages array (LLMMessage[])
      const messages = vi.mocked(mockLLMClient.chat).mock.calls[0][0] as { role: string; content: string }[];
      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage!.content).toContain('API Contract');
      expect(userMessage!.content).toContain('/api/todos');
    });

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

    it('should extract modified .tsx files from response', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'I wrote to "src/components/TodoList.tsx" and created "src/types/Todo.tsx"',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Create components',
        description: 'Create components',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);

      expect(result.filesModified).toBeDefined();
      expect(result.filesModified).toContain('src/components/TodoList.tsx');
      expect(result.filesModified).toContain('src/types/Todo.tsx');
    });
  });

  describe('response analysis', () => {
    it('should detect success with .tsx mention', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'The component is now in TodoList.tsx',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Test',
        description: 'Test',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);
      expect(result.success).toBe(true);
    });

    it('should detect failure with type error', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'There was a type error in the component',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Test',
        description: 'Test',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);
      expect(result.success).toBe(false);
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

    it('should create agent with custom name', () => {
      const customAgent = new BackendDevAgent({
        name: 'MyBackendDev',
        llmClient: mockLLMClient,
        tools: [],
        workspace: '/test',
      });
      expect(customAgent.name).toBe('MyBackendDev');
    });

    it('should have Backend Developer role', () => {
      expect(agent.role).toBe('Backend Developer');
    });

    it('should store workspace path', () => {
      expect(agent.getWorkspace()).toBe('/test/workspace');
    });
  });

  describe('executeTask', () => {
    it('should execute a backend task and return success', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'I created the Express route for todos successfully.',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Create todos API endpoint',
        description: 'Create GET /api/todos endpoint',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('created');
    });

    it('should detect failure from response', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'Failed to create the endpoint due to an error.',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Create endpoint',
        description: 'Create an endpoint',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);

      expect(result.success).toBe(false);
    });

    it('should include API contract in prompt when provided', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'Created endpoint successfully.',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Create todos endpoint',
        description: 'Implement the todos API',
        createdBy: 'test',
        context: {
          apiContract: [
            {
              method: 'GET',
              path: '/api/todos',
              description: 'Get all todos',
              responseType: 'Todo[]',
            },
            {
              method: 'POST',
              path: '/api/todos',
              description: 'Create a todo',
              requestType: 'CreateTodoRequest',
              responseType: 'Todo',
            },
          ],
        },
      });

      await agent.executeTask(task);

      expect(mockLLMClient.chat).toHaveBeenCalled();
      const messages = vi.mocked(mockLLMClient.chat).mock.calls[0][0] as { role: string; content: string }[];
      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage!.content).toContain('API Contract');
      expect(userMessage!.content).toContain('/api/todos');
    });

    it('should include data models in prompt when provided', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'Created models successfully.',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Create data models',
        description: 'Implement data models',
        createdBy: 'test',
        context: {
          dataModels: `interface Todo {
  id: string;
  title: string;
  completed: boolean;
}`,
        },
      });

      await agent.executeTask(task);

      expect(mockLLMClient.chat).toHaveBeenCalled();
      const messages = vi.mocked(mockLLMClient.chat).mock.calls[0][0] as { role: string; content: string }[];
      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage!.content).toContain('Data Models');
      expect(userMessage!.content).toContain('interface Todo');
    });

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

    it('should extract modified .ts files from response', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'I wrote to "src/routes/todos.ts" and created "src/models/Todo.ts"',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Create routes',
        description: 'Create routes',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);

      expect(result.filesModified).toBeDefined();
      expect(result.filesModified).toContain('src/routes/todos.ts');
      expect(result.filesModified).toContain('src/models/Todo.ts');
    });
  });

  describe('response analysis', () => {
    it('should detect success with express mention', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'Set up the express router for the API',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Test',
        description: 'Test',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);
      expect(result.success).toBe(true);
    });

    it('should detect success with router mention', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'Created the router with all endpoints',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Test',
        description: 'Test',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);
      expect(result.success).toBe(true);
    });

    it('should detect failure with syntax error', async () => {
      vi.mocked(mockLLMClient.chat).mockResolvedValue({
        content: 'There was a syntax error in the route handler',
        usage: { inputTokens: 100, outputTokens: 50 },
      } as LLMResponse);

      const task = createTask({
        type: 'implement',
        title: 'Test',
        description: 'Test',
        createdBy: 'test',
      });

      const result = await agent.executeTask(task);
      expect(result.success).toBe(false);
    });
  });
});

describe('Agent Selection', () => {
  it('FrontendDevAgent should be appropriate for React tasks', () => {
    const agent = new FrontendDevAgent({
      llmClient: { chat: vi.fn() } as unknown as LLMClient,
      tools: [],
      workspace: '/test',
    });

    expect(agent.role).toBe('Frontend Developer');
  });

  it('BackendDevAgent should be appropriate for API tasks', () => {
    const agent = new BackendDevAgent({
      llmClient: { chat: vi.fn() } as unknown as LLMClient,
      tools: [],
      workspace: '/test',
    });

    expect(agent.role).toBe('Backend Developer');
  });
});
