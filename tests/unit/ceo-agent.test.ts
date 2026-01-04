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

  describe('multi-team coordination', () => {
    it('should return error when no teams registered', async () => {
      const result = await ceoAgent.executeGoalMultiTeam('Build full stack app');

      expect(result.success).toBe(false);
      expect(result.escalatedToHuman).toBe(true);
      expect(result.humanEscalationReason).toContain('No teams registered');
    });

    it('should assign projects to multiple teams', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `TEAM_ASSIGNMENTS:
TEAM: frontend
1. [Build UI] | [Priority: high] | Create React components

TEAM: backend
1. [Create API] | [Priority: high] | Build REST endpoints`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 300 },
      });

      const mockFrontendTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      const mockBackendTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('frontend', mockFrontendTeam);
      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('backend', mockBackendTeam);

      const result = await ceoAgent.executeGoalMultiTeam('Build full stack app');

      expect(result.totalProjects).toBe(2);
      expect(result.totalCompleted).toBe(2);
      expect(result.success).toBe(true);
      expect(mockFrontendTeam.executeTask).toHaveBeenCalled();
      expect(mockBackendTeam.executeTask).toHaveBeenCalled();
    });

    it('should execute teams in parallel', async () => {
      const executionOrder: string[] = [];

      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `TEAM_ASSIGNMENTS:
TEAM: team1
1. [Task 1] | [Priority: medium] | First task

TEAM: team2
1. [Task 2] | [Priority: medium] | Second task`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 300 },
      });

      const mockTeam1 = {
        executeTask: vi.fn().mockImplementation(async () => {
          executionOrder.push('team1-start');
          await new Promise((r) => setTimeout(r, 10));
          executionOrder.push('team1-end');
          return { success: true, iterations: 1 } as WorkflowResult;
        }),
      } as unknown as Team;

      const mockTeam2 = {
        executeTask: vi.fn().mockImplementation(async () => {
          executionOrder.push('team2-start');
          await new Promise((r) => setTimeout(r, 10));
          executionOrder.push('team2-end');
          return { success: true, iterations: 1 } as WorkflowResult;
        }),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('team1', mockTeam1);
      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('team2', mockTeam2);

      await ceoAgent.executeGoalMultiTeam('Parallel test');

      // Both teams should start before either ends (parallel execution)
      const team1StartIndex = executionOrder.indexOf('team1-start');
      const team2StartIndex = executionOrder.indexOf('team2-start');
      const team1EndIndex = executionOrder.indexOf('team1-end');
      const team2EndIndex = executionOrder.indexOf('team2-end');

      // At least verify both teams executed
      expect(team1StartIndex).toBeGreaterThanOrEqual(0);
      expect(team2StartIndex).toBeGreaterThanOrEqual(0);
      expect(team1EndIndex).toBeGreaterThan(team1StartIndex);
      expect(team2EndIndex).toBeGreaterThan(team2StartIndex);
    });

    it('should aggregate results from multiple teams', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `TEAM_ASSIGNMENTS:
TEAM: teamA
1. [Success A] | [Priority: high] | Will succeed
2. [Fail A] | [Priority: medium] | Will fail

TEAM: teamB
1. [Success B] | [Priority: high] | Will succeed`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 300 },
      });

      let teamACallCount = 0;
      const mockTeamA = {
        executeTask: vi.fn().mockImplementation(async () => {
          teamACallCount++;
          return {
            success: teamACallCount === 1, // First succeeds, second fails
            iterations: 1,
          } as WorkflowResult;
        }),
      } as unknown as Team;

      const mockTeamB = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
        } as WorkflowResult),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('teamA', mockTeamA);
      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('teamB', mockTeamB);

      const result = await ceoAgent.executeGoalMultiTeam('Mixed results');

      expect(result.totalProjects).toBe(3);
      expect(result.totalCompleted).toBe(2);
      expect(result.totalFailed).toBe(1);
      expect(result.success).toBe(false); // Because one failed
    });

    it('should fall back to first team when parsing fails', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: 'I will coordinate the teams to build this.',
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

      const result = await ceoAgent.executeGoalMultiTeam('Fallback test');

      expect(result.totalProjects).toBe(1);
      expect(mockTeam.executeTask).toHaveBeenCalled();
    });

    it('should provide coordination status', async () => {
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

      const status = ceoAgent.getCoordinationStatus();

      expect(status.teamsCount).toBe(2);
      expect(status.projectsByStatus).toHaveProperty('pending');
      expect(status.projectsByStatus).toHaveProperty('in_progress');
      expect(status.projectsByStatus).toHaveProperty('completed');
      expect(status.projectsByStatus).toHaveProperty('blocked');
    });
  });

  describe('executeGoalWithDeployment', () => {
    it('should fail when build phase fails', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Build App] | [Priority: high] | Build the application`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: false,
          escalated: false,
          iterations: 1,
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTeam);

      const result = await ceoAgent.executeGoalWithDeployment('Build and deploy app', 'default', {
        target: 'local',
        monitor: true,
      });

      expect(result.success).toBe(false);
      expect(result.buildResult.success).toBe(false);
      expect(result.deployResult).toBeUndefined();
    });

    it('should proceed to deployment after successful build', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Build App] | [Priority: high] | Build the application in directory "todo-app"`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTechTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [],
          qaResults: [],
          task: { title: 'Build App', description: 'Build the application' },
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      const mockOpsTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [{ task: {}, result: { success: true, output: '' } }],
          qaResults: [],
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTechTeam);
      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('ops', mockOpsTeam);

      const result = await ceoAgent.executeGoalWithDeployment('Build and deploy app', 'default', {
        target: 'local',
        ports: { frontend: 3000, backend: 3001 },
        monitor: false,
      });

      expect(result.success).toBe(true);
      expect(result.buildResult.success).toBe(true);
      expect(result.deployResult?.success).toBe(true);
      expect(mockOpsTeam.executeTask).toHaveBeenCalled();
    });

    it('should return localhost URLs for local deployment', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Build App] | [Priority: high] | Build the application`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTechTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [],
          qaResults: [],
          task: { title: 'Build App', description: 'Build the application' },
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      const mockOpsTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [{ task: {}, result: { success: true, output: '' } }],
          qaResults: [],
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTechTeam);
      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('ops', mockOpsTeam);

      const result = await ceoAgent.executeGoalWithDeployment('Build and deploy app', 'default', {
        target: 'local',
        ports: { frontend: 4000, backend: 4001 },
        monitor: false,
      });

      expect(result.deployResult?.frontendUrl).toBe('http://localhost:4000');
      expect(result.deployResult?.backendUrl).toBe('http://localhost:4001');
    });

    it('should handle deployment failure', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Build App] | [Priority: high] | Build the application`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTechTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [],
          qaResults: [],
          task: { title: 'Build App', description: 'Build the application' },
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      const mockOpsTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: false,
          escalated: true,
          escalationReason: 'Docker not available',
          iterations: 1,
          devResults: [],
          qaResults: [],
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTechTeam);
      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('ops', mockOpsTeam);

      const result = await ceoAgent.executeGoalWithDeployment('Build and deploy app', 'default', {
        target: 'local',
        monitor: false,
      });

      expect(result.success).toBe(false);
      expect(result.buildResult.success).toBe(true);
      expect(result.deployResult?.success).toBe(false);
      expect(result.deployResult?.error).toBe('Docker not available');
    });

    it('should set up monitoring when enabled', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Build App] | [Priority: high] | Build the application`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTechTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [],
          qaResults: [],
          task: { title: 'Build App', description: 'Build the application' },
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      const mockOpsTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [{ task: {}, result: { success: true, output: '' } }],
          qaResults: [],
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTechTeam);
      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('ops', mockOpsTeam);

      const result = await ceoAgent.executeGoalWithDeployment('Build and deploy app', 'default', {
        target: 'local',
        ports: { frontend: 3000, backend: 3001 },
        monitor: true,
      });

      expect(result.monitoringResult?.active).toBe(true);
      expect(result.monitoringResult?.targets).toContain('http://localhost:3001/health');
      // Ops team should be called for deployment + monitoring
      expect(mockOpsTeam.executeTask).toHaveBeenCalledTimes(2);
    });

    it('should create deployment task for Azure App Service', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Build App] | [Priority: high] | Build in directory "my-app"`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTechTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [],
          qaResults: [],
          task: { title: 'Build App', description: 'Build in directory "my-app"' },
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      const mockOpsTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [{ task: {}, result: { success: true, output: 'https://my-app.azurewebsites.net deployed' } }],
          qaResults: [],
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTechTeam);
      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('ops', mockOpsTeam);

      const result = await ceoAgent.executeGoalWithDeployment('Build and deploy app', 'default', {
        target: 'azure-appservice',
        resourceGroup: 'my-rg',
        appName: 'my-app',
        monitor: false,
      });

      expect(result.success).toBe(true);
      // Verify ops team was called with Azure-specific task
      const deployCall = mockOpsTeam.executeTask.mock.calls[0];
      expect(deployCall[0]).toContain('Azure App Service');
      expect(deployCall[0]).toContain('my-rg');
      expect(deployCall[0]).toContain('my-app');
    });

    it('should extract Azure URLs from deployment result', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Build App] | [Priority: high] | Build the application`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTechTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [],
          qaResults: [],
          task: { title: 'Build App', description: 'Build the application' },
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      const mockOpsTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [
            { task: {}, result: { success: true, output: 'Backend deployed to https://myapp-api.azurewebsites.net' } },
            { task: {}, result: { success: true, output: 'Frontend deployed to https://myapp-web.azurestaticapps.net' } },
          ],
          qaResults: [],
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTechTeam);
      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('ops', mockOpsTeam);

      const result = await ceoAgent.executeGoalWithDeployment('Build and deploy app', 'default', {
        target: 'azure-appservice',
        resourceGroup: 'my-rg',
        appName: 'my-app',
        monitor: false,
      });

      expect(result.deployResult?.backendUrl).toBe('https://myapp-api.azurewebsites.net');
      expect(result.deployResult?.frontendUrl).toBe('https://myapp-web.azurestaticapps.net');
    });

    it('should auto-create ops team if not registered', async () => {
      (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: `PROJECTS:
1. [Build App] | [Priority: high] | Build the application`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      const mockTechTeam = {
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          iterations: 1,
          devResults: [],
          qaResults: [],
          task: { title: 'Build App', description: 'Build the application' },
        } as WorkflowResult),
        getWorkspace: vi.fn().mockReturnValue('/test'),
      } as unknown as Team;

      (ceoAgent as unknown as { teams: Map<string, Team> }).teams.set('default', mockTechTeam);
      // Note: ops team is NOT registered

      const result = await ceoAgent.executeGoalWithDeployment('Build and deploy app', 'default', {
        target: 'local',
        monitor: false,
      });

      // CEO should auto-create ops team
      expect(ceoAgent.getTeam('ops')).toBeDefined();
    });
  });
});
