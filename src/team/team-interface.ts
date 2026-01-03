/**
 * Team Interface
 *
 * Abstract interface for team coordination.
 * Allows CEO and other components to work with different team types
 * (TechTeam, OpsTeam, etc.) without knowing implementation details.
 *
 * Part of Phase 6a: Coordination Layer Refactoring
 */

import { Task, TaskResult } from '../core/tasks/types.js';
import { TaskBreakdown } from '../agents/pm/pm-agent.js';

/**
 * Priority levels for task execution
 */
export type Priority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Result of a team workflow execution
 */
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

/**
 * ITeam Interface
 *
 * Abstract interface that all team implementations must follow.
 * This allows CEO to work with any team type without coupling to concrete implementations.
 *
 * @example
 * ```typescript
 * // CEO works with ITeam, not concrete Team
 * const team: ITeam = TeamFactory.create('tech', config);
 * const result = await team.executeTask('Build user auth', 'high');
 * ```
 */
export interface ITeam {
  /**
   * Execute a high-level task through the team workflow.
   *
   * The team coordinates its agents (PM, Dev, QA, etc.) to complete the task.
   * Includes iteration loops, escalation, and progress tracking.
   *
   * @param description - High-level task description
   * @param priority - Task priority level
   * @returns Result of the workflow execution
   */
  executeTask(description: string, priority?: Priority): Promise<WorkflowResult>;

  /**
   * Get the roles of agents in this team.
   *
   * @returns Array of role identifiers (e.g., ['pm', 'dev', 'qa'])
   */
  getAgentRoles(): string[];

  /**
   * Get the team name.
   *
   * @returns Team name (e.g., 'TechTeam', 'OpsTeam')
   */
  getName(): string;

  /**
   * Get the workspace path for this team.
   *
   * @returns Absolute path to workspace directory
   */
  getWorkspace(): string;
}

/**
 * Team callbacks for monitoring workflow progress
 */
export interface TeamCallbacks {
  /**
   * Called when a task escalates (exceeds retries, max iterations, etc.)
   */
  onEscalation?: (reason: string, task: Task) => void;

  /**
   * Called to report progress during workflow execution
   */
  onProgress?: (message: string, task?: Task) => void;
}
