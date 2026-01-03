/**
 * TeamFactory Unit Tests
 *
 * Tests for the TeamFactory class.
 * Part of Phase 6a: Coordination Layer Refactoring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TeamFactory, TeamFactoryConfig, TeamType } from '../../src/team/team-factory.js';
import { ITeam, WorkflowResult } from '../../src/team/team-interface.js';
import { Team } from '../../src/team/team.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Tool } from '../../src/core/tools/types.js';

describe('TeamFactory', () => {
  let mockLLMClient: LLMClient;
  let mockTools: Tool[];
  let baseConfig: TeamFactoryConfig;

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
        execute: vi.fn().mockResolvedValue({ success: true, output: 'content' }),
      },
    ];

    baseConfig = {
      workspace: '/tmp/test-workspace',
      llmClient: mockLLMClient,
      tools: mockTools,
    };
  });

  afterEach(() => {
    // Clean up any custom registrations
    TeamFactory.unregister('custom');
    TeamFactory.unregister('marketing');
    TeamFactory.unregister('test');
  });

  describe('create', () => {
    it('should create a tech team by default', () => {
      const team = TeamFactory.create('tech', baseConfig);

      expect(team).toBeDefined();
      expect(team).toBeInstanceOf(Team);
      expect(team.getName()).toBe('TechTeam');
    });

    it('should pass workspace to created team', () => {
      const team = TeamFactory.create('tech', {
        ...baseConfig,
        workspace: '/custom/workspace',
      });

      expect(team.getWorkspace()).toBe('/custom/workspace');
    });

    it('should pass callbacks to created team', () => {
      const onProgress = vi.fn();
      const onEscalation = vi.fn();

      const team = TeamFactory.create('tech', {
        ...baseConfig,
        onProgress,
        onEscalation,
      });

      // Team should be created (callbacks are internal)
      expect(team).toBeDefined();
    });

    it('should throw for unknown team type', () => {
      expect(() => {
        TeamFactory.create('unknown' as TeamType, baseConfig);
      }).toThrow('Unknown team type: "unknown"');
    });

    it('should include registered types in error message', () => {
      try {
        TeamFactory.create('invalid' as TeamType, baseConfig);
      } catch (error) {
        expect((error as Error).message).toContain('tech');
      }
    });
  });

  describe('register', () => {
    it('should register a custom team type', () => {
      const customTeam: ITeam = {
        executeTask: async () => ({
          success: true,
          task: {} as any,
          devResults: [],
          qaResults: [],
          iterations: 0,
          escalated: false,
        }),
        getAgentRoles: () => ['custom'],
        getName: () => 'CustomTeam',
        getWorkspace: () => '/tmp',
      };

      TeamFactory.register('custom', () => customTeam);

      const team = TeamFactory.create('custom', baseConfig);
      expect(team.getName()).toBe('CustomTeam');
    });

    it('should allow overwriting existing team type', () => {
      const customTechTeam: ITeam = {
        executeTask: async () => ({
          success: true,
          task: {} as any,
          devResults: [],
          qaResults: [],
          iterations: 0,
          escalated: false,
        }),
        getAgentRoles: () => ['pm', 'dev'],
        getName: () => 'CustomTechTeam',
        getWorkspace: () => '/tmp',
      };

      // Save original
      const originalTeam = TeamFactory.create('tech', baseConfig);
      expect(originalTeam.getName()).toBe('TechTeam');

      // Override
      TeamFactory.register('tech', () => customTechTeam);
      const overriddenTeam = TeamFactory.create('tech', baseConfig);
      expect(overriddenTeam.getName()).toBe('CustomTechTeam');

      // Restore original
      TeamFactory.register('tech', (config) => new Team({
        workspace: config.workspace,
        llmClient: config.llmClient,
        tools: config.tools ?? [],
        wikiService: config.wikiService,
        maxRetries: config.maxRetries,
        maxIterations: config.maxIterations,
        onEscalation: config.onEscalation,
        onProgress: config.onProgress,
      }));
    });

    it('should receive full config in creator function', () => {
      const creator = vi.fn().mockReturnValue({
        executeTask: async () => ({ success: true, task: {}, devResults: [], qaResults: [], iterations: 0, escalated: false }),
        getAgentRoles: () => [],
        getName: () => 'Test',
        getWorkspace: () => '/tmp',
      } as ITeam);

      TeamFactory.register('test', creator);
      TeamFactory.create('test', {
        ...baseConfig,
        maxRetries: 5,
        maxIterations: 10,
      });

      expect(creator).toHaveBeenCalledWith(expect.objectContaining({
        workspace: baseConfig.workspace,
        llmClient: baseConfig.llmClient,
        tools: baseConfig.tools,
        maxRetries: 5,
        maxIterations: 10,
      }));
    });
  });

  describe('unregister', () => {
    it('should unregister a team type', () => {
      TeamFactory.register('custom', () => ({
        executeTask: async () => ({ success: true, task: {}, devResults: [], qaResults: [], iterations: 0, escalated: false }),
        getAgentRoles: () => [],
        getName: () => 'Custom',
        getWorkspace: () => '/tmp',
      } as ITeam));

      expect(TeamFactory.isRegistered('custom')).toBe(true);

      const removed = TeamFactory.unregister('custom');
      expect(removed).toBe(true);
      expect(TeamFactory.isRegistered('custom')).toBe(false);
    });

    it('should return false when unregistering non-existent type', () => {
      const removed = TeamFactory.unregister('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered types', () => {
      expect(TeamFactory.isRegistered('tech')).toBe(true);
    });

    it('should return false for unregistered types', () => {
      expect(TeamFactory.isRegistered('nonexistent')).toBe(false);
    });
  });

  describe('getRegisteredTypes', () => {
    it('should include default tech type', () => {
      const types = TeamFactory.getRegisteredTypes();
      expect(types).toContain('tech');
    });

    it('should include custom registered types', () => {
      TeamFactory.register('marketing', () => ({
        executeTask: async () => ({ success: true, task: {}, devResults: [], qaResults: [], iterations: 0, escalated: false }),
        getAgentRoles: () => ['content'],
        getName: () => 'MarketingTeam',
        getWorkspace: () => '/tmp',
      } as ITeam));

      const types = TeamFactory.getRegisteredTypes();
      expect(types).toContain('tech');
      expect(types).toContain('marketing');
    });
  });

  describe('TechTeam Creation', () => {
    it('should create team with expected agent roles', () => {
      const team = TeamFactory.create('tech', baseConfig);
      const roles = team.getAgentRoles();

      expect(roles).toContain('pm');
      expect(roles).toContain('dev');
      expect(roles).toContain('qa');
    });

    it('should return team implementing ITeam interface', () => {
      const team: ITeam = TeamFactory.create('tech', baseConfig);

      // Should have all ITeam methods
      expect(typeof team.executeTask).toBe('function');
      expect(typeof team.getAgentRoles).toBe('function');
      expect(typeof team.getName).toBe('function');
      expect(typeof team.getWorkspace).toBe('function');
    });
  });
});

describe('TeamFactory Type Safety', () => {
  it('should accept string team types for extensibility', () => {
    const mockConfig: TeamFactoryConfig = {
      workspace: '/tmp',
      llmClient: {} as LLMClient,
    };

    // Register with string type
    TeamFactory.register('custom-string-type', () => ({
      executeTask: async () => ({ success: true, task: {}, devResults: [], qaResults: [], iterations: 0, escalated: false }) as WorkflowResult,
      getAgentRoles: () => [],
      getName: () => 'CustomString',
      getWorkspace: () => '/tmp',
    }));

    const team = TeamFactory.create('custom-string-type', mockConfig);
    expect(team.getName()).toBe('CustomString');

    // Cleanup
    TeamFactory.unregister('custom-string-type');
  });
});
