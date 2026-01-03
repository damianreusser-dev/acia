/**
 * IncidentAgent Unit Tests
 *
 * Tests for the incident agent.
 * Part of Phase 6c-6e: MonitoringAgent and IncidentAgent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncidentAgent, Runbook } from '../../src/agents/ops/incident-agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';
import { createTask } from '../../src/core/tasks/types.js';

// Mock LLM client
function createMockLLMClient(): LLMClient {
  return {
    chat: vi.fn().mockResolvedValue({
      content: 'Mock incident response: Incident resolved after restart',
      usage: { inputTokens: 10, outputTokens: 10 },
    }),
    chatWithFunctions: vi.fn().mockResolvedValue({
      content: 'Mock response',
      functionCalls: [],
      usage: { inputTokens: 10, outputTokens: 10 },
    }),
  } as unknown as LLMClient;
}

// Mock docker_stop tool
function createMockDockerStopTool(): Tool {
  return {
    definition: {
      name: 'docker_stop',
      description: 'Stop container',
      parameters: [
        { name: 'container', type: 'string', description: 'Container name', required: true },
      ],
    },
    roles: ['devops', 'ops'],
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: 'Container stopped',
    }),
  };
}

// Mock rollback tool
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
      output: 'Deployment rolled back',
    }),
  };
}

describe('IncidentAgent', () => {
  let mockLLMClient: LLMClient;
  let mockTools: Tool[];
  const testRunbook: Runbook = {
    name: 'backend-recovery',
    description: 'Recovery steps for backend service',
    triggers: ['health_check_failed'],
    steps: [
      { name: 'Restart', action: 'restart_service', params: { target: 'backend' } },
      { name: 'Wait', action: 'wait_for_health', params: { timeout: 60 } },
    ],
  };

  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    mockTools = [createMockDockerStopTool(), createMockRollbackTool()];
  });

  describe('constructor', () => {
    it('should create IncidentAgent with default name', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.name).toBe('IncidentAgent');
    });

    it('should create IncidentAgent with custom name', () => {
      const agent = new IncidentAgent({
        name: 'CustomIncident',
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.name).toBe('CustomIncident');
    });

    it('should have role of Incident Response Engineer', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.role).toBe('Incident Response Engineer');
    });

    it('should set default max recovery attempts to 3', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      // Create incident and record 3 failed attempts
      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      agent.recordRecoveryAction(incident.id, 'rollback', 'backend', false);

      expect(agent.shouldEscalate(incident.id)).toBe(true);
    });

    it('should use custom max recovery attempts', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        maxRecoveryAttempts: 5,
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);

      expect(agent.shouldEscalate(incident.id)).toBe(false);

      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      expect(agent.shouldEscalate(incident.id)).toBe(true);
    });

    it('should register provided runbooks', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        runbooks: [testRunbook],
      });

      expect(agent.getRunbook('backend-recovery')).toBeDefined();
    });
  });

  describe('incident creation', () => {
    it('should create incident with unique ID', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident1 = agent.createIncident('First', 'high', ['backend']);
      const incident2 = agent.createIncident('Second', 'medium', ['frontend']);

      expect(incident1.id).not.toBe(incident2.id);
      expect(incident1.id).toMatch(/^INC-\d{5}$/);
    });

    it('should set initial state to detected', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test Incident', 'high', ['backend']);
      expect(incident.state).toBe('detected');
    });

    it('should record creation in timeline', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      expect(incident.timeline.length).toBe(1);
      expect(incident.timeline[0].action).toBe('created');
    });

    it('should store affected services', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend', 'database']);
      expect(incident.affectedServices).toContain('backend');
      expect(incident.affectedServices).toContain('database');
    });
  });

  describe('incident state management', () => {
    it('should update incident state', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.updateIncidentState(incident.id, 'acknowledged');

      const updated = agent.getIncident(incident.id);
      expect(updated?.state).toBe('acknowledged');
    });

    it('should record state change in timeline', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.updateIncidentState(incident.id, 'investigating', 'Looking into the issue');

      const updated = agent.getIncident(incident.id);
      expect(updated?.timeline.length).toBe(2);
      expect(updated?.timeline[1].action).toBe('state_change');
      expect(updated?.timeline[1].details).toContain('investigating');
    });

    it('should set resolvedAt when resolved', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.updateIncidentState(incident.id, 'resolved');

      const updated = agent.getIncident(incident.id);
      expect(updated?.resolvedAt).toBeDefined();
    });

    it('should set escalatedAt when escalated', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.updateIncidentState(incident.id, 'escalated');

      const updated = agent.getIncident(incident.id);
      expect(updated?.escalatedAt).toBeDefined();
    });

    it('should return false for non-existent incident', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const result = agent.updateIncidentState('INVALID', 'resolved');
      expect(result).toBe(false);
    });
  });

  describe('recovery actions', () => {
    it('should record recovery action', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', true, 'Service restarted');

      const updated = agent.getIncident(incident.id);
      expect(updated?.recoveryActions.length).toBe(1);
      expect(updated?.recoveryActions[0].type).toBe('restart');
      expect(updated?.recoveryActions[0].success).toBe(true);
    });

    it('should add recovery action to timeline', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);

      const updated = agent.getIncident(incident.id);
      expect(updated?.timeline.length).toBe(2);
      expect(updated?.timeline[1].action).toBe('recovery_restart');
    });
  });

  describe('next recovery action determination', () => {
    it('should suggest restart first', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      expect(agent.getNextRecoveryAction(incident.id)).toBe('restart');
    });

    it('should suggest restart again after one failed restart', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);

      expect(agent.getNextRecoveryAction(incident.id)).toBe('restart');
    });

    it('should suggest rollback after two failed restarts', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);

      expect(agent.getNextRecoveryAction(incident.id)).toBe('rollback');
    });

    it('should suggest escalate after failed rollback', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      agent.recordRecoveryAction(incident.id, 'rollback', 'backend', false);

      expect(agent.getNextRecoveryAction(incident.id)).toBe('escalate');
    });
  });

  describe('escalation determination', () => {
    it('should not escalate with no recovery attempts', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      expect(agent.shouldEscalate(incident.id)).toBe(false);
    });

    it('should escalate after max attempts', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        maxRecoveryAttempts: 2,
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);

      expect(agent.shouldEscalate(incident.id)).toBe(true);
    });

    it('should escalate after restart and rollback failures', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      agent.recordRecoveryAction(incident.id, 'restart', 'backend', false);
      agent.recordRecoveryAction(incident.id, 'rollback', 'backend', false);

      expect(agent.shouldEscalate(incident.id)).toBe(true);
    });
  });

  describe('runbook management', () => {
    it('should register runbook', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      agent.registerRunbook(testRunbook);
      expect(agent.getRunbook('backend-recovery')).toBeDefined();
    });

    it('should find runbook by trigger', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        runbooks: [testRunbook],
      });

      const runbook = agent.findRunbookForTrigger('health_check_failed');
      expect(runbook).toBeDefined();
      expect(runbook?.name).toBe('backend-recovery');
    });

    it('should return undefined for unknown trigger', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
        runbooks: [testRunbook],
      });

      const runbook = agent.findRunbookForTrigger('unknown_trigger');
      expect(runbook).toBeUndefined();
    });
  });

  describe('incident queries', () => {
    it('should get all incidents', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      agent.createIncident('First', 'high', ['backend']);
      agent.createIncident('Second', 'medium', ['frontend']);

      expect(agent.getAllIncidents().length).toBe(2);
    });

    it('should get active incidents', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const inc1 = agent.createIncident('First', 'high', ['backend']);
      agent.createIncident('Second', 'medium', ['frontend']);
      agent.updateIncidentState(inc1.id, 'resolved');

      const active = agent.getActiveIncidents();
      expect(active.length).toBe(1);
      expect(active[0].title).toBe('Second');
    });
  });

  describe('incident duration', () => {
    it('should calculate duration for open incident', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      const incident = agent.createIncident('Test', 'high', ['backend']);
      const duration = agent.getIncidentDuration(incident.id);

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(10); // Should be nearly instant in test
    });

    it('should return 0 for non-existent incident', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/test/workspace',
      });

      expect(agent.getIncidentDuration('INVALID')).toBe(0);
    });
  });

  describe('getWorkspace', () => {
    it('should return the configured workspace', () => {
      const agent = new IncidentAgent({
        llmClient: mockLLMClient,
        tools: mockTools,
        workspace: '/my/workspace',
      });

      expect(agent.getWorkspace()).toBe('/my/workspace');
    });
  });
});
