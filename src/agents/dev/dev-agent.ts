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

When implementing a task:
1. First understand what needs to be built
2. Plan the implementation approach
3. Write the code using available tools
4. Verify the code is syntactically correct
5. Report completion with details of what was created

Available tools allow you to:
- Read files to understand existing code
- Write files to create or update code
- List directories to explore the project structure
- Run code to test your implementation
- Generate project scaffolds using templates (list_templates, generate_project, preview_template)

CRITICAL - For new project creation tasks:
- ALWAYS use generate_project tool FIRST before writing any code
- For fullstack apps: generate_project with template="fullstack", projectName="<name>"
- For React apps: generate_project with template="react", projectName="<name>"
- For Express/API: generate_project with template="express", projectName="<name>"
- The fullstack template creates frontend/ and backend/ subdirectories with all configs
- After scaffolding, customize the generated files for the specific requirements

If a task mentions "scaffold", "generate project", or "create project structure", call generate_project immediately.

Always respond with a clear summary of what you did or why you couldn't complete the task.`;

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
    if (isScaffoldTask) {
      prompt += `**CRITICAL INSTRUCTION**: This is a project scaffolding task.\n`;
      prompt += `You MUST use the generate_project tool as your FIRST action.\n`;
      prompt += `Example tool call:\n`;
      prompt += `<tool_call>\n`;
      prompt += `{"tool": "generate_project", "params": {"template": "fullstack", "projectName": "todo-app"}}\n`;
      prompt += `</tool_call>\n\n`;
      prompt += `Do NOT manually write package.json, tsconfig.json, or other config files.\n`;
      prompt += `The template will create frontend/ and backend/ directories with all necessary files.\n\n`;
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
   * Analyze response to determine if task was successful
   */
  private analyzeResponse(response: string): boolean {
    const lowerResponse = response.toLowerCase();

    // Look for failure indicators
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

    // Look for success indicators
    const successIndicators = [
      'completed',
      'created',
      'implemented',
      'wrote',
      'updated',
      'successfully',
    ];

    for (const indicator of successIndicators) {
      if (lowerResponse.includes(indicator)) {
        return true;
      }
    }

    // Default to false - require explicit success indicators
    // This prevents marking tasks as "success" when nothing was done
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
