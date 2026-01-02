/**
 * CEO Agent
 *
 * High-level orchestrator that manages Teams.
 * Receives strategic goals and delegates to appropriate teams.
 * Handles escalations from PM agents.
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient } from '../../core/llm/client.js';
import { Team, WorkflowResult, TeamConfig } from '../../team/team.js';
import { WikiService } from '../../core/wiki/wiki-service.js';

const CEO_SYSTEM_PROMPT = `You are the CEO Agent, the highest-level orchestrator in an autonomous software company.

Your responsibilities:
1. Receive high-level goals and strategic initiatives
2. Break down goals into projects for teams to execute
3. Prioritize work based on business value
4. Handle escalations from PM agents
5. Make strategic decisions when teams are blocked
6. Track overall company progress

When receiving a goal:
1. Analyze the scope and complexity
2. Determine if it needs one team or multiple
3. Create clear project descriptions
4. Set priorities and success criteria

When handling escalations:
1. Understand why the team is blocked
2. Make a decision or request more information
3. Provide guidance to unblock the team
4. Escalate to human if truly stuck

You have access to read project documentation and make strategic decisions.`;

export interface CEOAgentConfig {
  name?: string;
  llmClient: LLMClient;
  tools: Tool[];
  wikiService?: WikiService;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  createdAt: Date;
  completedAt?: Date;
  result?: WorkflowResult;
}

export interface CEOResult {
  success: boolean;
  projects: Project[];
  completedProjects: number;
  failedProjects: number;
  escalatedToHuman: boolean;
  humanEscalationReason?: string;
}

export class CEOAgent extends Agent {
  private wikiService?: WikiService;
  private activeProjects: Map<string, Project> = new Map();
  private teams: Map<string, Team> = new Map();
  private onHumanEscalation?: (reason: string, project: Project) => void;

  constructor(config: CEOAgentConfig) {
    const agentConfig: AgentConfig = {
      name: config.name ?? 'CEO',
      role: 'Chief Executive Officer',
      systemPrompt: CEO_SYSTEM_PROMPT,
      llmClient: config.llmClient,
      tools: config.tools,
    };
    super(agentConfig);
    this.wikiService = config.wikiService;
  }

  /**
   * Set callback for human escalation
   */
  setHumanEscalationHandler(handler: (reason: string, project: Project) => void): void {
    this.onHumanEscalation = handler;
  }

  /**
   * Create and register a team
   */
  createTeam(name: string, config: Omit<TeamConfig, 'wikiService'>): Team {
    const team = new Team({
      ...config,
      wikiService: this.wikiService,
    });
    this.teams.set(name, team);
    return team;
  }

  /**
   * Get a registered team by name
   */
  getTeam(name: string): Team | undefined {
    return this.teams.get(name);
  }

  /**
   * Execute a high-level goal
   * Breaks it down into projects and delegates to teams
   */
  async executeGoal(
    goal: string,
    teamName: string = 'default'
  ): Promise<CEOResult> {
    const team = this.teams.get(teamName);
    if (!team) {
      return {
        success: false,
        projects: [],
        completedProjects: 0,
        failedProjects: 0,
        escalatedToHuman: true,
        humanEscalationReason: `No team registered with name: ${teamName}`,
      };
    }

    // Break down goal into projects
    const projects = await this.planProjects(goal);

    let completedProjects = 0;
    let failedProjects = 0;
    let escalatedToHuman = false;
    let humanEscalationReason: string | undefined;

    // Execute each project
    for (const project of projects) {
      this.activeProjects.set(project.id, project);
      project.status = 'in_progress';

      try {
        const result = await team.executeTask(project.description, project.priority);
        project.result = result;

        if (result.success) {
          project.status = 'completed';
          project.completedAt = new Date();
          completedProjects++;
        } else if (result.escalated) {
          // Handle escalation from team
          const decision = await this.handleEscalation(project, result);

          if (decision.escalateToHuman) {
            project.status = 'blocked';
            escalatedToHuman = true;
            humanEscalationReason = decision.reason;
            this.emitHumanEscalation(decision.reason, project);
          } else {
            // CEO made a decision, project failed but not blocked
            project.status = 'completed';
            project.completedAt = new Date();
            failedProjects++;
          }
        } else {
          project.status = 'completed';
          project.completedAt = new Date();
          failedProjects++;
        }
      } catch (error) {
        project.status = 'blocked';
        failedProjects++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        humanEscalationReason = `Project "${project.title}" failed with error: ${errorMessage}`;
        escalatedToHuman = true;
        this.emitHumanEscalation(humanEscalationReason, project);
      }
    }

    // Log to wiki if available
    if (this.wikiService) {
      await this.logGoalCompletion(goal, projects, completedProjects, failedProjects);
    }

    return {
      success: failedProjects === 0 && !escalatedToHuman,
      projects,
      completedProjects,
      failedProjects,
      escalatedToHuman,
      humanEscalationReason,
    };
  }

  /**
   * Plan projects from a high-level goal
   */
  private async planProjects(goal: string): Promise<Project[]> {
    const prompt = this.buildPlanningPrompt(goal);
    const response = await this.processMessageWithTools(prompt);
    return this.parseProjects(response, goal);
  }

  /**
   * Build prompt for goal planning
   */
  private buildPlanningPrompt(goal: string): string {
    let prompt = `## Strategic Goal\n\n${goal}\n\n`;
    prompt += `Please analyze this goal and break it down into projects.\n\n`;
    prompt += `For each project, provide:\n`;
    prompt += `PROJECTS:\n`;
    prompt += `1. [Title] | [Priority: low/medium/high/critical] | [Description]\n`;
    prompt += `2. [Title] | [Priority] | [Description]\n\n`;
    prompt += `Keep projects focused and achievable by a single team.\n`;
    prompt += `Prioritize based on business value and dependencies.`;
    return prompt;
  }

  /**
   * Parse projects from LLM response
   */
  private parseProjects(response: string, goal: string): Project[] {
    const projects: Project[] = [];

    // Look for PROJECTS section
    const projectsMatch = response.match(/PROJECTS:?\s*([\s\S]*?)$/i);
    if (projectsMatch && projectsMatch[1]) {
      // Parse each project line: "1. [Title] | [Priority] | [Description]"
      const lines = projectsMatch[1].match(/\d+\.\s*\[?([^\]|]+)\]?\s*\|\s*\[?(?:Priority:\s*)?([^\]|]+)\]?\s*\|\s*(.+)/gi);

      if (lines) {
        for (const line of lines) {
          const match = line.match(/\d+\.\s*\[?([^\]|]+)\]?\s*\|\s*\[?(?:Priority:\s*)?([^\]|]+)\]?\s*\|\s*(.+)/i);
          if (match && match[1] && match[2] && match[3]) {
            const priorityStr = match[2].trim().toLowerCase();
            const priority = ['low', 'medium', 'high', 'critical'].includes(priorityStr)
              ? (priorityStr as 'low' | 'medium' | 'high' | 'critical')
              : 'medium';

            projects.push({
              id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
              title: match[1].trim(),
              description: match[3].trim(),
              priority,
              status: 'pending',
              createdAt: new Date(),
            });
          }
        }
      }
    }

    // If no projects parsed, create a single project from the goal
    if (projects.length === 0) {
      projects.push({
        id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
        title: goal.substring(0, 50),
        description: goal,
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(),
      });
    }

    return projects;
  }

  /**
   * Handle escalation from a team
   */
  private async handleEscalation(
    project: Project,
    result: WorkflowResult
  ): Promise<{ escalateToHuman: boolean; reason: string }> {
    const prompt = `## Escalation from Team

**Project**: ${project.title}
**Issue**: ${result.escalationReason}

The team has escalated this issue and cannot proceed.

Please analyze:
1. Can you make a decision to unblock the team?
2. Is this something that requires human input?

Respond with:
DECISION: [Your decision or guidance]
ESCALATE_TO_HUMAN: [yes/no]
REASON: [Why you made this decision]`;

    const response = await this.processMessage(prompt);

    // Parse the response
    const escalateMatch = response.match(/ESCALATE_TO_HUMAN:\s*(yes|no)/i);
    const reasonMatch = response.match(/REASON:\s*(.+)/i);

    const escalateToHuman = escalateMatch?.[1]?.toLowerCase() === 'yes';
    const reason = reasonMatch?.[1]?.trim() ?? result.escalationReason ?? 'Unknown reason';

    return { escalateToHuman, reason };
  }

  /**
   * Emit human escalation event
   */
  private emitHumanEscalation(reason: string, project: Project): void {
    if (this.onHumanEscalation) {
      this.onHumanEscalation(reason, project);
    }
  }

  /**
   * Log goal completion to wiki
   */
  private async logGoalCompletion(
    goal: string,
    projects: Project[],
    completed: number,
    failed: number
  ): Promise<void> {
    if (!this.wikiService) return;

    const timestamp = new Date().toISOString();
    const content = `
## Goal: ${goal.substring(0, 100)}

**Completed**: ${timestamp}
**Projects**: ${projects.length}
**Succeeded**: ${completed}
**Failed**: ${failed}

### Projects
${projects.map((p) => `- ${p.title}: ${p.status} (${p.priority})`).join('\n')}

---
`;

    await this.wikiService.appendToPage('executive/goals-log.md', content);
  }

  /**
   * Get all active projects
   */
  getActiveProjects(): Project[] {
    return Array.from(this.activeProjects.values());
  }

  /**
   * Get project by ID
   */
  getProject(projectId: string): Project | undefined {
    return this.activeProjects.get(projectId);
  }

  /**
   * Get all registered teams
   */
  getTeams(): string[] {
    return Array.from(this.teams.keys());
  }
}
