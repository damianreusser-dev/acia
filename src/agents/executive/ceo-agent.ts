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

/**
 * Multi-team project assignment
 */
export interface TeamAssignment {
  teamName: string;
  projects: Project[];
}

/**
 * Result from multi-team goal execution
 */
export interface MultiTeamResult {
  success: boolean;
  teamResults: Map<string, CEOResult>;
  totalProjects: number;
  totalCompleted: number;
  totalFailed: number;
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

    // OPTIMIZATION: For scaffold tasks, skip project planning and delegate directly
    let projects: Project[];
    if (this.isScaffoldGoal(goal)) {
      projects = [this.createScaffoldProject(goal)];
    } else {
      // Break down goal into projects
      projects = await this.planProjects(goal);
    }

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
   * Check if a goal is for scaffolding a new project (simple scaffold only)
   *
   * IMPORTANT: This should only return true for SIMPLE scaffold requests.
   * If the goal has detailed requirements (endpoints, features, etc.),
   * we need full project planning, not just scaffolding.
   */
  private isScaffoldGoal(goal: string): boolean {
    const text = goal.toLowerCase();

    // First check for explicit scaffold keywords
    const scaffoldKeywords = [
      'generate_project',
      'scaffold',
      'template=',
    ];
    const hasScaffoldKeyword = scaffoldKeywords.some(keyword => text.includes(keyword));

    // If there are detailed requirements, this is NOT a simple scaffold
    // Detailed requirements include: specific endpoints, features, components, etc.
    const detailedRequirementIndicators = [
      'endpoint',
      'api:',
      'route',
      'get /',
      'post /',
      'put /',
      'delete /',
      'component',
      'model:',
      'with:',   // "with: BACKEND..." indicates detailed specs
      'requirements:',
      'must have',
      'should have',
    ];
    const hasDetailedRequirements = detailedRequirementIndicators.some(
      indicator => text.includes(indicator)
    );

    // Only treat as scaffold if we have scaffold keyword AND no detailed requirements
    // OR if it's a very simple request like "create a simple fullstack" without specs
    if (hasDetailedRequirements) {
      return false; // Full planning needed for detailed requirements
    }

    // Simple creation requests (no detailed specs)
    const simpleCreationPatterns = [
      'create a simple fullstack',
      'create a fullstack project',
      'create an express api project',
      'create a react project',
    ];
    const isSimpleCreation = simpleCreationPatterns.some(
      pattern => text.includes(pattern)
    ) && !hasDetailedRequirements;

    return hasScaffoldKeyword || isSimpleCreation;
  }

