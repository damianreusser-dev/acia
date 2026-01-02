/**
 * Team Class
 *
 * Coordinates work between PM, Dev, and QA agents.
 * Manages the workflow of task planning, execution, and verification.
 * Supports Dev → QA → Fix iteration loops with escalation.
 */

import { LLMClient } from '../core/llm/client.js';
import { Tool } from '../core/tools/types.js';
import { Task, TaskResult, createTask } from '../core/tasks/types.js';
import { DevAgent } from '../agents/dev/dev-agent.js';
import { QAAgent } from '../agents/qa/qa-agent.js';
import { PMAgent, TaskBreakdown } from '../agents/pm/pm-agent.js';

export interface TeamConfig {
  workspace: string;
  llmClient: LLMClient;
  tools: Tool[];
  maxRetries?: number;
  maxIterations?: number;
  onEscalation?: (reason: string, task: Task) => void;
  onProgress?: (message: string, task?: Task) => void;
}

export interface WorkflowResult {
  success: boolean;
  task: Task;
  breakdown?: TaskBreakdown;
  devResults: Array<{ task: Task; result: TaskResult }>;
  qaResults: Array<{ task: Task; result: TaskResult }>;
  iterations: number;
  escalated: boolean;
  escalationReason?: string;
}

export class Team {
  private pmAgent: PMAgent;
  private devAgent: DevAgent;
  private qaAgent: QAAgent;
  private workspace: string;
  private maxIterations: number;
  private onEscalation?: (reason: string, task: Task) => void;
  private onProgress?: (message: string, task?: Task) => void;

  constructor(config: TeamConfig) {
    this.workspace = config.workspace;
    this.maxIterations = config.maxIterations ?? 3;
    this.onEscalation = config.onEscalation;
    this.onProgress = config.onProgress;

    // Create PM Agent with read-only tools (for planning)
    const pmTools = config.tools.filter(
      (t) =>
        t.definition.name === 'read_file' ||
        t.definition.name === 'list_directory'
    );

    this.pmAgent = new PMAgent({
      llmClient: config.llmClient,
      tools: pmTools,
      workspace: config.workspace,
      maxRetries: config.maxRetries,
    });

    // Create Dev Agent with all tools
    this.devAgent = new DevAgent({
      llmClient: config.llmClient,
      tools: config.tools,
      workspace: config.workspace,
    });

    // Create QA Agent with all tools
    this.qaAgent = new QAAgent({
      llmClient: config.llmClient,
      tools: config.tools,
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

        // Skip completed tasks
        if (task.status === 'completed') continue;

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
   * Execute a task with the Dev agent
   */
  private async executeDevTask(task: Task): Promise<TaskResult> {
    this.pmAgent.updateTaskStatus(task.id, 'in_progress');
    return this.devAgent.executeTask(task);
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
   * Get the Dev agent for direct interaction
   */
  getDevAgent(): DevAgent {
    return this.devAgent;
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
}
