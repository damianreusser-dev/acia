/**
 * Project Manager Agent
 *
 * Coordinates work between Dev and QA agents.
 * Breaks down tasks, assigns work, and handles escalations.
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Task, TaskResult, TaskStatus, createTask } from '../../core/tasks/types.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient } from '../../core/llm/client.js';

const PM_SYSTEM_PROMPT = `You are a Project Manager Agent in an autonomous software development team.

Your responsibilities:
1. Break down high-level tasks into specific subtasks
2. Coordinate work between Dev and QA agents
3. Track progress and handle blockers
4. Decide when to escalate issues
5. Ensure quality standards are met

When receiving a task:
1. Analyze what needs to be done
2. Break it into implementation (Dev) and testing (QA) subtasks
3. Determine the order of execution
4. Track the status of each subtask

When handling failures:
1. Analyze why the task failed
2. Decide if it should be retried
3. Provide guidance for the next attempt
4. Escalate if max retries exceeded

Available tools allow you to:
- Read files to understand requirements
- List directories to understand project structure

You coordinate work by creating structured task breakdowns and clear instructions.`;

export interface PMAgentConfig {
  name?: string;
  llmClient: LLMClient;
  tools: Tool[];
  workspace: string;
  maxRetries?: number;
}

export interface TaskBreakdown {
  devTasks: Task[];
  qaTasks: Task[];
  order: Array<{ agent: 'dev' | 'qa'; taskId: string }>;
}

export class PMAgent extends Agent {
  private workspace: string;
  private maxRetries: number;
  private activeTasks: Map<string, Task> = new Map();

  constructor(config: PMAgentConfig) {
    const agentConfig: AgentConfig = {
      name: config.name ?? 'PMAgent',
      role: 'Project Manager',
      systemPrompt: PM_SYSTEM_PROMPT,
      llmClient: config.llmClient,
      tools: config.tools,
    };
    super(agentConfig);
    this.workspace = config.workspace;
    this.maxRetries = config.maxRetries ?? 3;
  }

  /**
   * Break down a high-level task into dev and QA subtasks
   */
  async planTask(task: Task): Promise<TaskBreakdown> {
    const prompt = this.buildPlanningPrompt(task);

    const response = await this.processMessageWithTools(prompt);

    // Parse the response to extract task breakdown
    return this.parseTaskBreakdown(response, task);
  }

  /**
   * Build a prompt for task planning
   */
  private buildPlanningPrompt(task: Task): string {
    let prompt = `## Plan Task: ${task.title}\n\n`;
    prompt += `**Type**: ${task.type}\n`;
    prompt += `**Priority**: ${task.priority}\n`;
    prompt += `**Description**:\n${task.description}\n\n`;

    if (task.context) {
      prompt += `**Context**:\n${JSON.stringify(task.context, null, 2)}\n\n`;
    }

    prompt += `**Workspace**: ${this.workspace}\n\n`;
    prompt += `Please analyze this task and provide a breakdown in the following format:\n\n`;
    prompt += `DEV_TASKS:\n`;
    prompt += `1. [Title] - [Description]\n`;
    prompt += `2. [Title] - [Description]\n\n`;
    prompt += `QA_TASKS:\n`;
    prompt += `1. [Title] - [Description]\n\n`;
    prompt += `EXECUTION_ORDER:\n`;
    prompt += `1. DEV:1\n`;
    prompt += `2. QA:1\n`;
    prompt += `3. DEV:2 (if QA finds issues)\n`;

    return prompt;
  }

  /**
   * Parse task breakdown from LLM response
   */
  private parseTaskBreakdown(response: string, parentTask: Task): TaskBreakdown {
    const devTasks: Task[] = [];
    const qaTasks: Task[] = [];
    const order: Array<{ agent: 'dev' | 'qa'; taskId: string }> = [];

    // Parse DEV_TASKS section
    const devSection = response.match(/DEV_TASKS:?\s*([\s\S]*?)(?=QA_TASKS:|EXECUTION_ORDER:|$)/i);
    if (devSection && devSection[1]) {
      const devLines = devSection[1].match(/\d+\.\s*\[?([^\]\n-]+)\]?\s*[-:]\s*([^\n]+)/g);
      if (devLines) {
        for (const line of devLines) {
          const match = line.match(/\d+\.\s*\[?([^\]\n-]+)\]?\s*[-:]\s*([^\n]+)/);
          if (match && match[1] && match[2]) {
            const task = createTask({
              type: 'implement',
              title: match[1].trim(),
              description: match[2].trim(),
              createdBy: this.name,
              priority: parentTask.priority,
              parentTaskId: parentTask.id,
              maxAttempts: this.maxRetries,
            });
            devTasks.push(task);
          }
        }
      }
    }

    // Parse QA_TASKS section
    const qaSection = response.match(/QA_TASKS:?\s*([\s\S]*?)(?=EXECUTION_ORDER:|DEV_TASKS:|$)/i);
    if (qaSection && qaSection[1]) {
      const qaLines = qaSection[1].match(/\d+\.\s*\[?([^\]\n-]+)\]?\s*[-:]\s*([^\n]+)/g);
      if (qaLines) {
        for (const line of qaLines) {
          const match = line.match(/\d+\.\s*\[?([^\]\n-]+)\]?\s*[-:]\s*([^\n]+)/);
          if (match && match[1] && match[2]) {
            const task = createTask({
              type: 'test',
              title: match[1].trim(),
              description: match[2].trim(),
              createdBy: this.name,
              priority: parentTask.priority,
              parentTaskId: parentTask.id,
              maxAttempts: this.maxRetries,
            });
            qaTasks.push(task);
          }
        }
      }
    }

    // Parse EXECUTION_ORDER section
    const orderSection = response.match(/EXECUTION_ORDER:?\s*([\s\S]*?)$/i);
    if (orderSection && orderSection[1]) {
      const orderLines = orderSection[1].match(/\d+\.\s*(DEV|QA):(\d+)/gi);
      if (orderLines) {
        for (const line of orderLines) {
          const match = line.match(/(DEV|QA):(\d+)/i);
          if (match && match[1] && match[2]) {
            const agent = match[1].toLowerCase() as 'dev' | 'qa';
            const index = parseInt(match[2], 10) - 1;
            const tasks = agent === 'dev' ? devTasks : qaTasks;
            if (tasks[index]) {
              order.push({ agent, taskId: tasks[index].id });
            }
          }
        }
      }
    }

    // If no order specified, default to: all dev tasks, then all QA tasks
    if (order.length === 0) {
      for (const task of devTasks) {
        order.push({ agent: 'dev', taskId: task.id });
      }
      for (const task of qaTasks) {
        order.push({ agent: 'qa', taskId: task.id });
      }
    }

    return { devTasks, qaTasks, order };
  }

  /**
   * Handle a task result and decide next steps
   */
  async handleTaskResult(
    task: Task,
    result: TaskResult,
    agentType: 'dev' | 'qa'
  ): Promise<{
    action: 'continue' | 'retry' | 'escalate';
    feedback?: string;
  }> {
    if (result.success) {
      this.updateTaskStatus(task.id, 'completed', result);
      return { action: 'continue' };
    }

    // Task failed
    task.attempts++;

    if (task.attempts >= task.maxAttempts) {
      this.updateTaskStatus(task.id, 'failed', result);
      return {
        action: 'escalate',
        feedback: `Task "${task.title}" failed after ${task.attempts} attempts. Last error: ${result.error ?? result.output}`,
      };
    }

    // Decide whether to retry
    const prompt = `## Task Failed - Analyze\n\n` +
      `**Task**: ${task.title}\n` +
      `**Agent**: ${agentType}\n` +
      `**Attempt**: ${task.attempts}/${task.maxAttempts}\n` +
      `**Result**: ${result.error ?? result.output}\n\n` +
      `Should this task be retried? Provide brief guidance for the next attempt.`;

    const response = await this.processMessage(prompt);

    this.updateTaskStatus(task.id, 'pending', result);

    return {
      action: 'retry',
      feedback: response,
    };
  }

  /**
   * Track a task
   */
  trackTask(task: Task): void {
    this.activeTasks.set(task.id, task);
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: TaskStatus, result?: TaskResult): void {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date();
      if (result) {
        task.result = result;
      }
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): Task[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get the workspace path
   */
  getWorkspace(): string {
    return this.workspace;
  }

  /**
   * Get max retries setting
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }
}
