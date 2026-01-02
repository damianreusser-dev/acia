/**
 * Project Manager Agent
 *
 * Coordinates work between Dev and QA agents.
 * Breaks down tasks, assigns work, and handles escalations.
 * Creates design docs before planning (Design-First Development).
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Task, TaskResult, TaskStatus, createTask } from '../../core/tasks/types.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient } from '../../core/llm/client.js';
import { WikiService } from '../../core/wiki/wiki-service.js';

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
  wikiService?: WikiService; // Optional wiki for design docs
}

export interface DesignDoc {
  path: string; // Wiki path
  title: string;
  overview: string;
  requirements: string[];
  approach: string;
  acceptanceCriteria: string[];
}

export interface TaskBreakdown {
  devTasks: Task[];
  qaTasks: Task[];
  order: Array<{ agent: 'dev' | 'qa'; taskId: string }>;
  designDoc?: DesignDoc; // Reference to design doc if created
}

export class PMAgent extends Agent {
  private workspace: string;
  private maxRetries: number;
  private wikiService?: WikiService;
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
    this.wikiService = config.wikiService;
  }

  /**
   * Create a design document for a task before planning
   * Design-First Development: think before coding
   */
  async createDesignDoc(task: Task): Promise<DesignDoc | null> {
    if (!this.wikiService) {
      return null; // No wiki, skip design doc
    }

    const prompt = this.buildDesignPrompt(task);
    const response = await this.processMessageWithTools(prompt);

    // Parse the design doc from LLM response
    const designDoc = this.parseDesignDoc(response, task);

    // Write to wiki
    const wikiContent = this.formatDesignDocForWiki(designDoc);
    await this.wikiService.writePage(designDoc.path, {
      title: designDoc.title,
      content: wikiContent,
    });

    return designDoc;
  }

  /**
   * Build prompt for design doc creation
   */
  private buildDesignPrompt(task: Task): string {
    let prompt = `## Create Design Document for: ${task.title}\n\n`;
    prompt += `**Description**: ${task.description}\n`;
    prompt += `**Priority**: ${task.priority}\n\n`;

    if (task.context) {
      prompt += `**Additional Context**:\n${JSON.stringify(task.context, null, 2)}\n\n`;
    }

    prompt += `Before we implement this task, create a design document.\n`;
    prompt += `Think through what needs to be built, why, and how.\n\n`;
    prompt += `Please provide your analysis in this format:\n\n`;
    prompt += `OVERVIEW:\n[1-2 sentence summary of what we're building]\n\n`;
    prompt += `REQUIREMENTS:\n- Requirement 1\n- Requirement 2\n\n`;
    prompt += `APPROACH:\n[How we'll implement this - key decisions, patterns, components]\n\n`;
    prompt += `ACCEPTANCE_CRITERIA:\n- [ ] Criterion 1\n- [ ] Criterion 2\n`;

    return prompt;
  }

  /**
   * Parse design doc from LLM response
   */
  private parseDesignDoc(response: string, task: Task): DesignDoc {
    // Generate a safe filename from task title
    const safeTitle = task.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
    const timestamp = Date.now();
    const path = `designs/${safeTitle}-${timestamp}`;

    // Parse OVERVIEW section
    const overviewMatch = response.match(/OVERVIEW:?\s*([\s\S]*?)(?=REQUIREMENTS:|APPROACH:|ACCEPTANCE|$)/i);
    const overview = overviewMatch && overviewMatch[1] ? overviewMatch[1].trim() : task.description;

    // Parse REQUIREMENTS section
    const requirements: string[] = [];
    const reqMatch = response.match(/REQUIREMENTS:?\s*([\s\S]*?)(?=OVERVIEW:|APPROACH:|ACCEPTANCE|$)/i);
    if (reqMatch && reqMatch[1]) {
      const reqLines = reqMatch[1].match(/[-*]\s*(.+)/g);
      if (reqLines) {
        for (const line of reqLines) {
          const match = line.match(/[-*]\s*(.+)/);
          if (match && match[1]) {
            requirements.push(match[1].trim());
          }
        }
      }
    }

    // Parse APPROACH section
    const approachMatch = response.match(/APPROACH:?\s*([\s\S]*?)(?=OVERVIEW:|REQUIREMENTS:|ACCEPTANCE|$)/i);
    const approach = approachMatch && approachMatch[1] ? approachMatch[1].trim() : '';

    // Parse ACCEPTANCE_CRITERIA section
    const acceptanceCriteria: string[] = [];
    const acMatch = response.match(/ACCEPTANCE[_\s]?CRITERIA:?\s*([\s\S]*?)(?=OVERVIEW:|REQUIREMENTS:|APPROACH:|$)/i);
    if (acMatch && acMatch[1]) {
      const acLines = acMatch[1].match(/[-*[\]]\s*(.+)/g);
      if (acLines) {
        for (const line of acLines) {
          const match = line.match(/[-*[\]]\s*[?\s*]?\s*(.+)/);
          if (match && match[1]) {
            acceptanceCriteria.push(match[1].trim());
          }
        }
      }
    }

    return {
      path,
      title: `Design: ${task.title}`,
      overview,
      requirements: requirements.length > 0 ? requirements : [task.description],
      approach,
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : ['Implementation complete', 'All tests pass'],
    };
  }

  /**
   * Format design doc for wiki storage
   */
  private formatDesignDocForWiki(doc: DesignDoc): string {
    let content = `## Overview\n\n${doc.overview}\n\n`;
    content += `## Requirements\n\n`;
    for (const req of doc.requirements) {
      content += `- ${req}\n`;
    }
    content += `\n## Approach\n\n${doc.approach}\n\n`;
    content += `## Acceptance Criteria\n\n`;
    for (const criterion of doc.acceptanceCriteria) {
      content += `- [ ] ${criterion}\n`;
    }
    content += `\n---\n*Created by ${this.name} on ${new Date().toISOString()}*\n`;
    return content;
  }

  /**
   * Break down a high-level task into dev and QA subtasks
   * If wiki is available, creates design doc first
   */
  async planTask(task: Task): Promise<TaskBreakdown> {
    // Step 1: Create design doc if wiki is available
    let designDoc: DesignDoc | null = null;
    if (this.wikiService) {
      designDoc = await this.createDesignDoc(task);
    }

    // Step 2: Build planning prompt (with design doc reference if available)
    const prompt = this.buildPlanningPrompt(task, designDoc);

    const response = await this.processMessageWithTools(prompt);

    // Step 3: Parse the response to extract task breakdown
    const breakdown = this.parseTaskBreakdown(response, task);

    // Attach design doc reference
    if (designDoc) {
      breakdown.designDoc = designDoc;
    }

    return breakdown;
  }

  /**
   * Build a prompt for task planning
   * Includes design doc reference if available
   */
  private buildPlanningPrompt(task: Task, designDoc?: DesignDoc | null): string {
    let prompt = `## Plan Task: ${task.title}\n\n`;
    prompt += `**Type**: ${task.type}\n`;
    prompt += `**Priority**: ${task.priority}\n`;
    prompt += `**Description**:\n${task.description}\n\n`;

    if (task.context) {
      prompt += `**Context**:\n${JSON.stringify(task.context, null, 2)}\n\n`;
    }

    // Include design doc reference if available
    if (designDoc) {
      prompt += `## Design Document\n\n`;
      prompt += `A design document has been created at: ${designDoc.path}\n\n`;
      prompt += `**Overview**: ${designDoc.overview}\n\n`;
      prompt += `**Requirements**:\n`;
      for (const req of designDoc.requirements) {
        prompt += `- ${req}\n`;
      }
      prompt += `\n**Approach**:\n${designDoc.approach}\n\n`;
      prompt += `**Acceptance Criteria**:\n`;
      for (const criterion of designDoc.acceptanceCriteria) {
        prompt += `- ${criterion}\n`;
      }
      prompt += `\nPlease ensure your task breakdown aligns with this design.\n\n`;
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
