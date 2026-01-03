/**
 * Scaffold Detector Unit Tests
 *
 * Tests for the scaffold detection utility.
 * Part of Phase 6a: Coordination Layer Refactoring.
 */

import { describe, it, expect } from 'vitest';
import {
  isScaffoldTask,
  isCustomizeTask,
  isNewProjectTask,
  extractProjectName,
  detectTemplateType,
  analyzeTaskType,
} from '../../src/utils/scaffold-detector.js';
import { createTask, Task } from '../../src/core/tasks/types.js';

// Helper to create tasks for testing
function makeTask(title: string, description: string): Task {
  return createTask({
    type: 'implement',
    title,
    description,
    createdBy: 'test',
  });
}

describe('isScaffoldTask', () => {
  it('should detect scaffold keyword', () => {
    const task = makeTask('Scaffold Project', 'Scaffold a new fullstack application');
    expect(isScaffoldTask(task)).toBe(true);
  });

  it('should detect generate_project keyword', () => {
    const task = makeTask('Setup Project', 'Use generate_project tool to create structure');
    expect(isScaffoldTask(task)).toBe(true);
  });

  it('should detect template= keyword', () => {
    const task = makeTask('Create App', 'Create app with template=fullstack');
    expect(isScaffoldTask(task)).toBe(true);
  });

  it('should detect fullstack keyword', () => {
    const task = makeTask('Build App', 'Build a fullstack todo application');
    expect(isScaffoldTask(task)).toBe(true);
  });

  it('should detect "do not write files manually"', () => {
    const task = makeTask('Create', 'Create project. Do not write files manually.');
    expect(isScaffoldTask(task)).toBe(true);
  });

  it('should return false for customize tasks', () => {
    const task = makeTask('Add Route', 'Add a new API endpoint to existing project');
    expect(isScaffoldTask(task)).toBe(false);
  });

  it('should return false for general tasks', () => {
    const task = makeTask('Fix Bug', 'Fix the login validation issue');
    expect(isScaffoldTask(task)).toBe(false);
  });
});

describe('isCustomizeTask', () => {
  it('should detect customize keyword', () => {
    const task = makeTask('Customize App', 'Customize the existing application');
    expect(isCustomizeTask(task)).toBe(true);
  });

  it('should detect "add route" pattern', () => {
    const task = makeTask('Add Users Route', 'Add users route to the API');
    expect(isCustomizeTask(task)).toBe(true);
  });

  it('should detect "add endpoint" pattern', () => {
    const task = makeTask('Add Endpoint', 'Add items endpoint to backend');
    expect(isCustomizeTask(task)).toBe(true);
  });

  it('should detect "create component" pattern', () => {
    const task = makeTask('Create Component', 'Create TodoList component');
    expect(isCustomizeTask(task)).toBe(true);
  });

  it('should detect "working directory:" pattern', () => {
    const task = makeTask('Modify Files', 'working directory: /app/backend');
    expect(isCustomizeTask(task)).toBe(true);
  });

  it('should detect "update src/" pattern', () => {
    const task = makeTask('Update Code', 'Update src/routes/users.ts');
    expect(isCustomizeTask(task)).toBe(true);
  });

  it('should detect "existing project" pattern', () => {
    const task = makeTask('Extend', 'Extend the existing project with new features');
    expect(isCustomizeTask(task)).toBe(true);
  });

  it('should return false for scaffold tasks', () => {
    const task = makeTask('Scaffold', 'Scaffold a new fullstack application');
    expect(isCustomizeTask(task)).toBe(false);
  });

  it('should return false for general tasks', () => {
    const task = makeTask('Fix Bug', 'Fix the login validation issue');
    expect(isCustomizeTask(task)).toBe(false);
  });
});

describe('isNewProjectTask', () => {
  it('should detect "new project" keyword', () => {
    const task = makeTask('Create', 'Create a new project for todo app');
    expect(isNewProjectTask(task)).toBe(true);
  });

  it('should detect "new application" keyword', () => {
    const task = makeTask('Build', 'Build a new application for task management');
    expect(isNewProjectTask(task)).toBe(true);
  });

  it('should detect "fullstack" keyword', () => {
    const task = makeTask('Create', 'Create fullstack todo application');
    expect(isNewProjectTask(task)).toBe(true);
  });

  it('should detect "todo application" keyword', () => {
    const task = makeTask('Build', 'Build todo application');
    expect(isNewProjectTask(task)).toBe(true);
  });

  it('should detect "web application" keyword', () => {
    const task = makeTask('Build', 'Build web application');
    expect(isNewProjectTask(task)).toBe(true);
  });

  it('should return false for modify tasks', () => {
    const task = makeTask('Modify', 'Modify the existing application');
    expect(isNewProjectTask(task)).toBe(false);
  });
});

