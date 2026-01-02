/**
 * Unit tests for Task Types
 */

import { describe, it, expect } from 'vitest';
import {
  createTask,
  canRetry,
  isTerminal,
  Task,
} from '../../src/core/tasks/types.js';

describe('Task Types', () => {
  describe('createTask', () => {
    it('should create a task with required fields', () => {
      const task = createTask({
        type: 'implement',
        title: 'Build feature X',
        description: 'Implement the feature X functionality',
        createdBy: 'PMAgent',
      });

      expect(task.id).toMatch(/^task_/);
      expect(task.type).toBe('implement');
      expect(task.title).toBe('Build feature X');
      expect(task.description).toBe('Implement the feature X functionality');
      expect(task.createdBy).toBe('PMAgent');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('medium');
      expect(task.attempts).toBe(0);
      expect(task.maxAttempts).toBe(3);
    });

    it('should create a task with optional fields', () => {
      const task = createTask({
        type: 'test',
        title: 'Test feature X',
        description: 'Write tests for feature X',
        createdBy: 'PMAgent',
        priority: 'high',
        parentTaskId: 'parent_123',
        context: { targetFile: 'src/feature.ts' },
        maxAttempts: 5,
      });

      expect(task.priority).toBe('high');
      expect(task.parentTaskId).toBe('parent_123');
      expect(task.context).toEqual({ targetFile: 'src/feature.ts' });
      expect(task.maxAttempts).toBe(5);
    });

    it('should generate unique task IDs', () => {
      const task1 = createTask({
        type: 'implement',
        title: 'Task 1',
        description: 'Description 1',
        createdBy: 'Agent',
      });

      const task2 = createTask({
        type: 'implement',
        title: 'Task 2',
        description: 'Description 2',
        createdBy: 'Agent',
      });

      expect(task1.id).not.toBe(task2.id);
    });

    it('should set createdAt and updatedAt to current time', () => {
      const before = new Date();
      const task = createTask({
        type: 'fix',
        title: 'Fix bug',
        description: 'Fix the bug',
        createdBy: 'Agent',
      });
      const after = new Date();

      expect(task.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(task.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(task.updatedAt.getTime()).toEqual(task.createdAt.getTime());
    });
  });

  describe('canRetry', () => {
    it('should return true for failed task with attempts remaining', () => {
      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Test',
        description: 'Test',
        status: 'failed',
        priority: 'medium',
        createdBy: 'Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 1,
        maxAttempts: 3,
      };

      expect(canRetry(task)).toBe(true);
    });

    it('should return true for blocked task with attempts remaining', () => {
      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Test',
        description: 'Test',
        status: 'blocked',
        priority: 'medium',
        createdBy: 'Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 2,
        maxAttempts: 3,
      };

      expect(canRetry(task)).toBe(true);
    });

    it('should return false when max attempts reached', () => {
      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Test',
        description: 'Test',
        status: 'failed',
        priority: 'medium',
        createdBy: 'Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 3,
        maxAttempts: 3,
      };

      expect(canRetry(task)).toBe(false);
    });

    it('should return false for pending tasks', () => {
      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Test',
        description: 'Test',
        status: 'pending',
        priority: 'medium',
        createdBy: 'Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      };

      expect(canRetry(task)).toBe(false);
    });

    it('should return false for completed tasks', () => {
      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Test',
        description: 'Test',
        status: 'completed',
        priority: 'medium',
        createdBy: 'Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 1,
        maxAttempts: 3,
      };

      expect(canRetry(task)).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it('should return true for completed tasks', () => {
      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Test',
        description: 'Test',
        status: 'completed',
        priority: 'medium',
        createdBy: 'Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 1,
        maxAttempts: 3,
      };

      expect(isTerminal(task)).toBe(true);
    });

    it('should return true for failed tasks with no retries left', () => {
      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Test',
        description: 'Test',
        status: 'failed',
        priority: 'medium',
        createdBy: 'Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 3,
        maxAttempts: 3,
      };

      expect(isTerminal(task)).toBe(true);
    });

    it('should return false for failed tasks with retries remaining', () => {
      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Test',
        description: 'Test',
        status: 'failed',
        priority: 'medium',
        createdBy: 'Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 1,
        maxAttempts: 3,
      };

      expect(isTerminal(task)).toBe(false);
    });

    it('should return false for pending tasks', () => {
      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Test',
        description: 'Test',
        status: 'pending',
        priority: 'medium',
        createdBy: 'Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      };

      expect(isTerminal(task)).toBe(false);
    });

    it('should return false for in_progress tasks', () => {
      const task: Task = {
        id: 'task_1',
        type: 'implement',
        title: 'Test',
        description: 'Test',
        status: 'in_progress',
        priority: 'medium',
        createdBy: 'Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 1,
        maxAttempts: 3,
      };

      expect(isTerminal(task)).toBe(false);
    });
  });
});
