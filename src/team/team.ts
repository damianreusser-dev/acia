/**
 * Team Class
 *
 * Coordinates work between PM, Dev, and QA agents.
 * Manages the workflow of task planning, execution, and verification.
 * Supports Dev → QA → Fix iteration loops with escalation.
 * Optionally integrates with Wiki for persistent knowledge.
 *
 * Phase 6a: Now implements ITeam interface for abstraction.
 */

import { LLMClient } from '../core/llm/client.js';
import { Tool } from '../core/tools/types.js';
import { Task, TaskResult, createTask } from '../core/tasks/types.js';
import { DevAgent } from '../agents/dev/dev-agent.js';
import { FrontendDevAgent } from '../agents/dev/frontend-dev-agent.js';
import { BackendDevAgent } from '../agents/dev/backend-dev-agent.js';
import { QAAgent } from '../agents/qa/qa-agent.js';
import { PMAgent, TaskBreakdown } from '../agents/pm/pm-agent.js';
import { WikiService } from '../core/wiki/wiki-service.js';
import { createWikiTools } from '../core/wiki/wiki-tools.js';
import type { ITeam } from './team-interface.js';
import { WorkflowResult } from './team-interface.js';

// Re-export for backward compatibility
export { Priority, WorkflowResult } from './team-interface.js';
export type { TeamCallbacks } from './team-interface.js';

/**
 * Agent specialization types
 */
export type DevAgentType = 'general' | 'frontend' | 'backend';

export interface TeamConfig {
  workspace: string;
  llmClient: LLMClient;
  tools: Tool[];
  wikiService?: WikiService; // Optional wiki for persistent knowledge
  maxRetries?: number;
  maxIterations?: number;
  onEscalation?: (reason: string, task: Task) => void;
  onProgress?: (message: string, task?: Task) => void;
}

/**
 * TechTeam (formerly just Team)
 *
 * Implements ITeam interface for the Tech division.
 * Coordinates PM, Dev (general/frontend/backend), and QA agents.
 */
export class Team implements ITeam {
  private pmAgent: PMAgent;
  private devAgent: DevAgent;
  private frontendDevAgent: FrontendDevAgent;
  private backendDevAgent: BackendDevAgent;
  private qaAgent: QAAgent;
  private workspace: string;
  private wikiService?: WikiService;
  private maxIterations: number;
  private onEscalation?: (reason: string, task: Task) => void;
  private onProgress?: (message: string, task?: Task) => void;

  constructor(config: TeamConfig) {
    this.workspace = config.workspace;
    this.wikiService = config.wikiService;
    this.maxIterations = config.maxIterations ?? 5; // Increased for complex multi-task workflows
    this.onEscalation = config.onEscalation;
    this.onProgress = config.onProgress;

    // Create wiki tools if wiki service is provided
    const wikiTools = config.wikiService
      ? createWikiTools(config.wikiService)
      : [];

    // Create PM Agent with read-only tools + wiki tools (for planning with context)
    const pmTools = [
      ...config.tools.filter(
        (t) =>
          t.definition.name === 'read_file' ||
          t.definition.name === 'list_directory'
      ),
      ...wikiTools.filter(
        (t) =>
          t.definition.name === 'read_wiki' ||
          t.definition.name === 'search_wiki' ||
          t.definition.name === 'list_wiki'
      ),
    ];

    this.pmAgent = new PMAgent({
      llmClient: config.llmClient,
      tools: pmTools,
      workspace: config.workspace,
      maxRetries: config.maxRetries,
      wikiService: config.wikiService, // For design-first development
    });

    const devTools = [...config.tools, ...wikiTools];

    // Create general Dev Agent with all tools + wiki tools
    this.devAgent = new DevAgent({
      llmClient: config.llmClient,
      tools: devTools,
      workspace: config.workspace,
    });

    // Create specialized Frontend Dev Agent
    this.frontendDevAgent = new FrontendDevAgent({
      llmClient: config.llmClient,
      tools: devTools,
      workspace: config.workspace,
    });

    // Create specialized Backend Dev Agent
    this.backendDevAgent = new BackendDevAgent({
      llmClient: config.llmClient,
      tools: devTools,
      workspace: config.workspace,
    });

    // Create QA Agent with all tools + wiki tools
    this.qaAgent = new QAAgent({
      llmClient: config.llmClient,
      tools: devTools,
      workspace: config.workspace,
    });
  }

