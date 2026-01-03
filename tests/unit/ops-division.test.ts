/**
 * OpsDivision Unit Tests
 *
 * Tests for the operations division.
 * Part of Phase 6f-6g: OpsDivision and Registration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpsDivision } from '../../src/company/divisions/ops-division.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';
import { TeamFactory } from '../../src/team/team-factory.js';

// Mock LLM client
function createMockLLMClient(): LLMClient {
  return {
    chat: vi.fn().mockResolvedValue({
      content: 'Mock response: Task completed successfully',
      usage: { inputTokens: 10, outputTokens: 10 },
    }),
    chatWithFunctions: vi.fn().mockResolvedValue({
      content: 'Mock response',
      functionCalls: [],
      usage: { inputTokens: 10, outputTokens: 10 },
    }),
  } as unknown as LLMClient;
}

// Mock deploy tool with devops role
function createMockDeployTool(): Tool {
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
      output: 'Deployed successfully',
    }),
  };
}

// Mock health check tool with monitoring role
function createMockHealthCheckTool(): Tool {
  return {
    definition: {
      name: 'health_check',
      description: 'Check endpoint health',
      parameters: [
        { name: 'url', type: 'string', description: 'URL', required: true },
      ],
    },
    roles: ['monitoring', 'devops', 'ops'],
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: 'Health check passed',
    }),
  };
}

// Mock rollback tool with ops role
function createMockRollbackTool(): Tool {
  return {
    definition: {
      name: 'rollback_deployment',
      description: 'Rollback deployment',
      parameters: [
        { name: 'projectPath', type: 'string', description: 'Path', required: true },
      ],
    },
    roles: ['devops', 'ops'],
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: 'Rolled back',
    }),
  };
}

describe('OpsDivision', () => {
  let mockLLMClient: LLMClient;
  let mockTools: Tool[];

  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    mockTools = [
      createMockDeployTool(),
      createMockHealthCheckTool(),
      createMockRollbackTool(),
    ];
  });

  describe('constructor', () => {
    it('should create OpsDivision with default configuration', () => {
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      expect(ops.getName()).toBe('OpsDivision');
      expect(ops.getWorkspace()).toBe('/test/workspace');
    });

    it('should have devops, monitoring, and incident agent roles', () => {
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      expect(ops.getAgentRoles()).toContain('devops');
      expect(ops.getAgentRoles()).toContain('monitoring');
      expect(ops.getAgentRoles()).toContain('incident');
    });

    it('should create DevOps agent', () => {
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      expect(ops.getDevOpsAgent()).toBeDefined();
      expect(ops.getDevOpsAgent().role).toBe('DevOps Engineer');
    });

    it('should create Monitoring agent', () => {
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      expect(ops.getMonitoringAgent()).toBeDefined();
      expect(ops.getMonitoringAgent().role).toBe('Monitoring Engineer');
    });

    it('should create Incident agent', () => {
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      expect(ops.getIncidentAgent()).toBeDefined();
      expect(ops.getIncidentAgent().role).toBe('Incident Response Engineer');
    });

    it('should initialize with monitoring targets', () => {
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
        monitoringTargets: [
          { name: 'api', url: 'http://localhost:3000', healthEndpoint: '/health', checkInterval: 30 },
        ],
      });

      expect(ops.getMonitoringAgent().getTargets().length).toBe(1);
    });

    it('should initialize with runbooks', () => {
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
        runbooks: [
          {
            name: 'restart-api',
            description: 'Restart the API service',
            triggers: ['api_down'],
            steps: [{ name: 'Restart', action: 'restart_service', params: { target: 'api' } }],
          },
        ],
      });

      expect(ops.getIncidentAgent().getRunbook('restart-api')).toBeDefined();
    });
  });

  describe('task type detection', () => {
    it('should detect deployment tasks', async () => {
      const onProgress = vi.fn();
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
        onProgress,
      });

      await ops.executeTask('Deploy to production');

      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('deployment'));
    });

    it('should detect monitoring tasks', async () => {
      const onProgress = vi.fn();
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
        onProgress,
      });

      await ops.executeTask('Monitor health of services');

      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('monitoring'));
    });

    it('should detect incident tasks', async () => {
      const onProgress = vi.fn();
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
        onProgress,
      });

      await ops.executeTask('Handle incident - API is down');

      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('incident'));
    });
  });

  describe('executeTask', () => {
    it('should return WorkflowResult with task details', async () => {
      // Use a monitoring task instead of deploy since it doesn't require tool calls
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      const result = await ops.executeTask('Check service health status');

      // The task should be processed (success depends on LLM response)
      expect(result.task.title).toBe('Check service health status');
      expect(result.task).toBeDefined();
      expect(result.devResults).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const failingLLMClient = {
        chat: vi.fn().mockRejectedValue(new Error('LLM API error')),
        chatWithFunctions: vi.fn().mockRejectedValue(new Error('LLM API error')),
      } as unknown as LLMClient;

      const onEscalation = vi.fn();
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: failingLLMClient,
        tools: mockTools,
        onEscalation,
      });

      const result = await ops.executeTask('Deploy to production');

      expect(result.success).toBe(false);
      expect(result.escalated).toBe(true);
      expect(onEscalation).toHaveBeenCalled();
    });

    it('should respect priority', async () => {
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      const result = await ops.executeTask('Check service health status', 'critical');

      expect(result.task.priority).toBe('critical');
    });
  });

  describe('monitoring target management', () => {
    it('should add monitoring targets', () => {
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      expect(ops.getMonitoringAgent().getTargets().length).toBe(0);

      ops.addMonitoringTarget({
        name: 'api',
        url: 'http://localhost:3000',
        healthEndpoint: '/health',
        checkInterval: 30,
      });

      expect(ops.getMonitoringAgent().getTargets().length).toBe(1);
    });
  });

  describe('runbook management', () => {
    it('should register runbooks', () => {
      const ops = new OpsDivision({
        workspace: '/test/workspace',
        llmClient: mockLLMClient,
        tools: mockTools,
      });

      ops.registerRunbook({
        name: 'restart-api',
        description: 'Restart the API',
        triggers: ['api_down'],
        steps: [{ name: 'Restart', action: 'restart', params: {} }],
      });

      expect(ops.getIncidentAgent().getRunbook('restart-api')).toBeDefined();
    });
  });
});

describe('TeamFactory OpsTeam Registration', () => {
  it('should have ops team registered', () => {
    expect(TeamFactory.isRegistered('ops')).toBe(true);
  });

  it('should create OpsDivision via TeamFactory', () => {
    const mockLLMClient = createMockLLMClient();

    const team = TeamFactory.create('ops', {
      workspace: '/test/workspace',
      llmClient: mockLLMClient,
      tools: [],
    });

    expect(team.getName()).toBe('OpsDivision');
    expect(team.getAgentRoles()).toContain('devops');
  });

  it('should have both tech and ops teams registered', () => {
    const types = TeamFactory.getRegisteredTypes();

    expect(types).toContain('tech');
    expect(types).toContain('ops');
  });
});
