/**
 * Task System Types
 *
 * Defines the interface for tasks that flow between agents.
 * Tasks represent units of work that can be assigned, tracked, and completed.
 */

/**
 * Task status lifecycle:
 * pending -> in_progress -> completed | failed
 *                       -> blocked (can return to in_progress)
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task types that agents can work on
 */
export type TaskType = 'implement' | 'test' | 'fix' | 'review' | 'plan';

/**
 * Result of a task execution
 */
export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  filesModified?: string[];
  testsRun?: number;
  testsPassed?: number;
}

/**
 * Core task interface
 */
export interface Task {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  parentTaskId?: string;
  subtasks?: string[];
  attempts: number;
  maxAttempts: number;
  result?: TaskResult;
  context?: Record<string, unknown>;
}

/**
 * Create a new task with sensible defaults
 */
export function createTask(params: {
  type: TaskType;
  title: string;
  description: string;
  createdBy: string;
  priority?: TaskPriority;
  parentTaskId?: string;
  context?: Record<string, unknown>;
  maxAttempts?: number;
}): Task {
  const now = new Date();
  return {
    id: generateTaskId(),
    type: params.type,
    title: params.title,
    description: params.description,
    status: 'pending',
    priority: params.priority ?? 'medium',
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
    parentTaskId: params.parentTaskId,
    attempts: 0,
    maxAttempts: params.maxAttempts ?? 3,
    context: params.context,
  };
}

/**
 * Generate a unique task ID
 */
function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `task_${timestamp}_${random}`;
}

/**
 * Check if a task can be retried
 */
export function canRetry(task: Task): boolean {
  return task.attempts < task.maxAttempts && (task.status === 'failed' || task.status === 'blocked');
}

/**
 * Check if a task is terminal (cannot change status)
 */
export function isTerminal(task: Task): boolean {
  return task.status === 'completed' || (task.status === 'failed' && !canRetry(task));
}
