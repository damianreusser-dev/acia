/**
 * Developer Agent
 *
 * Specializes in writing code, implementing features, and fixing bugs.
 * Uses file and execution tools to complete development tasks.
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Task, TaskResult } from '../../core/tasks/types.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient } from '../../core/llm/client.js';

const DEV_SYSTEM_PROMPT = `You are a Developer Agent in an autonomous software development team.

Your responsibilities:
1. Implement features based on task descriptions
2. Write clean, well-structured TypeScript code
3. Follow existing patterns in the codebase
4. Create or update files as needed
5. Report your progress clearly

CRITICAL REQUIREMENT - YOU MUST USE TOOLS:
- You MUST call tools (read_file, write_file, etc.) to complete tasks
- Describing what you would do is NOT enough - you must ACTUALLY do it
- Every implementation task requires at least one write_file call
- If you don't call any tools, the task WILL FAIL

When implementing a task:
1. Use read_file to understand existing code structure
2. Use write_file to create or modify files
3. Use read_file again to verify your changes
4. Report exactly which files you created or modified

Tool call format:
<tool_call>
{"tool": "write_file", "params": {"path": "path/to/file.ts", "content": "file content here"}}
</tool_call>

Available tools:
- read_file: Read files to understand existing code
- write_file: Create or update files (REQUIRED for implementation tasks)
- list_directory: Explore project structure
- run_code: Test your implementation
- generate_project: Scaffold from templates (list_templates, preview_template available too)

CRITICAL - For new project creation tasks:
- ALWAYS use generate_project tool FIRST before writing any code
- For fullstack apps: generate_project with template="fullstack", projectName="<name>"
- For React apps: generate_project with template="react", projectName="<name>"
- For Express/API: generate_project with template="express", projectName="<name>"
- The fullstack template creates frontend/ and backend/ subdirectories with all configs
- After scaffolding, customize the generated files for the specific requirements

For "Customize" tasks:
1. FIRST: Use read_file to see what the template created
2. THEN: Use write_file to add/modify files for the specific requirements
3. FINALLY: Report which files you created or modified

If a task mentions "scaffold", "generate project", or "create project structure", call generate_project immediately.

Always respond with a clear summary of what you ACTUALLY did (files created/modified) or why you couldn't complete the task.`;

export interface DevAgentConfig {
  name?: string;
  llmClient: LLMClient;
  tools: Tool[];
  workspace: string;
}

export class DevAgent extends Agent {
  private workspace: string;

  constructor(config: DevAgentConfig) {
    const agentConfig: AgentConfig = {
      name: config.name ?? 'DevAgent',
      role: 'Developer',
      systemPrompt: DEV_SYSTEM_PROMPT,
      llmClient: config.llmClient,
      tools: config.tools,
    };
    super(agentConfig);
    this.workspace = config.workspace;
  }

  /**
   * Execute a development task
   */
  async executeTask(task: Task): Promise<TaskResult> {
    const prompt = this.buildTaskPrompt(task);

    try {
      const response = await this.processMessageWithTools(prompt);

      // Analyze the response to determine success
      const success = this.analyzeResponse(response);

      return {
        success,
        output: response,
        filesModified: this.extractModifiedFiles(response),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Build a prompt for the task
   */
  private buildTaskPrompt(task: Task): string {
    let prompt = `## Task: ${task.title}\n\n`;
    prompt += `**Type**: ${task.type}\n`;
    prompt += `**Priority**: ${task.priority}\n\n`;
    prompt += `**Description**:\n${task.description}\n\n`;

    if (task.context) {
      prompt += `**Additional Context**:\n${JSON.stringify(task.context, null, 2)}\n\n`;
    }

    prompt += `**Workspace**: ${this.workspace}\n\n`;

    // Check if this is a scaffold task
    const isScaffoldTask = this.isScaffoldTask(task);
    const isCustomizeTask = this.isCustomizeTask(task);

    if (isScaffoldTask) {
      prompt += `**CRITICAL INSTRUCTION**: This is a project scaffolding task.\n`;
      prompt += `You MUST use the generate_project tool as your FIRST action.\n`;
      prompt += `Example tool call:\n`;
      prompt += `<tool_call>\n`;
      prompt += `{"tool": "generate_project", "params": {"template": "fullstack", "projectName": "todo-app"}}\n`;
      prompt += `</tool_call>\n\n`;
      prompt += `Do NOT manually write package.json, tsconfig.json, or other config files.\n`;
      prompt += `The template will create frontend/ and backend/ directories with all necessary files.\n\n`;
    } else if (isCustomizeTask) {
      prompt += `**CRITICAL INSTRUCTION**: This is a CUSTOMIZE task.\n`;
      prompt += `The project structure already exists. You MUST modify the existing files.\n\n`;
      prompt += `REQUIRED STEPS:\n`;
      prompt += `1. Use read_file to see the current file contents\n`;
      prompt += `2. Use write_file to REPLACE the file with your implementation\n`;
      prompt += `3. Each requirement needs a write_file call\n\n`;
      prompt += `EXAMPLE - To create a TodoList component:\n`;
      prompt += `<tool_call>\n`;
      prompt += `{"tool": "read_file", "params": {"path": "todo-app/frontend/src/App.tsx"}}\n`;
      prompt += `</tool_call>\n\n`;
      prompt += `Then after seeing the contents:\n`;
      prompt += `<tool_call>\n`;
      prompt += `{"tool": "write_file", "params": {"path": "todo-app/frontend/src/components/TodoList.tsx", "content": "import React..."}}\n`;
      prompt += `</tool_call>\n\n`;
      prompt += `YOU MUST CALL write_file - describing what you would do is NOT enough!\n\n`;
    }

    prompt += `Please implement this task. Use the available tools to read existing code, `;
    prompt += `write new code, and verify your implementation.`;

    return prompt;
  }

  /**
   * Check if a task is for scaffolding a new project
   */
  private isScaffoldTask(task: Task): boolean {
    const text = `${task.title} ${task.description}`.toLowerCase();
    const scaffoldKeywords = [
      'scaffold', 'generate_project', 'template=',
      'create project structure', 'fullstack',
      'do not write files manually',
    ];

    for (const keyword of scaffoldKeywords) {
      if (text.includes(keyword)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a task is for customizing an existing project
   */
  private isCustomizeTask(task: Task): boolean {
    const text = `${task.title} ${task.description}`.toLowerCase();

    // Exact substring matches
    const exactKeywords = [
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
    ];

    for (const keyword of exactKeywords) {
      if (text.includes(keyword)) {
        return true;
      }
    }

    // Pattern matches - more flexible
    const patterns = [
      /add\s+\w*\s*route/,      // "add users route", "add route", "add a route"
      /add\s+\w*\s*endpoint/,   // "add items endpoint", etc.
      /create\s+\w+\s+component/, // "create Todo component"
      /update\s+\S+\.tsx?/,     // "update app.ts", "update App.tsx"
      /modify\s+\S+\.tsx?/,     // "modify routes.ts"
    ];

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Analyze response to determine if task was successful
   * Requires BOTH success indicators AND evidence of actual work (tool calls or file modifications)
   */
  private analyzeResponse(response: string): boolean {
    const lowerResponse = response.toLowerCase();

    // Look for failure indicators first
    const failureIndicators = [
      'failed to',
      'could not',
      'unable to',
      'error:',
      'exception:',
      'cannot complete',
      'blocked by',
    ];

    for (const indicator of failureIndicators) {
      if (lowerResponse.includes(indicator)) {
        return false;
      }
    }

    // Check for evidence of actual work done (tool calls or their results)
    const toolUsageIndicators = [
      'tool_call',          // Tool call format
      'tool_result',        // Tool result format
      'wrote to',           // File write result
      'file created',       // File creation
      'file updated',       // File update
      'files created',      // Multiple files created (common LLM phrasing)
      'files written',      // Multiple files written (common LLM phrasing)
      'generated project',  // Template generation
      'scaffolded',         // Scaffold result
      'contents of',        // Showing file contents (implies file exists)
      'i created',          // First person file creation
      'i wrote',            // First person file writing
    ];

    const hasToolUsage = toolUsageIndicators.some(indicator =>
      lowerResponse.includes(indicator)
    );

    // Look for success indicators
    const successIndicators = [
      'completed',
      'created',
      'implemented',
      'wrote',
      'updated',
      'successfully',
    ];

    const hasSuccessIndicator = successIndicators.some(indicator =>
      lowerResponse.includes(indicator)
    );

    // Require BOTH success language AND evidence of actual tool usage
    // This prevents marking as success when agent just describes what it would do
    if (hasSuccessIndicator && hasToolUsage) {
      return true;
    }

    // If there's tool usage without explicit success language, that's also success
    // (tools were called, and no failure indicators)
    if (hasToolUsage) {
      return true;
    }

    // Default to false - require evidence of actual work
    return false;
  }

  /**
   * Extract file paths that were modified from the response
   */
  private extractModifiedFiles(response: string): string[] {
    const files: string[] = [];

    // Look for file paths in tool results
    const writeMatches = response.matchAll(/wrote\s+to\s+['"]?([^'">\n]+)['"]?/gi);
    for (const match of writeMatches) {
      if (match[1]) {
        files.push(match[1]);
      }
    }

    // Look for created file mentions
    const createdMatches = response.matchAll(/created\s+['"]?([^\s'">\n]+\.[a-z]+)['"]?/gi);
    for (const match of createdMatches) {
      if (match[1]) {
        files.push(match[1]);
      }
    }

    return [...new Set(files)];
  }

  /**
   * Get the workspace path
   */
  getWorkspace(): string {
    return this.workspace;
  }
}
