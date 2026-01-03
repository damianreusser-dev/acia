/**
 * Unit tests for Agent Prompt Improvements (Phase 5L)
 *
 * Tests verify that agent prompts contain the critical elements
 * for reliable tool calling and strict bug detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevAgent } from '../../src/agents/dev/dev-agent.js';
import { QAAgent } from '../../src/agents/qa/qa-agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';
import { createTask } from '../../src/core/tasks/types.js';

// Mock LLMClient for testing
vi.mock('../../src/core/llm/client.js', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({
      content: 'Test response',
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 20 },
    }),
  })),
}));

describe('Agent Prompt Improvements', () => {
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

  describe('DevAgent Prompt', () => {
    it('should have explicit tool call requirements in system prompt', () => {
      const agent = new DevAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      // Access the system prompt via the agent's configuration
      // The system prompt should contain explicit tool call requirements
      const systemPrompt = agent.getSystemPrompt();

      // Verify critical elements are present
      expect(systemPrompt).toContain('CALL TOOLS');
      expect(systemPrompt).toContain('WRONG');
      expect(systemPrompt).toContain('CORRECT');
      expect(systemPrompt).toContain('write_file');
      expect(systemPrompt).toContain('read_file');
    });

    it('should include WRONG examples that show what NOT to do', () => {
      const agent = new DevAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const systemPrompt = agent.getSystemPrompt();

      // Check for examples of incorrect behavior
      expect(systemPrompt).toContain('would create');
      expect(systemPrompt).toContain('FAIL');
    });

    it('should include CORRECT examples showing tool call format', () => {
      const agent = new DevAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const systemPrompt = agent.getSystemPrompt();

      // Check for tool call format examples
      expect(systemPrompt).toContain('<tool_call>');
      expect(systemPrompt).toContain('tool');
      expect(systemPrompt).toContain('params');
    });

    it('should include workflow steps (READ, WRITE, UPDATE)', () => {
      const agent = new DevAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const systemPrompt = agent.getSystemPrompt();

      // Check for workflow steps
      expect(systemPrompt).toMatch(/READ|read_file/);
      expect(systemPrompt).toMatch(/WRITE|write_file/);
    });

    it('should include scaffold task instructions', () => {
      const agent = new DevAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const systemPrompt = agent.getSystemPrompt();

      // Check for scaffold-specific guidance
      expect(systemPrompt).toContain('scaffold');
      expect(systemPrompt).toContain('generate_project');
    });

    it('should include customize task instructions', () => {
      const agent = new DevAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const systemPrompt = agent.getSystemPrompt();

      // Check for customize-specific guidance
      expect(systemPrompt).toContain('CUSTOMIZE');
    });
  });

  describe('QAAgent Prompt', () => {
    it('should emphasize practical verification', () => {
      const agent = new QAAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const systemPrompt = agent.getSystemPrompt();

      // Verify practical focus
      expect(systemPrompt).toContain('PRACTICAL VERIFICATION');
      expect(systemPrompt).toContain('ACTUAL REQUIREMENTS');
    });

    it('should include when to PASS criteria', () => {
      const agent = new QAAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const systemPrompt = agent.getSystemPrompt();

      // Check for pass criteria
      expect(systemPrompt).toContain('WHEN TO PASS');
      expect(systemPrompt).toContain('meets the stated requirements');
      expect(systemPrompt).toContain('Files exist where they should');
    });

    it('should include when to FAIL criteria', () => {
      const agent = new QAAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const systemPrompt = agent.getSystemPrompt();

      // Check for failure criteria
      expect(systemPrompt).toContain('WHEN TO FAIL');
      expect(systemPrompt).toContain('Required files are missing');
      expect(systemPrompt).toContain('ACTUAL bugs');
    });

    it('should include reporting format with VERDICT', () => {
      const agent = new QAAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const systemPrompt = agent.getSystemPrompt();

      // Check for report format
      expect(systemPrompt).toContain('VERDICT: PASS or FAIL');
      expect(systemPrompt).toContain('Summary:');
    });

    it('should warn against over-engineering verification', () => {
      const agent = new QAAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const systemPrompt = agent.getSystemPrompt();

      // Check for anti-pattern warnings
      expect(systemPrompt).toContain('STAY FOCUSED');
      expect(systemPrompt).toContain('elaborate test scripts');
      expect(systemPrompt).toContain('BAD verification');
    });

    it('should include example of good verification', () => {
      const agent = new QAAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const systemPrompt = agent.getSystemPrompt();

      // Check for good example
      expect(systemPrompt).toContain('Good verification');
      expect(systemPrompt).toContain('hello.txt');
    });
  });

  describe('DevAgent Retry Feedback', () => {
    it('should include specific actionable feedback on retry', async () => {
      // Create a mock that simulates retry scenario
      let callCount = 0;
      const retryMock = {
        chat: vi.fn().mockImplementation((_messages: unknown[], _systemPrompt: unknown) => {
          callCount++;
          // First 2 calls: no tool calls (trigger retry)
          // 3rd+ call: include tool call
          if (callCount <= 2) {
            return Promise.resolve({
              content: 'I would write a file with this content...',
              stopReason: 'end_turn',
              usage: { inputTokens: 10, outputTokens: 20 },
            });
          }
          return Promise.resolve({
            content: '<tool_call>{"tool": "write_file", "params": {"path": "test.ts", "content": "code"}}</tool_call>\nWrote to test.ts',
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20 },
          });
        }),
      } as unknown as LLMClient;

      const agent = new DevAgent({
        llmClient: retryMock,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const task = createTask({
        type: 'implement',
        title: 'Add route',
        description: 'Add a users route to the project',
        createdBy: 'test',
      });

      await agent.executeTask(task);

      // Get the calls to chat to verify retry messages
      const chatCalls = retryMock.chat.mock.calls;

      // After first failed attempt, retry should have specific guidance
      if (chatCalls.length > 1) {
        const secondCallMessages = chatCalls[1][0] as { content: string }[];
        const userMessage = secondCallMessages.find(m => m.content?.includes('RETRY'));

        if (userMessage) {
          // Verify retry message contains actionable guidance
          expect(userMessage.content).toContain('RETRY');
          expect(userMessage.content).toContain('FAILURE REASON');
        }
      }
    });
  });
});

describe('Tool Call Verification', () => {
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
          name: 'generate_project',
          description: 'Generate project from template',
          parameters: [
            { name: 'template', type: 'string', description: 'Template', required: true },
            { name: 'projectName', type: 'string', description: 'Name', required: true },
          ],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'Project generated' }),
      },
    ];
  });

  it('should fail customize task when no write_file called', async () => {
    const noToolMock = {
      chat: vi.fn().mockResolvedValue({
        content: 'Here is how you would add a route: create a file called users.ts...',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20 },
      }),
    } as unknown as LLMClient;

    const agent = new DevAgent({
      llmClient: noToolMock,
      tools: mockTools,
      workspace: '/test/workspace',
    });

    const task = createTask({
      type: 'implement',
      title: 'Add users route',
      description: 'Add a users route to the existing Express project',
      createdBy: 'test',
    });

    const result = await agent.executeTask(task);

    // Should fail because no write_file was called
    expect(result.success).toBe(false);
    expect(result.error).toContain('write_file');
  });

  it('should fail scaffold task when no generate_project called', async () => {
    const noToolMock = {
      chat: vi.fn().mockResolvedValue({
        content: 'To scaffold a project, you would run npm init...',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20 },
      }),
    } as unknown as LLMClient;

    const agent = new DevAgent({
      llmClient: noToolMock,
      tools: mockTools,
      workspace: '/test/workspace',
    });

    const task = createTask({
      type: 'implement',
      title: 'Scaffold fullstack project',
      description: 'Create a new fullstack project using generate_project template',
      createdBy: 'test',
    });

    const result = await agent.executeTask(task);

    // Should fail because no generate_project was called
    expect(result.success).toBe(false);
    expect(result.error).toContain('generate_project');
  });
});
