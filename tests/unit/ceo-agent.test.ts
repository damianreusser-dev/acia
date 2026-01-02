/**
 * Unit tests for CEO Agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CEOAgent } from '../../src/agents/executive/ceo-agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { Team, WorkflowResult } from '../../src/team/team.js';
import { WikiService } from '../../src/core/wiki/wiki-service.js';

describe('CEOAgent', () => {
  let mockLLMClient: LLMClient;
  let ceoAgent: CEOAgent;

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        content: 'Test response',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    } as unknown as LLMClient;

    ceoAgent = new CEOAgent({
      llmClient: mockLLMClient,
      tools: [],
    });
  });

  describe('constructor', () => {
    it('should create CEO agent with default name', () => {
      const agent = new CEOAgent({
        llmClient: mockLLMClient,
        tools: [],
      });

      expect(agent.name).toBe('CEO');
    });

    it('should create CEO agent with custom name', () => {
      const agent = new CEOAgent({
        name: 'CustomCEO',
        llmClient: mockLLMClient,
        tools: [],
      });

      expect(agent.name).toBe('CustomCEO');
    });

    it('should accept wiki service', () => {
      const mockWikiService = {} as WikiService;
      const agent = new CEOAgent({
        llmClient: mockLLMClient,
        tools: [],
        wikiService: mockWikiService,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('team management', () => {
    it('should create and register a team', () => {
      const team = ceoAgent.createTeam('frontend', {
        workspace: '/test',
        llmClient: mockLLMClient,
        tools: [],
      });

      expect(team).toBeInstanceOf(Team);
      expect(ceoAgent.getTeam('frontend')).toBe(team);
    });

    it('should return undefined for non-existent team', () => {
      expect(ceoAgent.getTeam('nonexistent')).toBeUndefined();
    });

    it('should list all registered teams', () => {
      ceoAgent.createTeam('frontend', {
        workspace: '/test',
        llmClient: mockLLMClient,
        tools: [],
      });
      ceoAgent.createTeam('backend', {
        workspace: '/test',
        llmClient: mockLLMClient,
        tools: [],
      });

      const teams = ceoAgent.getTeams();
      expect(teams).toContain('frontend');
      expect(teams).toContain('backend');
      expect(teams.length).toBe(2);
    });
  });

  describe('executeGoal', () => {
    it('should return error when team does not exist', async () => {
      const result = await ceoAgent.executeGoal('Build a website', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.escalatedToHuman).toBe(true);
      expect(result.humanEscalationReason).toContain('No team registered');
    });

    it('should plan projects from goal', async () => {
      // Mock LLM to return project breakdown
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Setup Infrastructure] | [Priority: high] | Set up the development environment
2. [Build Frontend] | [Priority: medium] | Create the user interface`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      // Create a mock team
      const mockTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      // Manually register the mock team
      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      const result = await ceoAgent.executeGoal('Build a website');

      expect(result.projects.length).toBe(2);
      expect(result.projects[0].title).toBe('Setup Infrastructure');
      expect(result.projects[0].priority).toBe('high');
      expect(result.projects[1].title).toBe('Build Frontend');
      expect(result.projects[1].priority).toBe('medium');
    });

    it('should execute projects through team', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Task One] | [Priority: medium] | Do the first thing`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      const result = await ceoAgent.executeGoal('Simple task');

      expect(mockTeam.executeTask).toHaveBeenCalled();
      expect(result.completedProjects).toBe(1);
      expect(result.failedProjects).toBe(0);
      expect(result.success).toBe(true);
    });

    it('should handle team escalation', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          content: `PROJECTS:
1. [Complex Task] | [Priority: high] | Needs decision`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        })
        .mockResolvedValueOnce({
          content: `DECISION: Cannot proceed without human input
ESCALATE_TO_HUMAN: yes
REASON: This requires business decision`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 100 },
        });

      const mockTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: false,
          escalated: true,
          escalationReason: 'Need clarification on requirements',
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      const result = await ceoAgent.executeGoal('Complex task');

      expect(result.escalatedToHuman).toBe(true);
      expect(result.humanEscalationReason).toContain('business decision');
    });

    it('should handle team execution failure without escalation', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Failing Task] | [Priority: medium] | Will fail`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: false,
          escalated: false,
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      const result = await ceoAgent.executeGoal('Failing task');

      expect(result.success).toBe(false);
      expect(result.failedProjects).toBe(1);
      expect(result.escalatedToHuman).toBe(false);
    });

    it('should create single project when parsing fails', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'I will help you build this feature.',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const mockTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      const result = await ceoAgent.executeGoal('Build something cool');

      expect(result.projects.length).toBe(1);
      expect(result.projects[0].description).toBe('Build something cool');
    });
  });

  describe('human escalation handler', () => {
    it('should call escalation handler when set', async () => {
      const escalationHandler = vi.fn();
      ceoAgent.setHumanEscalationHandler(escalationHandler);

      (mockLLMClient.chat as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          content: `PROJECTS:
1. [Task] | [Priority: high] | Task description`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        })
        .mockResolvedValueOnce({
          content: `DECISION: Need human
ESCALATE_TO_HUMAN: yes
REASON: Critical decision needed`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 100 },
        });

      const mockTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: false,
          escalated: true,
          escalationReason: 'Blocked',
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      await ceoAgent.executeGoal('Needs human');

      expect(escalationHandler).toHaveBeenCalled();
      expect(escalationHandler).toHaveBeenCalledWith(
        expect.stringContaining('Critical decision'),
        expect.objectContaining({ title: 'Task' })
      );
    });

    it('should handle errors during execution', async () => {
      const escalationHandler = vi.fn();
      ceoAgent.setHumanEscalationHandler(escalationHandler);

      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Error Task] | [Priority: high] | Will throw`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTeam = {
        executeTask: vi.fn().mockRejectedValue(new Error('Network failure')),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      const result = await ceoAgent.executeGoal('Error test');

      expect(result.escalatedToHuman).toBe(true);
      expect(result.humanEscalationReason).toContain('Network failure');
      expect(escalationHandler).toHaveBeenCalled();
    });
  });

  describe('project tracking', () => {
    it('should track active projects', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Project A] | [Priority: high] | First project
2. [Project B] | [Priority: low] | Second project`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      await ceoAgent.executeGoal('Multiple projects');

      const activeProjects = ceoAgent.getActiveProjects();
      expect(activeProjects.length).toBe(2);
    });

    it('should get project by ID', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Single Project] | [Priority: medium] | Description`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      await ceoAgent.executeGoal('Get project test');

      const projects = ceoAgent.getActiveProjects();
      expect(projects.length).toBe(1);

      const project = ceoAgent.getProject(projects[0].id);
      expect(project).toBeDefined();
      expect(project?.title).toBe('Single Project');
    });

    it('should return undefined for non-existent project', () => {
      expect(ceoAgent.getProject('fake-id')).toBeUndefined();
    });
  });

  describe('priority parsing', () => {
    it('should parse all priority levels', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Critical] | [Priority: critical] | Critical priority
2. [High] | [Priority: high] | High priority
3. [Medium] | [Priority: medium] | Medium priority
4. [Low] | [Priority: low] | Low priority`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      const result = await ceoAgent.executeGoal('Priority test');

      expect(result.projects[0].priority).toBe('critical');
      expect(result.projects[1].priority).toBe('high');
      expect(result.projects[2].priority).toBe('medium');
      expect(result.projects[3].priority).toBe('low');
    });

    it('should default to medium for invalid priority', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Task] | [Priority: urgent] | Invalid priority`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      const result = await ceoAgent.executeGoal('Default priority test');

      expect(result.projects[0].priority).toBe('medium');
    });
  });
});
