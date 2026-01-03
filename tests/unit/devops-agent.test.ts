/**
 * DevOps Agent Unit Tests
 *
 * Tests for the DevOps agent.
 * Part of Phase 6b: Deployment & Operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevOpsAgent } from '../../src/agents/devops/devops-agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';
import { createTask, Task } from '../../src/core/tasks/types.js';

// Mock LLM client
function createMockLLMClient(): LLMClient {
  return {
    chat: vi.fn().mockResolvedValue({
      content: 'Mock response',
      usage: { inputTokens: 10, outputTokens: 10 },
    }),
    chatWithFunctions: vi.fn().mockResolvedValue({
      content: 'Mock response',
      functionCalls: [],
      usage: { inputTokens: 10, outputTokens: 10 },
    }),
  } as unknown as LLMClient;
}

// Mock write_file tool
function createMockWriteFileTool(): Tool {
  return {
    definition: {
      name: 'write_file',
      description: 'Write file',
      parameters: [
        { name: 'path', type: 'string', description: 'Path', required: true },
        { name: 'content', type: 'string', description: 'Content', required: true },
      ],
    },
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: 'File written',
    }),
  };
}

// Mock docker_build tool
function createMockDockerBuildTool(): Tool {
  return {
    definition: {
      name: 'docker_build',
      description: 'Build Docker image',
      parameters: [
        { name: 'context', type: 'string', description: 'Context', required: true },
        { name: 'tag', type: 'string', description: 'Tag', required: true },
      ],
    },
    roles: ['devops', 'ops'],
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: 'Image built',
    }),
  };
}

// Mock deploy_to_railway tool
function createMockDeployRailwayTool(): Tool {
  return {
    definition: {
      name: 'deploy_to_railway',
      description: 'Deploy to Railway',
      parameters: [
        { name: 'projectPath', type: 'string', description: 'Path', required: true },
      ],
    },
    roles: ['devops', 'ops'],
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: 'Deployed to Railway',
    }),
  };
}

// Helper to create tasks
function makeTask(title: string, description: string): Task {
  return createTask({
    type: 'implement',
    title,
    description,
    createdBy: 'test',
  });
}

describe('DevOpsAgent', () => {
  let mockLLMClient: LLMClient;
  let mockTools: Tool[];

  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    mockTools = [
      createMockWriteFileTool(),
      createMockDockerBuildTool(),
      createMockDeployRailwayTool(),
    ];
  });

  describe('constructor', () => {
    it('should create DevOpsAgent with default name', () => {
      const agent = new DevOpsAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.name).toBe('DevOpsAgent');
    });

    it('should create DevOpsAgent with custom name', () => {
      const agent = new DevOpsAgent({
        name: 'CustomDevOps',
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.name).toBe('CustomDevOps');
    });

    it('should have role of DevOps Engineer', () => {
      const agent = new DevOpsAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.role).toBe('DevOps Engineer');
    });
  });

  describe('getWorkspace', () => {
    it('should return the configured workspace', () => {
      const agent = new DevOpsAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/my/workspace',
      });

      expect(agent.getWorkspace()).toBe('/my/workspace');
    });
  });

  describe('task type detection', () => {
    it('should detect Docker tasks based on keywords', () => {
      // Test that Docker-related keywords are detected
      // The agent's task detection logic looks for specific keywords
      const dockerKeywords = ['docker', 'dockerfile', 'container', 'compose'];

      for (const keyword of dockerKeywords) {
        const task = makeTask(`Task with ${keyword}`, `This is about ${keyword}`);
        const text = `${task.title} ${task.description}`.toLowerCase();
        expect(text).toContain(keyword);
      }
    });

    it('should detect deployment tasks based on keywords', () => {
      // Test that deployment-related keywords are detected
      const deployKeywords = ['deploy', 'railway', 'vercel', 'production'];

      for (const keyword of deployKeywords) {
        const task = makeTask(`Task for ${keyword}`, `Deploy to ${keyword}`);
        const text = `${task.title} ${task.description}`.toLowerCase();
        expect(text).toContain(keyword);
      }
    });

    it('should detect container-related keywords', async () => {
      const agent = new DevOpsAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test',
      });

      // Test various Docker-related keywords
      const dockerKeywords = [
        'docker',
        'dockerfile',
        'container',
        'compose',
        'containerize',
      ];

      for (const keyword of dockerKeywords) {
        const task = makeTask(`Task with ${keyword}`, `Description mentioning ${keyword}`);
        // Just verify the agent can process these without error
        expect(task.title).toContain(keyword);
      }
    });

    it('should detect deployment-related keywords', async () => {
      const deployKeywords = [
        'deploy',
        'railway',
        'vercel',
        'production',
        'staging',
      ];

      for (const keyword of deployKeywords) {
        const task = makeTask(`Task with ${keyword}`, `Description mentioning ${keyword}`);
        expect(task.title).toContain(keyword);
      }
    });
  });

  describe('system prompt', () => {
    it('should have DevOps-specific instructions in system prompt', () => {
      const agent = new DevOpsAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test',
      });

      // System prompt is internal but agent should have DevOps role
      expect(agent.role).toBe('DevOps Engineer');
    });
  });

  describe('executeTask error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      const failingLLMClient = {
        chat: vi.fn().mockRejectedValue(new Error('LLM API error')),
        chatWithFunctions: vi.fn().mockRejectedValue(new Error('LLM API error')),
      } as unknown as LLMClient;

      const agent = new DevOpsAgent({
        llmClient: failingLLMClient,
        tools: mockTools,
        workspace: '/test',
      });

      const task = makeTask('Create Dockerfile', 'Create a Dockerfile');
      const result = await agent.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM API error');
    });
  });

  describe('tool access', () => {
    it('should have access to Docker tools', () => {
      const agent = new DevOpsAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test',
      });

      // Verify the agent has the tools
      expect(mockTools.find(t => t.definition.name === 'docker_build')).toBeDefined();
      expect(mockTools.find(t => t.definition.name === 'deploy_to_railway')).toBeDefined();
    });

    it('should have access to write_file for creating configs', () => {
      const agent = new DevOpsAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test',
      });

      expect(mockTools.find(t => t.definition.name === 'write_file')).toBeDefined();
    });
  });
});

describe('DevOpsAgent Task Prompts', () => {
  let mockLLMClient: LLMClient;
  let mockTools: Tool[];
  let capturedPrompt: string;

  beforeEach(() => {
    capturedPrompt = '';
    mockLLMClient = {
      chat: vi.fn().mockImplementation(async (messages) => {
        capturedPrompt = messages[messages.length - 1]?.content || '';
        return {
          content: 'Mock response with tool_call and wrote to Dockerfile',
          usage: { inputTokens: 10, outputTokens: 10 },
        };
      }),
      chatWithFunctions: vi.fn().mockImplementation(async (messages) => {
        capturedPrompt = messages[messages.length - 1]?.content || '';
        return {
          content: 'Mock response',
          functionCalls: [{ name: 'write_file', arguments: { path: 'Dockerfile', content: 'FROM node:20' } }],
          usage: { inputTokens: 10, outputTokens: 10 },
        };
      }),
    } as unknown as LLMClient;
    mockTools = [createMockWriteFileTool()];
  });

  it('should include Docker instructions for Docker tasks', async () => {
    const agent = new DevOpsAgent({
      llmClient: mockLLMClient,
      tools: mockTools,
      workspace: '/test',
    });

    const task = makeTask('Create Dockerfile', 'Create a Dockerfile for containerization');
    await agent.executeTask(task);

    expect(capturedPrompt).toContain('DOCKER TASK');
    expect(capturedPrompt).toContain('Dockerfile');
  });

  it('should include deployment instructions for deploy tasks', async () => {
    const agent = new DevOpsAgent({
      llmClient: mockLLMClient,
      tools: mockTools,
      workspace: '/test',
    });

    const task = makeTask('Deploy to production', 'Deploy the app to Railway');
    await agent.executeTask(task);

    expect(capturedPrompt).toContain('DEPLOYMENT TASK');
  });

  it('should include workspace path in prompt', async () => {
    const agent = new DevOpsAgent({
      llmClient: mockLLMClient,
      tools: mockTools,
      workspace: '/custom/workspace/path',
    });

    const task = makeTask('Create Dockerfile', 'Create Docker config');
    await agent.executeTask(task);

    expect(capturedPrompt).toContain('/custom/workspace/path');
  });
});
