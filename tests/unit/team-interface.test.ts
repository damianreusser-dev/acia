/**
 * ITeam Interface Unit Tests
 *
 * Tests for the ITeam interface and Team implementation.
 * Part of Phase 6a: Coordination Layer Refactoring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Team, TeamConfig } from '../../src/team/team.js';
import { ITeam, WorkflowResult, Priority } from '../../src/team/team-interface.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';

describe('ITeam Interface', () => {
  describe('Interface Contract', () => {
    it('should define ITeam with required methods', () => {
      // Type-level test: if this compiles, interface is correctly defined
      const mockTeam: ITeam = {
        executeTask: async (_desc: string, _priority?: Priority) => ({
          success: true,
          task: {} as any,
          devResults: [],
          qaResults: [],
          iterations: 0,
          escalated: false,
        } as WorkflowResult),
        getAgentRoles: () => ['pm', 'dev', 'qa'],
        getName: () => 'MockTeam',
        getWorkspace: () => '/tmp/test',
      };

      expect(mockTeam).toBeDefined();
      expect(typeof mockTeam.executeTask).toBe('function');
      expect(typeof mockTeam.getAgentRoles).toBe('function');
      expect(typeof mockTeam.getName).toBe('function');
      expect(typeof mockTeam.getWorkspace).toBe('function');
    });

    it('should allow ITeam to accept Priority parameter', () => {
      const priorities: Priority[] = ['low', 'medium', 'high', 'critical'];

      for (const priority of priorities) {
        expect(['low', 'medium', 'high', 'critical']).toContain(priority);
      }
    });
  });

  describe('WorkflowResult Structure', () => {
    it('should have all required fields', () => {
      const result: WorkflowResult = {
        success: true,
        task: {
          id: 'task-1',
          type: 'implement',
          title: 'Test task',
          description: 'Test description',
          status: 'completed',
          createdBy: 'test',
          priority: 'medium',
          attempts: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        devResults: [],
        qaResults: [],
        iterations: 1,
        escalated: false,
      };

      expect(result.success).toBe(true);
      expect(result.task).toBeDefined();
      expect(Array.isArray(result.devResults)).toBe(true);
      expect(Array.isArray(result.qaResults)).toBe(true);
      expect(typeof result.iterations).toBe('number');
      expect(typeof result.escalated).toBe('boolean');
    });

    it('should allow optional fields', () => {
      const resultWithOptional: WorkflowResult = {
        success: false,
        task: {
          id: 'task-2',
          type: 'fix',
          title: 'Failed task',
          description: 'Failed description',
          status: 'failed',
          createdBy: 'test',
          priority: 'high',
          attempts: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        breakdown: {
          devTasks: [],
          qaTasks: [],
          order: [],
        },
        devResults: [],
        qaResults: [],
        iterations: 3,
        escalated: true,
        escalationReason: 'Max iterations reached',
      };

      expect(resultWithOptional.breakdown).toBeDefined();
      expect(resultWithOptional.escalationReason).toBe('Max iterations reached');
    });
  });
});

describe('Team implements ITeam', () => {
  let mockLLMClient: LLMClient;
  let mockTools: Tool[];

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        content: 'Mock response',
        model: 'test-model',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      }),
    } as unknown as LLMClient;

    mockTools = [
      {
        definition: {
          name: 'read_file',
          description: 'Read a file',
          parameters: [{ name: 'path', type: 'string', required: true, description: 'File path' }],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'file content' }),
      },
      {
        definition: {
          name: 'write_file',
          description: 'Write a file',
          parameters: [
            { name: 'path', type: 'string', required: true, description: 'File path' },
            { name: 'content', type: 'string', required: true, description: 'Content' },
          ],
        },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'written' }),
      },
    ];
  });

  it('should implement getName() method', () => {
    const config: TeamConfig = {
      workspace: '/tmp/test',
      llmClient: mockLLMClient,
      tools: mockTools,
    };

    const team = new Team(config);

    expect(team.getName()).toBe('TechTeam');
  });

  it('should implement getAgentRoles() method', () => {
    const config: TeamConfig = {
      workspace: '/tmp/test',
      llmClient: mockLLMClient,
      tools: mockTools,
    };

    const team = new Team(config);
    const roles = team.getAgentRoles();

    expect(Array.isArray(roles)).toBe(true);
    expect(roles).toContain('pm');
    expect(roles).toContain('dev');
    expect(roles).toContain('qa');
    expect(roles.length).toBeGreaterThan(0);
  });

  it('should implement getWorkspace() method', () => {
    const config: TeamConfig = {
      workspace: '/tmp/test-workspace',
      llmClient: mockLLMClient,
      tools: mockTools,
    };

    const team = new Team(config);

    expect(team.getWorkspace()).toBe('/tmp/test-workspace');
  });

  it('should be assignable to ITeam variable', () => {
    const config: TeamConfig = {
      workspace: '/tmp/test',
      llmClient: mockLLMClient,
      tools: mockTools,
    };

    // Type-level test: Team should be assignable to ITeam
    const team: ITeam = new Team(config);

    expect(team).toBeDefined();
    expect(typeof team.executeTask).toBe('function');
    expect(typeof team.getAgentRoles).toBe('function');
    expect(typeof team.getName).toBe('function');
    expect(typeof team.getWorkspace).toBe('function');
  });

  it('should have executeTask method with correct signature', () => {
    const config: TeamConfig = {
      workspace: '/tmp/test',
      llmClient: mockLLMClient,
      tools: mockTools,
    };

    const team = new Team(config);

    // executeTask should accept description and optional priority
    expect(typeof team.executeTask).toBe('function');
    expect(team.executeTask.length).toBeLessThanOrEqual(2); // At most 2 parameters
  });
});

describe('ITeam Type Safety', () => {
  it('should prevent assigning non-ITeam objects', () => {
    // This is a compile-time check
    // The following would cause a TypeScript error if uncommented:
    // const notATeam: ITeam = { foo: 'bar' }; // Error: missing required properties

    // Runtime check that ITeam has expected shape
    const validTeam: ITeam = {
      executeTask: async () => ({
        success: true,
        task: {} as any,
        devResults: [],
        qaResults: [],
        iterations: 0,
        escalated: false,
      }),
      getAgentRoles: () => [],
      getName: () => 'Test',
      getWorkspace: () => '/tmp',
    };

    expect(validTeam).toBeDefined();
  });

  it('should allow extending ITeam', () => {
    interface ExtendedTeam extends ITeam {
      getMetrics(): { taskCount: number };
    }

    const extendedTeam: ExtendedTeam = {
      executeTask: async () => ({
        success: true,
        task: {} as any,
        devResults: [],
        qaResults: [],
        iterations: 0,
        escalated: false,
      }),
      getAgentRoles: () => ['pm', 'dev'],
      getName: () => 'ExtendedTeam',
      getWorkspace: () => '/tmp',
      getMetrics: () => ({ taskCount: 5 }),
    };

    expect(extendedTeam.getMetrics().taskCount).toBe(5);
  });
});
