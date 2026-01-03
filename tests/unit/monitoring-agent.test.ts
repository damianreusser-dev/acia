/**
 * MonitoringAgent Unit Tests
 *
 * Tests for the monitoring agent.
 * Part of Phase 6c-6e: MonitoringAgent and IncidentAgent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonitoringAgent, MonitoringTarget } from '../../src/agents/ops/monitoring-agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';
import { createTask } from '../../src/core/tasks/types.js';

// Mock LLM client
function createMockLLMClient(): LLMClient {
  return {
    chat: vi.fn().mockResolvedValue({
      content: 'Mock monitoring response: All targets checked and healthy',
      usage: { inputTokens: 10, outputTokens: 10 },
    }),
    chatWithFunctions: vi.fn().mockResolvedValue({
      content: 'Mock response',
      functionCalls: [],
      usage: { inputTokens: 10, outputTokens: 10 },
    }),
  } as unknown as LLMClient;
}

// Mock health_check tool
function createMockHealthCheckTool(): Tool {
  return {
    definition: {
      name: 'health_check',
      description: 'Check endpoint health',
      parameters: [
        { name: 'url', type: 'string', description: 'URL to check', required: true },
      ],
    },
    roles: ['monitoring', 'devops', 'ops'],
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: 'Health check passed: status 200',
    }),
  };
}

describe('MonitoringAgent', () => {
  let mockLLMClient: LLMClient;
  let mockTools: Tool[];
  const testTargets: MonitoringTarget[] = [
    { name: 'backend', url: 'http://localhost:3000', healthEndpoint: '/health', checkInterval: 30 },
    { name: 'frontend', url: 'http://localhost:8080', healthEndpoint: '/health', checkInterval: 30 },
  ];

  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    mockTools = [createMockHealthCheckTool()];
  });

  describe('constructor', () => {
    it('should create MonitoringAgent with default name', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.name).toBe('MonitoringAgent');
    });

    it('should create MonitoringAgent with custom name', () => {
      const agent = new MonitoringAgent({
        name: 'CustomMonitor',
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.name).toBe('CustomMonitor');
    });

    it('should have role of Monitoring Engineer', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.role).toBe('Monitoring Engineer');
    });

    it('should initialize with provided targets', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        targets: testTargets,
      });

      expect(agent.getTargets().length).toBe(2);
    });

    it('should set default alert threshold to 3', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      // Check by recording health checks and verifying alert is created at 3
      agent.addTarget(testTargets[0]);
      agent.recordHealthCheck('backend', false);
      agent.recordHealthCheck('backend', false);
      expect(agent.getAlerts().length).toBe(0);
      agent.recordHealthCheck('backend', false);
      expect(agent.getAlerts().length).toBe(1);
    });

    it('should use custom alert threshold', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        alertThreshold: 5,
        targets: testTargets,
      });

      // Record 4 failures - should not alert yet
      for (let i = 0; i < 4; i++) {
        agent.recordHealthCheck('backend', false);
      }
      expect(agent.getAlerts().length).toBe(0);

      // 5th failure should trigger alert
      agent.recordHealthCheck('backend', false);
      expect(agent.getAlerts().length).toBe(1);
    });
  });

  describe('target management', () => {
    it('should add a target', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      agent.addTarget(testTargets[0]);
      expect(agent.getTargets().length).toBe(1);
      expect(agent.getTargets()[0].name).toBe('backend');
    });

    it('should remove a target', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        targets: testTargets,
      });

      expect(agent.getTargets().length).toBe(2);
      const removed = agent.removeTarget('backend');
      expect(removed).toBe(true);
      expect(agent.getTargets().length).toBe(1);
      expect(agent.getTargets()[0].name).toBe('frontend');
    });

    it('should return false when removing non-existent target', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const removed = agent.removeTarget('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('health check recording', () => {
    it('should record healthy status', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        targets: testTargets,
      });

      agent.recordHealthCheck('backend', true);
      const state = agent.getHealthState('backend');

      expect(state).toBeDefined();
      expect(state?.lastStatus).toBe('healthy');
      expect(state?.consecutiveFailures).toBe(0);
    });

    it('should record unhealthy status', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        targets: testTargets,
      });

      agent.recordHealthCheck('backend', false, 'Connection refused');
      const state = agent.getHealthState('backend');

      expect(state).toBeDefined();
      expect(state?.lastStatus).toBe('unhealthy');
      expect(state?.consecutiveFailures).toBe(1);
      expect(state?.lastError).toBe('Connection refused');
    });

    it('should track consecutive failures', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        targets: testTargets,
      });

      agent.recordHealthCheck('backend', false);
      agent.recordHealthCheck('backend', false);
      agent.recordHealthCheck('backend', false);

      const state = agent.getHealthState('backend');
      expect(state?.consecutiveFailures).toBe(3);
    });

    it('should reset consecutive failures on success', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        targets: testTargets,
      });

      agent.recordHealthCheck('backend', false);
      agent.recordHealthCheck('backend', false);
      expect(agent.getHealthState('backend')?.consecutiveFailures).toBe(2);

      agent.recordHealthCheck('backend', true);
      expect(agent.getHealthState('backend')?.consecutiveFailures).toBe(0);
      expect(agent.getHealthState('backend')?.lastStatus).toBe('healthy');
    });
  });

  describe('alert generation', () => {
    it('should create alert when threshold reached', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        targets: testTargets,
        alertThreshold: 3,
      });

      agent.recordHealthCheck('backend', false);
      agent.recordHealthCheck('backend', false);
      expect(agent.getAlerts().length).toBe(0);

      agent.recordHealthCheck('backend', false);
      expect(agent.getAlerts().length).toBe(1);
    });

    it('should set medium severity for 3-4 failures', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        targets: testTargets,
        alertThreshold: 3,
      });

      agent.recordHealthCheck('backend', false);
      agent.recordHealthCheck('backend', false);
      agent.recordHealthCheck('backend', false);

      const alerts = agent.getAlerts();
      expect(alerts[0].severity).toBe('medium');
    });

    it('should set high severity for 5-9 failures', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        targets: testTargets,
        alertThreshold: 3,
      });

      for (let i = 0; i < 5; i++) {
        agent.recordHealthCheck('backend', false);
      }

      const alerts = agent.getAlerts();
      expect(alerts.some(a => a.severity === 'high')).toBe(true);
    });

    it('should set critical severity for 10+ failures', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        targets: testTargets,
        alertThreshold: 3,
      });

      for (let i = 0; i < 10; i++) {
        agent.recordHealthCheck('backend', false);
      }

      const alerts = agent.getAlerts();
      expect(alerts.some(a => a.severity === 'critical')).toBe(true);
    });
  });

  describe('getWorkspace', () => {
    it('should return the configured workspace', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/my/workspace',
      });

      expect(agent.getWorkspace()).toBe('/my/workspace');
    });
  });

  describe('getAllHealthStates', () => {
    it('should return all health states', () => {
      const agent = new MonitoringAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        targets: testTargets,
      });

      agent.recordHealthCheck('backend', true);
      agent.recordHealthCheck('frontend', false);

      const states = agent.getAllHealthStates();
      expect(states.length).toBe(2);
      expect(states.find(s => s.target === 'backend')?.lastStatus).toBe('healthy');
      expect(states.find(s => s.target === 'frontend')?.lastStatus).toBe('unhealthy');
    });
  });
});