  /**
   * Execute a high-level task through the team workflow with iteration support
   */
  async executeTask(
    taskDescription: string,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<WorkflowResult> {
    // Create the parent task
    const parentTask = createTask({
      type: 'implement',
      title: taskDescription,
      description: taskDescription,
      createdBy: 'User',
      priority,
    });

    // Track the parent task
    this.pmAgent.trackTask(parentTask);
    this.pmAgent.updateTaskStatus(parentTask.id, 'in_progress');

    const devResults: Array<{ task: Task; result: TaskResult }> = [];
    const qaResults: Array<{ task: Task; result: TaskResult }> = [];
    let iterations = 0;

    this.emitProgress('Planning task...', parentTask);

    // Step 1: PM plans the task
    let breakdown: TaskBreakdown;
    try {
      breakdown = await this.pmAgent.planTask(parentTask);
      console.log('[Team] PM breakdown:', {
        devTasks: breakdown.devTasks.map(t => ({ id: t.id, title: t.title })),
        qaTasks: breakdown.qaTasks.map(t => ({ id: t.id, title: t.title })),
        order: breakdown.order
      });
      this.emitProgress(
        `Planned ${breakdown.devTasks.length} dev tasks and ${breakdown.qaTasks.length} QA tasks`,
        parentTask
      );
    } catch (error) {
      const reason = `Failed to plan task: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.emitEscalation(reason, parentTask);
      return {
        success: false,
        task: parentTask,
        devResults,
        qaResults,
        iterations,
        escalated: true,
        escalationReason: reason,
      };
    }

    // Track all subtasks
    for (const task of breakdown.devTasks) {
      this.pmAgent.trackTask(task);
    }
    for (const task of breakdown.qaTasks) {
      this.pmAgent.trackTask(task);
    }

    // Step 2: Execute with iteration loop
    let allTasksComplete = false;

    while (!allTasksComplete && iterations < this.maxIterations) {
      iterations++;
      this.emitProgress(`Starting iteration ${iterations}`, parentTask);

      // Track failed QA tasks that need dev fixes
      const qaFailures: Array<{ qaTask: Task; result: TaskResult }> = [];

      // Execute tasks in order
      for (const orderItem of breakdown.order) {
        const task = this.pmAgent.getTask(orderItem.taskId);
        if (!task) continue;

        console.log(`[Team] Processing task: ${task.title}, status=${task.status}, iteration=${iterations}`);

        // Skip completed tasks
        if (task.status === 'completed') {
          console.log(`[Team] Skipping completed task: ${task.title}`);
          continue;
        }

        // Execute the task with the appropriate agent
        let result: TaskResult;
        if (orderItem.agent === 'dev') {
          this.emitProgress(`Dev working on: ${task.title}`, task);
          result = await this.executeDevTask(task);
          devResults.push({ task, result });
        } else {
          this.emitProgress(`QA testing: ${task.title}`, task);
          result = await this.executeQATask(task);
          qaResults.push({ task, result });

          // Track QA failures for fix loop
          if (!result.success) {
            qaFailures.push({ qaTask: task, result });
          }
        }

        console.log(`[Team] Task ${task.title} result: success=${result.success}`);

        // Let PM handle the result
        const decision = await this.pmAgent.handleTaskResult(
          task,
          result,
          orderItem.agent
        );

        if (decision.action === 'escalate') {
          const reason =
            decision.feedback ?? `Task "${task.title}" failed after max attempts`;
          this.pmAgent.updateTaskStatus(parentTask.id, 'failed');
          this.emitEscalation(reason, parentTask);
          return {
            success: false,
            task: parentTask,
            breakdown,
            devResults,
            qaResults,
            iterations,
            escalated: true,
            escalationReason: reason,
          };
        }

        // If retry needed for the same task, execute again
        if (decision.action === 'retry') {
          task.context = {
            ...task.context,
            previousAttemptFeedback: decision.feedback,
          };

          if (orderItem.agent === 'dev') {
            this.emitProgress(`Dev retrying: ${task.title}`, task);
            result = await this.executeDevTask(task);
            devResults.push({ task, result });
          } else {
            this.emitProgress(`QA retrying: ${task.title}`, task);
            result = await this.executeQATask(task);
            qaResults.push({ task, result });
          }

          const retryDecision = await this.pmAgent.handleTaskResult(
            task,
            result,
            orderItem.agent
          );

          if (retryDecision.action === 'escalate') {
            const reason =
              retryDecision.feedback ??
              `Task "${task.title}" failed after retry`;
            this.pmAgent.updateTaskStatus(parentTask.id, 'failed');
            this.emitEscalation(reason, parentTask);
            return {
              success: false,
              task: parentTask,
              breakdown,
              devResults,
              qaResults,
              iterations,
              escalated: true,
              escalationReason: reason,
            };
          }
        }
      }

      // Check if we need another iteration (QA found issues)
      if (qaFailures.length > 0 && iterations < this.maxIterations) {
        this.emitProgress(
          `QA found ${qaFailures.length} issues, creating fix tasks`,
          parentTask
        );

        // Create fix tasks for QA failures
        for (const { qaTask, result } of qaFailures) {
          const fixTask = createTask({
            type: 'fix',
            title: `Fix issues from: ${qaTask.title}`,
            description: `QA found issues:\n${result.output ?? result.error ?? 'Unknown issues'}\n\nPlease fix these issues.`,
            createdBy: this.pmAgent.name,
            priority: parentTask.priority,
            parentTaskId: parentTask.id,
            context: {
              qaTaskId: qaTask.id,
              qaFeedback: result.output ?? result.error,
            },
          });

          // Add fix task to breakdown and track it
          breakdown.devTasks.push(fixTask);
          breakdown.order.push({ agent: 'dev', taskId: fixTask.id });
          this.pmAgent.trackTask(fixTask);

          // Reset QA task for re-testing
          this.pmAgent.updateTaskStatus(qaTask.id, 'pending');
          qaTask.attempts = 0;
        }
      } else {
        // No QA failures or max iterations reached
        allTasksComplete = true;
      }
    }

    // Check final status
    const allCompleted = this.pmAgent
      .getActiveTasks()
      .filter((t) => t.parentTaskId === parentTask.id || t.id === parentTask.id)
      .every((t) => t.status === 'completed' || t.id === parentTask.id);

    if (allCompleted) {
      this.pmAgent.updateTaskStatus(parentTask.id, 'completed');
      this.emitProgress('All tasks completed successfully', parentTask);
      return {
        success: true,
        task: parentTask,
        breakdown,
        devResults,
        qaResults,
        iterations,
        escalated: false,
      };
    } else if (iterations >= this.maxIterations) {
      const reason = `Max iterations (${this.maxIterations}) reached without completing all tasks`;
      this.pmAgent.updateTaskStatus(parentTask.id, 'failed');
      this.emitEscalation(reason, parentTask);
      return {
        success: false,
        task: parentTask,
        breakdown,
        devResults,
        qaResults,
        iterations,
        escalated: true,
        escalationReason: reason,
      };
    }

    // Fallback - should not reach here
    this.pmAgent.updateTaskStatus(parentTask.id, 'completed');
    return {
      success: true,
      task: parentTask,
      breakdown,
      devResults,
      qaResults,
      iterations,
      escalated: false,
    };
  }

  /**
   * Determine the appropriate dev agent type for a task
   */
  selectDevAgentType(task: Task): DevAgentType {
    const title = task.title.toLowerCase();
    const description = task.description.toLowerCase();
    const context = task.context ?? {};

    // Check for explicit agent type in context
    if (context.agentType) {
      const specifiedType = String(context.agentType).toLowerCase();
      if (specifiedType === 'frontend') return 'frontend';
      if (specifiedType === 'backend') return 'backend';
    }

    // Frontend keywords
    const frontendKeywords = [
      'react', 'component', 'tsx', 'jsx', 'ui', 'frontend',
      'css', 'tailwind', 'styled', 'button', 'form', 'modal',
      'page', 'layout', 'view', 'hook', 'state', 'props',
      'dashboard', 'sidebar', 'navbar', 'header', 'footer',
      'responsive', 'mobile', 'desktop', 'animation', 'transition',
    ];

    // Backend keywords
    const backendKeywords = [
      'api', 'endpoint', 'route', 'router', 'express', 'backend',
      'server', 'database', 'db', 'model', 'schema', 'migration',
      'middleware', 'authentication', 'auth', 'jwt', 'session',
      'rest', 'graphql', 'controller', 'service', 'repository',
      'query', 'mutation', 'resolver', 'handler', 'prisma', 'sql',
    ];

    const combined = `${title} ${description}`;

    // Count keyword matches
    let frontendScore = 0;
    let backendScore = 0;

    for (const keyword of frontendKeywords) {
      if (combined.includes(keyword)) frontendScore++;
    }

    for (const keyword of backendKeywords) {
      if (combined.includes(keyword)) backendScore++;
    }

    // File extension hints in task context
    if (context.files) {
      const files = Array.isArray(context.files) ? context.files : [context.files];
      for (const file of files) {
        const fileStr = String(file).toLowerCase();
        if (fileStr.endsWith('.tsx') || fileStr.endsWith('.jsx') || fileStr.endsWith('.css')) {
          frontendScore += 2;
        }
        if (fileStr.includes('route') || fileStr.includes('api') || fileStr.includes('server')) {
          backendScore += 2;
        }
      }
    }

    // Return based on scores
    if (frontendScore > backendScore && frontendScore >= 2) {
      return 'frontend';
    }
    if (backendScore > frontendScore && backendScore >= 2) {
      return 'backend';
    }

    // Default to general agent
    return 'general';
  }

  /**
   * Get the appropriate dev agent for a task
   */
  private getDevAgentForTask(task: Task): DevAgent | FrontendDevAgent | BackendDevAgent {
    const agentType = this.selectDevAgentType(task);
    switch (agentType) {
      case 'frontend':
        return this.frontendDevAgent;
      case 'backend':
        return this.backendDevAgent;
      default:
        return this.devAgent;
    }
  }

  /**
   * Execute a task with the appropriate Dev agent
   */
  private async executeDevTask(task: Task): Promise<TaskResult> {
    this.pmAgent.updateTaskStatus(task.id, 'in_progress');
    const agent = this.getDevAgentForTask(task);
    this.emitProgress(`Using ${agent.role} for: ${task.title}`, task);
    return agent.executeTask(task);
  }

  /**
   * Execute a task with the QA agent
   */
  private async executeQATask(task: Task): Promise<TaskResult> {
    this.pmAgent.updateTaskStatus(task.id, 'in_progress');
    return this.qaAgent.executeTask(task);
  }

  /**
   * Emit escalation notification
   */
  private emitEscalation(reason: string, task: Task): void {
    if (this.onEscalation) {
      this.onEscalation(reason, task);
    }
  }

  /**
   * Emit progress notification
   */
  private emitProgress(message: string, task?: Task): void {
    if (this.onProgress) {
      this.onProgress(message, task);
    }
  }

  /**
   * Get the PM agent for direct interaction
   */
  getPMAgent(): PMAgent {
    return this.pmAgent;
  }

  /**
   * Get the general Dev agent for direct interaction
   */
  getDevAgent(): DevAgent {
    return this.devAgent;
  }

  /**
   * Get the Frontend Dev agent for direct interaction
   */
  getFrontendDevAgent(): FrontendDevAgent {
    return this.frontendDevAgent;
  }

  /**
   * Get the Backend Dev agent for direct interaction
   */
  getBackendDevAgent(): BackendDevAgent {
    return this.backendDevAgent;
  }

  /**
   * Get the QA agent for direct interaction
   */
  getQAAgent(): QAAgent {
    return this.qaAgent;
  }

  /**
   * Get workspace path
   */
  getWorkspace(): string {
    return this.workspace;
  }

  /**
   * Get max iterations setting
   */
  getMaxIterations(): number {
    return this.maxIterations;
  }

  /**
   * Get wiki service if available
   */
  getWikiService(): WikiService | undefined {
    return this.wikiService;
  }

  // ============================================
  // ITeam Interface Methods
  // ============================================

  /**
   * Get the roles of agents in this team.
   *
   * @returns Array of role identifiers
   */
  getAgentRoles(): string[] {
    return ['pm', 'dev', 'frontend-dev', 'backend-dev', 'qa'];
  }

  /**
   * Get the team name.
   *
   * @returns Team name
   */
  getName(): string {
    return 'TechTeam';
  }

  /**
   * Log completed task to wiki (for learnings and history)
   */
  async logTaskCompletion(result: WorkflowResult): Promise<void> {
    if (!this.wikiService) return;

    const timestamp = new Date().toISOString();
    const content = `
## ${result.task.title}

**Status**: ${result.success ? 'Success' : 'Failed'}
**Completed**: ${timestamp}
**Iterations**: ${result.iterations}
**Escalated**: ${result.escalated}
${result.escalationReason ? `**Escalation Reason**: ${result.escalationReason}` : ''}

### Dev Tasks
${result.devResults.map((d) => `- ${d.task.title}: ${d.result.success ? '✅' : '❌'}`).join('\n')}

### QA Tasks
${result.qaResults.map((q) => `- ${q.task.title}: ${q.result.success ? '✅' : '❌'}`).join('\n')}

---
`;

    await this.wikiService.appendToPage('tasks/completed/log.md', content);
  }
}