  /**
   * Create a scaffold project without LLM planning
   */
  private createScaffoldProject(goal: string): Project {
    // Extract project name from goal
    // Try multiple patterns for project name extraction
    const patterns = [
      /projectName[=:]\s*["']?([a-zA-Z0-9_-]+)["']?/i,           // projectName="test-app"
      /(?:in\s+(?:the\s+)?)?directory\s*["']?([a-zA-Z0-9_-]+)["']?/i, // directory "test-app" or in the directory "test-app"
      /(?:in\s+(?:the\s+)?)?folder\s*["']?([a-zA-Z0-9_-]+)["']?/i,    // folder "test-app"
      /["']([a-zA-Z0-9_-]+)["']\s*(?:directory|folder|project)/i,     // "test-app" directory
    ];

    let projectName = 'my-project';
    for (const pattern of patterns) {
      const match = goal.match(pattern);
      if (match?.[1] && match[1] !== 'the') {
        projectName = match[1];
        break;
      }
    }

    return {
      id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      title: `Scaffold ${projectName}`,
      description: `${goal}\n\nIMPORTANT: Use generate_project tool with template="fullstack" and projectName="${projectName}".`,
      priority: 'high',
      status: 'pending',
      createdAt: new Date(),
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

  /**
   * Execute a goal across multiple teams
   * Analyzes the goal and assigns work to appropriate teams
   */
  async executeGoalMultiTeam(goal: string): Promise<MultiTeamResult> {
    if (this.teams.size === 0) {
      return {
        success: false,
        teamResults: new Map(),
        totalProjects: 0,
        totalCompleted: 0,
        totalFailed: 0,
        escalatedToHuman: true,
        humanEscalationReason: 'No teams registered',
      };
    }

    // Plan projects and assign to teams
    const assignments = await this.planAndAssignProjects(goal);

    // Execute projects in parallel across teams
    const teamResults = new Map<string, CEOResult>();
    let totalProjects = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let escalatedToHuman = false;
    let humanEscalationReason: string | undefined;

    // Execute all team assignments in parallel
    const teamPromises = assignments.map(async (assignment) => {
      const team = this.teams.get(assignment.teamName);
      if (!team) {
        return {
          teamName: assignment.teamName,
          result: {
            success: false,
            projects: assignment.projects,
            completedProjects: 0,
            failedProjects: assignment.projects.length,
            escalatedToHuman: true,
            humanEscalationReason: `Team "${assignment.teamName}" not found`,
          } as CEOResult,
        };
      }

      // Execute each project for this team sequentially
      let completedProjects = 0;
      let failedProjects = 0;

      for (const project of assignment.projects) {
        this.activeProjects.set(project.id, project);
        project.status = 'in_progress';

        try {
          const result = await team.executeTask(project.description, project.priority);
          project.result = result;

          if (result.success) {
            project.status = 'completed';
            project.completedAt = new Date();
            completedProjects++;
          } else {
            project.status = 'completed';
            project.completedAt = new Date();
            failedProjects++;
          }
        } catch (error) {
          project.status = 'blocked';
          failedProjects++;
        }
      }

      return {
        teamName: assignment.teamName,
        result: {
          success: failedProjects === 0,
          projects: assignment.projects,
          completedProjects,
          failedProjects,
          escalatedToHuman: false,
        } as CEOResult,
      };
    });

    // Wait for all teams to complete
    const results = await Promise.all(teamPromises);

    // Aggregate results
    for (const { teamName, result } of results) {
      teamResults.set(teamName, result);
      totalProjects += result.projects.length;
      totalCompleted += result.completedProjects;
      totalFailed += result.failedProjects;

      if (result.escalatedToHuman) {
        escalatedToHuman = true;
        humanEscalationReason = result.humanEscalationReason;
      }
    }

    // Log to wiki if available
    if (this.wikiService) {
      await this.logMultiTeamGoalCompletion(goal, teamResults, totalCompleted, totalFailed);
    }

    return {
      success: totalFailed === 0 && !escalatedToHuman,
      teamResults,
      totalProjects,
      totalCompleted,
      totalFailed,
      escalatedToHuman,
      humanEscalationReason,
    };
  }

  /**
   * Plan projects and assign them to appropriate teams
   */
  private async planAndAssignProjects(goal: string): Promise<TeamAssignment[]> {
    const teamNames = this.getTeams();
    const prompt = this.buildMultiTeamPlanningPrompt(goal, teamNames);
    const response = await this.processMessageWithTools(prompt);
    return this.parseTeamAssignments(response, goal, teamNames);
  }

  /**
   * Build prompt for multi-team planning
   */
  private buildMultiTeamPlanningPrompt(goal: string, teamNames: string[]): string {
    let prompt = `## Strategic Goal\n\n${goal}\n\n`;
    prompt += `You have access to the following teams:\n`;
    for (const name of teamNames) {
      prompt += `- ${name}\n`;
    }
    prompt += `\nPlease analyze this goal and assign projects to appropriate teams.\n\n`;
    prompt += `For each team, list the projects they should work on:\n\n`;
    prompt += `TEAM_ASSIGNMENTS:\n`;
    prompt += `TEAM: [TeamName]\n`;
    prompt += `1. [Title] | [Priority: low/medium/high/critical] | [Description]\n`;
    prompt += `2. [Title] | [Priority] | [Description]\n\n`;
    prompt += `TEAM: [AnotherTeam]\n`;
    prompt += `1. [Title] | [Priority] | [Description]\n\n`;
    prompt += `Assign work based on team specialization. For example:\n`;
    prompt += `- Frontend teams should handle UI, React components, CSS\n`;
    prompt += `- Backend teams should handle APIs, database, server logic\n`;
    return prompt;
  }

  /**
   * Parse team assignments from LLM response
   */
  private parseTeamAssignments(
    response: string,
    goal: string,
    availableTeams: string[]
  ): TeamAssignment[] {
    const assignments: TeamAssignment[] = [];
    const teamProjectsMap = new Map<string, Project[]>();

    // Initialize map for all teams
    for (const team of availableTeams) {
      teamProjectsMap.set(team, []);
    }

    // Look for TEAM_ASSIGNMENTS section
    const assignmentsMatch = response.match(/TEAM_ASSIGNMENTS:?\s*([\s\S]*?)$/i);
    if (assignmentsMatch && assignmentsMatch[1]) {
      const content = assignmentsMatch[1];

      // Find all TEAM: blocks
      const teamBlocks = content.split(/TEAM:\s*/i).filter((b) => b.trim());

      for (const block of teamBlocks) {
        const lines = block.split('\n');
        const teamNameLine = lines[0]?.trim() ?? '';

        // Find matching team (case-insensitive)
        let matchedTeam: string | undefined;
        for (const availTeam of availableTeams) {
          if (teamNameLine.toLowerCase().includes(availTeam.toLowerCase())) {
            matchedTeam = availTeam;
            break;
          }
        }

        if (!matchedTeam) continue;

        // Parse projects for this team
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i] ?? '';
          const match = line.match(/\d+\.\s*\[?([^\]|]+)\]?\s*\|\s*\[?(?:Priority:\s*)?([^\]|]+)\]?\s*\|\s*(.+)/i);

          if (match && match[1] && match[2] && match[3]) {
            const priorityStr = match[2].trim().toLowerCase();
            const priority = ['low', 'medium', 'high', 'critical'].includes(priorityStr)
              ? (priorityStr as 'low' | 'medium' | 'high' | 'critical')
              : 'medium';

            const projects = teamProjectsMap.get(matchedTeam) ?? [];
            projects.push({
              id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
              title: match[1].trim(),
              description: match[3].trim(),
              priority,
              status: 'pending',
              createdAt: new Date(),
            });
            teamProjectsMap.set(matchedTeam, projects);
          }
        }
      }
    }

    // Build assignments from map
    for (const [teamName, projects] of teamProjectsMap) {
      if (projects.length > 0) {
        assignments.push({ teamName, projects });
      }
    }

    // If no projects parsed, assign a single project to the first team
    if (assignments.length === 0 && availableTeams.length > 0 && availableTeams[0]) {
      assignments.push({
        teamName: availableTeams[0],
        projects: [{
          id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
          title: goal.substring(0, 50),
          description: goal,
          priority: 'medium',
          status: 'pending',
          createdAt: new Date(),
        }],
      });
    }

    return assignments;
  }

  /**
   * Log multi-team goal completion to wiki
   */
  private async logMultiTeamGoalCompletion(
    goal: string,
    teamResults: Map<string, CEOResult>,
    totalCompleted: number,
    totalFailed: number
  ): Promise<void> {
    if (!this.wikiService) return;

    const timestamp = new Date().toISOString();
    let content = `
## Multi-Team Goal: ${goal.substring(0, 100)}

**Completed**: ${timestamp}
**Total Succeeded**: ${totalCompleted}
**Total Failed**: ${totalFailed}

### Team Results
`;

    for (const [teamName, result] of teamResults) {
      content += `
#### ${teamName}
- Projects: ${result.projects.length}
- Completed: ${result.completedProjects}
- Failed: ${result.failedProjects}
${result.projects.map((p) => `  - ${p.title}: ${p.status}`).join('\n')}
`;
    }

    content += `
---
`;

    await this.wikiService.appendToPage('executive/multi-team-goals-log.md', content);
  }

  /**
   * Get coordination status across all teams
   */
  getCoordinationStatus(): {
    teamsCount: number;
    activeProjectsCount: number;
    projectsByTeam: Map<string, number>;
    projectsByStatus: Record<string, number>;
  } {
    const projectsByStatus: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      blocked: 0,
    };

    for (const project of this.activeProjects.values()) {
      const current = projectsByStatus[project.status] ?? 0;
      projectsByStatus[project.status] = current + 1;
    }

    // This is a simplified count - in a real system we'd track which team owns each project
    const projectsByTeam = new Map<string, number>();
    for (const teamName of this.teams.keys()) {
      projectsByTeam.set(teamName, 0);
    }

    return {
      teamsCount: this.teams.size,
      activeProjectsCount: this.activeProjects.size,
      projectsByTeam,
      projectsByStatus,
    };
  }
}
