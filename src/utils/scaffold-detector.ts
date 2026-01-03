/**
 * Scaffold Detector Utility
 *
 * Shared utility for detecting scaffold and customize tasks.
 * Extracted from DevAgent and PMAgent for consistency across agents.
 *
 * Part of Phase 6a: Coordination Layer Refactoring
 */

import { Task } from '../core/tasks/types.js';

/**
 * Keywords that indicate a scaffold task
 */
const SCAFFOLD_KEYWORDS = [
  'scaffold',
  'generate_project',
  'template=',
  'create project structure',
  'fullstack',
  'do not write files manually',
] as const;

/**
 * Strong indicators of new project creation (standalone indicators)
 */
const NEW_PROJECT_KEYWORDS = [
  'new project',
  'new application',
  'new app',
  'fullstack',
  'full-stack',
  'full stack',
  'todo application',
  'todo app',
  'web application',
  'web app',
] as const;

/**
 * Keywords that indicate customization of existing project
 */
const CUSTOMIZE_EXACT_KEYWORDS = [
  'customize',
  'working directory:',
  'add/modify files',
  'modify files',
  'update src/',
  'create component',
  'add a new route',
  'add new route',
  'add endpoint',
  'existing project',
  'existing express',
  'existing react',
  'write_file tool',
  'use write_file',
] as const;

/**
 * Patterns for flexible customize task detection
 */
const CUSTOMIZE_PATTERNS = [
  /add\s+\w*\s*route/,        // "add users route", "add route", "add a route"
  /add\s+\w*\s*endpoint/,     // "add items endpoint", etc.
  /create\s+\w+\s+component/, // "create Todo component"
  /update\s+\S+\.tsx?/,       // "update app.ts", "update App.tsx"
  /modify\s+\S+\.tsx?/,       // "modify routes.ts"
] as const;

/**
 * Check if a task is for scaffolding a new project.
 * Used by both PM and Dev agents to determine if generate_project should be used.
 *
 * @param task - The task to analyze
 * @returns true if this is a scaffold task
 */
export function isScaffoldTask(task: Task): boolean {
  const text = `${task.title} ${task.description}`.toLowerCase();

  for (const keyword of SCAFFOLD_KEYWORDS) {
    if (text.includes(keyword)) {
      return true;
    }
  }

  // Also check if it's a new project task without customize keyword
  if (isNewProjectTask(task) && !text.includes('customize')) {
    return true;
  }

  return false;
}

/**
 * Check if a task is for customizing an existing project.
 * These tasks require write_file calls to modify existing files.
 *
 * @param task - The task to analyze
 * @returns true if this is a customize task
 */
export function isCustomizeTask(task: Task): boolean {
  const text = `${task.title} ${task.description}`.toLowerCase();

  // Check exact substring matches
  for (const keyword of CUSTOMIZE_EXACT_KEYWORDS) {
    if (text.includes(keyword)) {
      return true;
    }
  }

  // Check pattern matches - more flexible detection
  for (const pattern of CUSTOMIZE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a task is for creating a new project.
 * Used by PM to determine if design doc should be skipped.
 *
 * @param task - The task to analyze
 * @returns true if this is a new project creation task
 */
export function isNewProjectTask(task: Task): boolean {
  const text = `${task.title} ${task.description}`.toLowerCase();

  // Check strong project keywords
  for (const keyword of NEW_PROJECT_KEYWORDS) {
    if (text.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract project name from task description.
 * Tries multiple patterns to find the project name.
 *
 * @param task - The task to extract project name from
 * @param defaultName - Default name if none found (default: 'my-project')
 * @returns The extracted project name
 */
export function extractProjectName(task: Task, defaultName = 'my-project'): string {
  const patterns = [
    /projectName[=:]\s*["']?([a-zA-Z0-9_-]+)["']?/i,           // projectName="test-app"
    /called\s+["']([a-zA-Z0-9_-]+)["']/i,                      // called "test-app"
    /(?:named|name)\s+["']?([a-zA-Z0-9_-]+)["']?/i,            // named "test-app"
    /(?:in\s+(?:the\s+)?)?directory\s*["']?([a-zA-Z0-9_-]+)["']?/i, // directory "test-app"
    /(?:in\s+(?:the\s+)?)?folder\s*["']?([a-zA-Z0-9_-]+)["']?/i,    // folder "test-app"
    /["']([a-zA-Z0-9_-]+)["']\s*(?:directory|folder|project)/i,     // "test-app" directory
    /project\s+["']([a-zA-Z0-9_-]+)["']/i,                     // project "test-app"
  ];

  for (const pattern of patterns) {
    const match = task.description.match(pattern);
    if (match?.[1] && match[1] !== 'the') {
      return match[1];
    }
  }

  return defaultName;
}

/**
 * Determine the template type from task description.
 * Analyzes keywords to select appropriate template.
 *
 * @param task - The task to analyze
 * @param defaultTemplate - Default template if none detected (default: 'fullstack')
 * @returns Template name ('react', 'express', or 'fullstack')
 */
export function detectTemplateType(task: Task, defaultTemplate = 'fullstack'): string {
  const text = task.description.toLowerCase();

  if (text.includes('react') && !text.includes('express') && !text.includes('backend')) {
    return 'react';
  }

  if (text.includes('express') && !text.includes('react') && !text.includes('frontend')) {
    return 'express';
  }

  return defaultTemplate;
}

/**
 * Task type detection result
 */
export interface TaskTypeInfo {
  isScaffold: boolean;
  isCustomize: boolean;
  isNewProject: boolean;
  projectName?: string;
  templateType?: string;
}

/**
 * Analyze a task and return comprehensive type information.
 * Combines all detection logic into a single call.
 *
 * @param task - The task to analyze
 * @returns Complete task type information
 */
export function analyzeTaskType(task: Task): TaskTypeInfo {
  const isScaffold = isScaffoldTask(task);
  const isNew = isNewProjectTask(task);

  return {
    isScaffold,
    isCustomize: isCustomizeTask(task),
    isNewProject: isNew,
    projectName: isScaffold || isNew ? extractProjectName(task) : undefined,
    templateType: isScaffold || isNew ? detectTemplateType(task) : undefined,
  };
}