describe('extractProjectName', () => {
  it('should extract projectName="name" format', () => {
    const task = makeTask('Create', 'Create with projectName="my-app"');
    expect(extractProjectName(task)).toBe('my-app');
  });

  it('should extract projectName: name format', () => {
    const task = makeTask('Create', 'Create with projectName: test-app');
    expect(extractProjectName(task)).toBe('test-app');
  });

  it('should extract "called name" format', () => {
    const task = makeTask('Create', 'Create project called "todo-app"');
    expect(extractProjectName(task)).toBe('todo-app');
  });

  it('should extract "named name" format', () => {
    const task = makeTask('Create', 'Create project named "awesome-app"');
    expect(extractProjectName(task)).toBe('awesome-app');
  });

  it('should extract "directory name" format', () => {
    const task = makeTask('Create', 'Create in directory "backend-api"');
    expect(extractProjectName(task)).toBe('backend-api');
  });

  it('should extract "folder name" format', () => {
    const task = makeTask('Create', 'Create in folder "frontend-ui"');
    expect(extractProjectName(task)).toBe('frontend-ui');
  });

  it('should return default name when no pattern matches', () => {
    const task = makeTask('Create', 'Create something');
    expect(extractProjectName(task)).toBe('my-project');
  });

  it('should accept custom default name', () => {
    const task = makeTask('Create', 'Create something');
    expect(extractProjectName(task, 'custom-default')).toBe('custom-default');
  });
});

describe('detectTemplateType', () => {
  it('should detect react template', () => {
    const task = makeTask('Create', 'Create react application');
    expect(detectTemplateType(task)).toBe('react');
  });

  it('should detect express template', () => {
    const task = makeTask('Create', 'Create express API server');
    expect(detectTemplateType(task)).toBe('express');
  });

  it('should detect fullstack (react + express)', () => {
    const task = makeTask('Create', 'Create fullstack with react and express');
    expect(detectTemplateType(task)).toBe('fullstack');
  });

  it('should default to fullstack for react + backend mention', () => {
    const task = makeTask('Create', 'Create react with backend');
    expect(detectTemplateType(task)).toBe('fullstack');
  });

  it('should default to fullstack for express + frontend mention', () => {
    const task = makeTask('Create', 'Create express with frontend');
    expect(detectTemplateType(task)).toBe('fullstack');
  });

  it('should return default when no keywords match', () => {
    const task = makeTask('Create', 'Create something');
    expect(detectTemplateType(task)).toBe('fullstack');
  });

  it('should accept custom default template', () => {
    const task = makeTask('Create', 'Create something');
    expect(detectTemplateType(task, 'custom')).toBe('custom');
  });
});

describe('analyzeTaskType', () => {
  it('should return comprehensive info for scaffold task', () => {
    const task = makeTask('Scaffold', 'Scaffold fullstack project called "todo-app"');
    const info = analyzeTaskType(task);

    expect(info.isScaffold).toBe(true);
    expect(info.isNewProject).toBe(true);
    expect(info.projectName).toBe('todo-app');
    expect(info.templateType).toBe('fullstack');
  });

  it('should return comprehensive info for customize task', () => {
    const task = makeTask('Add Route', 'Add users route to existing API');
    const info = analyzeTaskType(task);

    expect(info.isScaffold).toBe(false);
    expect(info.isCustomize).toBe(true);
    expect(info.isNewProject).toBe(false);
    expect(info.projectName).toBeUndefined();
    expect(info.templateType).toBeUndefined();
  });

  it('should return comprehensive info for new project task', () => {
    const task = makeTask('Build', 'Build a new application with react in directory "my-app"');
    const info = analyzeTaskType(task);

    expect(info.isNewProject).toBe(true);
    expect(info.projectName).toBe('my-app');
    expect(info.templateType).toBe('react');
  });

  it('should return minimal info for general task', () => {
    const task = makeTask('Fix Bug', 'Fix the login validation');
    const info = analyzeTaskType(task);

    expect(info.isScaffold).toBe(false);
    expect(info.isCustomize).toBe(false);
    expect(info.isNewProject).toBe(false);
    expect(info.projectName).toBeUndefined();
    expect(info.templateType).toBeUndefined();
  });
});
