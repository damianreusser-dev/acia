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

IMPORTANT - Project scaffolding:
- For new fullstack/web application requests, the FIRST dev task should be to use generate_project tool with template="fullstack"
- For React-only projects, use template="react"
- For Express/backend-only projects, use template="express"
- This creates proper project structure with frontend/ and backend/ subdirectories

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
   * If wiki is available, creates design doc first (unless it's a scaffold task)
   */
  async planTask(task: Task): Promise<TaskBreakdown> {
    // OPTIMIZATION: For scaffold tasks, skip design doc and return fast breakdown
    if (this.isScaffoldTask(task)) {
      return this.createScaffoldBreakdown(task);
    }

    // Step 1: Create design doc if wiki is available (non-scaffold tasks)
    let designDoc: DesignDoc | null = null;
    if (this.wikiService) {
      designDoc = await this.createDesignDoc(task);
    }

    // Step 2: Build planning prompt (with design doc reference if available)
    const prompt = this.buildPlanningPrompt(task, designDoc);

    // Use reduced iterations for planning (max 3 instead of default 10)
    const response = await this.processMessageWithTools(prompt, 3);

    // Step 3: Parse the response to extract task breakdown
    const breakdown = this.parseTaskBreakdown(response, task);

    // Attach design doc reference
    if (designDoc) {
      breakdown.designDoc = designDoc;
    }

    return breakdown;
  }

  /**
   * Check if a task is a scaffold task that can be fast-tracked
   */
  private isScaffoldTask(task: Task): boolean {
    const text = `${task.title} ${task.description}`.toLowerCase();
    return (
      text.includes('scaffold') ||
      text.includes('generate_project') ||
      text.includes('template=') ||
      (this.isNewProjectTask(task) && !text.includes('customize'))
    );
  }

  /**
   * Create optimized breakdown for scaffold tasks (no design doc, no LLM call)
   */
  private createScaffoldBreakdown(task: Task): TaskBreakdown {
    // Extract project name from task using multiple patterns
    const patterns = [
      /projectName[=:]\s*["']?([a-zA-Z0-9_-]+)["']?/i,           // projectName="test-app"
      /called\s+["']([a-zA-Z0-9_-]+)["']/i,                      // called "test-app" or called 'test-app'
      /(?:named|name)\s+["']?([a-zA-Z0-9_-]+)["']?/i,            // named "test-app" or name "test-app"
      /(?:in\s+(?:the\s+)?)?directory\s*["']?([a-zA-Z0-9_-]+)["']?/i, // directory "test-app"
      /(?:in\s+(?:the\s+)?)?folder\s*["']?([a-zA-Z0-9_-]+)["']?/i,    // folder "test-app"
      /["']([a-zA-Z0-9_-]+)["']\s*(?:directory|folder|project)/i,     // "test-app" directory
      /project\s+["']([a-zA-Z0-9_-]+)["']/i,                     // project "test-app"
    ];

    let projectName = 'my-project';
    for (const pattern of patterns) {
      const match = task.description.match(pattern);
      if (match?.[1] && match[1] !== 'the') {
        projectName = match[1];
        break;
      }
    }

    // Determine template type
    let template = 'fullstack';
    const text = task.description.toLowerCase();
    if (text.includes('react') && !text.includes('express') && !text.includes('backend')) {
      template = 'react';
    } else if (text.includes('express') && !text.includes('react') && !text.includes('frontend')) {
      template = 'express';
    }

    // Create scaffold task
    const scaffoldTask = createTask({
      type: 'implement',
      title: 'Scaffold Project',
      description: `IMMEDIATELY call generate_project tool with template="${template}" and projectName="${projectName}". Do NOT write files manually.`,
      createdBy: this.name,
      priority: task.priority,
      parentTaskId: task.id,
      maxAttempts: 1, // Scaffold should work first time
    });

    // Create customize tasks based on requirements
    const devTasks: Task[] = [scaffoldTask];

    // Detect structured sections for separate tasks
    const hasBackend = /BACKEND[^:]*:/i.test(task.description);
    const hasFrontend = /FRONTEND[^:]*:/i.test(task.description);
    const hasRequirements = /REQUIREMENTS:/i.test(task.description) ||
      text.includes('with:') || text.includes('must have');

    // Create separate backend customize task
    if (hasBackend) {
      const backendDesc = this.extractSectionRequirements(task.description, 'BACKEND', projectName);
      if (backendDesc) {
        devTasks.push(createTask({
          type: 'implement',
          title: 'Customize Backend',
          description: backendDesc,
          createdBy: this.name,
          priority: task.priority,
          parentTaskId: task.id,
          maxAttempts: 3,
          context: { agentType: 'backend' },
        }));
      }
    }

    // Create separate frontend customize task
    if (hasFrontend) {
      const frontendDesc = this.extractSectionRequirements(task.description, 'FRONTEND', projectName);
      if (frontendDesc) {
        devTasks.push(createTask({
          type: 'implement',
          title: 'Customize Frontend',
          description: frontendDesc,
          createdBy: this.name,
          priority: task.priority,
          parentTaskId: task.id,
          maxAttempts: 3,
          context: { agentType: 'frontend' },
        }));
      }
    }

    // Create general requirements task if no structured sections but has requirements
    if (!hasBackend && !hasFrontend && hasRequirements) {
      // Detect agent type from task description for proper checklist prompting
      const detectedType = this.detectAgentType(task.description);
      const customizeDescription = this.buildCustomizeDescription(task.description, projectName);
      devTasks.push(createTask({
        type: 'implement',
        title: 'Customize for Requirements',
        description: customizeDescription,
        createdBy: this.name,
        priority: task.priority,
        parentTaskId: task.id,
        maxAttempts: 3,
        context: { agentType: detectedType },
      }));
    }

    // Add tests task if tests are mentioned
    if (text.includes('test') && (hasBackend || hasFrontend)) {
      devTasks.push(createTask({
        type: 'implement',
        title: 'Add Tests',
        description: `Add unit tests for the ${projectName} project as specified in the requirements.\n\n` +
          `Use read_file to check existing code, then write_file to create test files.\n` +
          `Backend tests should go in ${projectName}/backend/tests/\n` +
          `Frontend tests should go in ${projectName}/frontend/src/__tests__/`,
        createdBy: this.name,
        priority: task.priority,
        parentTaskId: task.id,
        maxAttempts: 2,
      }));
    }

    // For scaffold tasks, skip QA entirely - just generate structure
    return {
      devTasks,
      qaTasks: [],
      order: devTasks.map((t) => ({ agent: 'dev' as const, taskId: t.id })),
    };
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

    // Detect if this is a new project creation task
    const isNewProject = this.isNewProjectTask(task);
    if (isNewProject) {
      prompt += `**IMPORTANT**: This appears to be a new project creation task.\n`;
      prompt += `The FIRST dev task MUST use the generate_project tool to scaffold the project structure.\n`;
      prompt += `- For fullstack apps: generate_project with template="fullstack" and projectName="<name>"\n`;
      prompt += `- This creates frontend/ and backend/ subdirectories with proper configuration\n\n`;
    }

    prompt += `Please analyze this task and provide a breakdown in the following format:\n\n`;
    prompt += `DEV_TASKS:\n`;
    if (isNewProject) {
      // Extract project name from task description
      const projectNameMatch = task.description.match(/(?:in|directory|folder)\s+["']?([a-zA-Z0-9_-]+)["']?/i);
      const projectName = projectNameMatch?.[1] ?? 'my-project';
      prompt += `1. [Scaffold Project] - IMMEDIATELY call generate_project tool with template="fullstack" and projectName="${projectName}". Do NOT write files manually - the template creates everything.\n`;
      prompt += `2. [Customize for Requirements] - After scaffold, modify generated files to meet specific requirements\n\n`;
    } else {
      prompt += `1. [Title] - [Description]\n`;
      prompt += `2. [Title] - [Description]\n\n`;
    }
    prompt += `QA_TASKS:\n`;
    prompt += `1. [Title] - [Description]\n\n`;
    prompt += `EXECUTION_ORDER:\n`;
    prompt += `1. DEV:1\n`;
    prompt += `2. QA:1\n`;
    prompt += `3. DEV:2 (if QA finds issues)\n`;

    return prompt;
  }

  /**
   * Detect if a task is for creating a new project
   * Be specific to avoid triggering on simple file creation tasks
   */
  private isNewProjectTask(task: Task): boolean {
    const text = `${task.title} ${task.description}`.toLowerCase();

    // Strong indicators of new project creation (match alone)
    const strongProjectKeywords = [
      'new project', 'new application', 'new app',
      'fullstack', 'full-stack', 'full stack',
      'todo application', 'todo app',
      'web application', 'web app',
    ];

    for (const keyword of strongProjectKeywords) {
      if (text.includes(keyword)) {
        return true;
      }
    }

    // Check for action + project-type combination (e.g., "create a fullstack application")
    const actionKeywords = ['create', 'build', 'make', 'develop', 'implement'];
    const projectTypeKeywords = ['application', 'project', 'app'];

    const hasAction = actionKeywords.some(action => text.includes(action));
    const hasProjectType = projectTypeKeywords.some(type => text.includes(type));

    // Check for project directory references in description
    const hasDirectoryRef = /in\s+(?:the\s+)?(?:directory|folder)?\s*["']?[\w-]+["']?/i.test(task.description);

    // Require both action + project type, or directory ref + application
    if (hasAction && hasProjectType && hasDirectoryRef) {
      return true;
    }

    if (hasDirectoryRef && text.includes('application')) {
      return true;
    }

    return false;
  }

  /**
   * Build a structured, actionable customize task description
   * Extracts specific requirements from the original request
   */
  private buildCustomizeDescription(originalRequest: string, projectName: string): string {
    const lines: string[] = [];
    lines.push(`Customize the scaffolded "${projectName}" project to meet the following requirements:`);
    lines.push('');

    // Extract backend requirements
    const backendMatch = originalRequest.match(/BACKEND[^:]*:?\s*([\s\S]*?)(?=FRONTEND|REQUIREMENTS:|$)/i);
    if (backendMatch && backendMatch[1]) {
      lines.push('## BACKEND CHANGES (in backend/src/):');
      const backendReqs = backendMatch[1].trim().split(/\n/).filter(line => line.trim().startsWith('-'));
      for (const req of backendReqs) {
        lines.push(req.trim());
      }
      lines.push('');
      lines.push('Actions needed:');
      lines.push('1. Create routes/todos.ts with CRUD endpoints');
      lines.push('2. Create types/todo.ts with Todo interface');
      lines.push('3. Update app.ts to register todo routes at /api/todos');
      lines.push('4. Create tests/todos.test.ts with at least 3 tests');
      lines.push('');
    }

    // Extract frontend requirements
    const frontendMatch = originalRequest.match(/FRONTEND[^:]*:?\s*([\s\S]*?)(?=BACKEND|REQUIREMENTS:|$)/i);
    if (frontendMatch && frontendMatch[1]) {
      lines.push('## FRONTEND CHANGES (in frontend/src/):');
      const frontendReqs = frontendMatch[1].trim().split(/\n/).filter(line => line.trim().startsWith('-'));
      for (const req of frontendReqs) {
        lines.push(req.trim());
      }
      lines.push('');
      lines.push('Actions needed:');
      lines.push('1. Create components/TodoList.tsx');
      lines.push('2. Create components/TodoItem.tsx');
      lines.push('3. Create components/AddTodo.tsx');
      lines.push('4. Update App.tsx to use these components with useState and useEffect');
      lines.push('5. Add API fetch calls to connect to backend');
      lines.push('');
    }

    // Extract general requirements
    const requirementsMatch = originalRequest.match(/REQUIREMENTS:?\s*([\s\S]*?)$/i);
    if (requirementsMatch && requirementsMatch[1]) {
      lines.push('## ADDITIONAL REQUIREMENTS:');
      const reqs = requirementsMatch[1].trim().split(/\n/).filter(line => line.trim().startsWith('-'));
      for (const req of reqs) {
        lines.push(req.trim());
      }
      lines.push('');
    }

    // If no structured sections found, provide generic instructions
    if (lines.length <= 2) {
      lines.push('Review the original request and implement the required functionality:');
      lines.push(originalRequest);
      lines.push('');
      lines.push('Focus on:');
      lines.push('1. Adding the specific features mentioned');
      lines.push('2. Connecting frontend to backend API');
      lines.push('3. Adding any missing tests');
    }

    lines.push('');
    lines.push('IMPORTANT: Use read_file to check what the template created first, then write_file to modify specific files.');

    return lines.join('\n');
  }

  /**
   * Extract requirements for a specific section (BACKEND or FRONTEND)
   */
  private extractSectionRequirements(
    description: string,
    section: 'BACKEND' | 'FRONTEND',
    projectName: string
  ): string | null {
    // Match the section and extract its content
    const sectionRegex = new RegExp(
      `${section}[^:]*:\\s*([\\s\\S]*?)(?=FRONTEND|BACKEND|REQUIREMENTS:|$)`,
      'i'
    );
    const match = description.match(sectionRegex);

    if (!match || !match[1]) {
      return null;
    }

    const sectionContent = match[1].trim();
    const lines: string[] = [];

    if (section === 'BACKEND') {
      lines.push(`## Customize Backend for ${projectName}`);
      lines.push('');
      lines.push(`Project root: ${projectName}/backend/`);
      lines.push('');
      lines.push('Requirements:');
      lines.push(sectionContent);
      lines.push('');
      lines.push(`Steps (ALL paths must start with ${projectName}/backend/):`);
      lines.push(`1. Use read_file to check existing ${projectName}/backend/src/app.ts structure`);
      lines.push(`2. Create new route files in ${projectName}/backend/src/routes/ for each endpoint group`);
      lines.push(`3. Create type definitions in ${projectName}/backend/src/types/ if needed`);
      lines.push(`4. Update ${projectName}/backend/src/app.ts to import and register new routes`);
      lines.push(`5. Use read_file to verify changes`);
    } else {
      lines.push(`## Customize Frontend for ${projectName}`);
      lines.push('');
      lines.push(`Project root: ${projectName}/frontend/`);
      lines.push('');
      lines.push('Requirements:');
      lines.push(sectionContent);
      lines.push('');
      lines.push(`Steps (ALL paths must start with ${projectName}/frontend/):`);
      lines.push(`1. Use read_file to check existing ${projectName}/frontend/src/App.tsx structure`);
      lines.push(`2. Create component files in ${projectName}/frontend/src/components/ for each UI component`);
      lines.push(`3. Create hooks in ${projectName}/frontend/src/hooks/ if needed for state management`);
      lines.push(`4. Update ${projectName}/frontend/src/App.tsx to import and use new components`);
      lines.push(`5. Add API calls to connect to backend`);
    }

    lines.push('');
    lines.push('IMPORTANT: Use write_file to create/modify files. Do NOT just describe what to do.');

    return lines.join('\n');
  }

  /**
   * Detect agent type from task description based on keywords.
   * Used to provide proper checklist prompting in DevAgent.
   */
  private detectAgentType(description: string): 'backend' | 'frontend' | undefined {
    const lower = description.toLowerCase();
    const backendKeywords = ['route', 'endpoint', 'api', 'express', 'server', 'backend', 'database', 'middleware'];
    const frontendKeywords = ['component', 'react', 'frontend', 'ui', 'view', 'page', 'button', 'form', 'jsx', 'tsx'];

    const hasBackend = backendKeywords.some(k => lower.includes(k));
    const hasFrontend = frontendKeywords.some(k => lower.includes(k));

    if (hasBackend && !hasFrontend) return 'backend';
    if (hasFrontend && !hasBackend) return 'frontend';
    return undefined;
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

    // If no dev tasks parsed for a new project task, create scaffold task automatically
    if (devTasks.length === 0 && this.isNewProjectTask(parentTask)) {
      const projectNameMatch = parentTask.description.match(/(?:in|directory|folder)\s+["']?([a-zA-Z0-9_-]+)["']?/i);
      const projectName = projectNameMatch?.[1] ?? 'my-project';

      const scaffoldTask = createTask({
        type: 'implement',
        title: 'Scaffold Project',
        description: `IMMEDIATELY call generate_project tool with template="fullstack" and projectName="${projectName}". Do NOT write files manually - the template creates everything.`,
        createdBy: this.name,
        priority: parentTask.priority,
        parentTaskId: parentTask.id,
        maxAttempts: this.maxRetries,
      });
      devTasks.push(scaffoldTask);

      const customizeTask = createTask({
        type: 'implement',
        title: 'Customize for Requirements',
        description: `After scaffold is complete, modify the generated files in "${projectName}" to meet the specific requirements: ${parentTask.description}`,
        createdBy: this.name,
        priority: parentTask.priority,
        parentTaskId: parentTask.id,
        maxAttempts: this.maxRetries,
      });
      devTasks.push(customizeTask);
    }

    // If still no dev tasks (non-project task), fall back to single task
    if (devTasks.length === 0) {
      const fallbackTask = createTask({
        type: 'implement',
        title: parentTask.title,
        description: parentTask.description,
        createdBy: this.name,
        priority: parentTask.priority,
        parentTaskId: parentTask.id,
        maxAttempts: this.maxRetries,
      });
      devTasks.push(fallbackTask);
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
