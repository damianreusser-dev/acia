/**
 * Developer Agent
 *
 * Specializes in writing code, implementing features, and fixing bugs.
 * Uses file and execution tools to complete development tasks.
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Task, TaskResult } from '../../core/tasks/types.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient, ChatOptions } from '../../core/llm/client.js';

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

/**
 * Result of tool call verification
 */
interface ToolCallVerification {
  sufficient: boolean;
  reason?: string;
  required?: string[];
}

export class DevAgent extends Agent {
  private workspace: string;

  /** Maximum number of retry attempts when insufficient tool calls are made */
  private static readonly MAX_TASK_RETRIES = 3;

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
   * Execute a development task with retry loop for insufficient tool calls.
   * Agents that describe what they would do instead of actually doing it
   * will be retried with stronger instructions.
   * Uses native function calling with tool forcing for scaffold tasks.
   */
  async executeTask(task: Task): Promise<TaskResult> {
    let lastResponse = '';
    let lastVerification: ToolCallVerification = { sufficient: true };

    // Determine if we should force a specific tool (for scaffold tasks)
    const isScaffold = this.isScaffoldTask(task);

    for (let attempt = 1; attempt <= DevAgent.MAX_TASK_RETRIES; attempt++) {
      // Reset metrics for each attempt to measure tool calls
      this.resetToolCallMetrics();

      // Build prompt (with retry context if not first attempt)
      const retryContext = attempt > 1
        ? { attemptNumber: attempt, previousReason: lastVerification.reason }
        : undefined;
      const prompt = this.buildTaskPrompt(task, retryContext);

      // Build chat options - force generate_project for scaffold tasks on first attempt
      const options: ChatOptions | undefined = (isScaffold && attempt === 1)
        ? { toolChoice: { name: 'generate_project' } }
        : undefined;

      try {
        const response = await this.processMessageWithTools(prompt, undefined, options);
        lastResponse = response;

        // Verify sufficient tool calls were made
        const verification = this.verifyToolCalls(task);
        lastVerification = verification;

        if (verification.sufficient) {
          // Enough work done - check for overall success
          const success = this.analyzeResponse(response);
          return {
            success,
            output: response,
            filesModified: this.extractModifiedFiles(response),
          };
        }

        // Not enough work - log and retry
        if (attempt < DevAgent.MAX_TASK_RETRIES) {
          console.log(
            `[DevAgent] Attempt ${attempt}/${DevAgent.MAX_TASK_RETRIES} insufficient: ${verification.reason}. Retrying...`
          );
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }

    // Max retries reached without sufficient tool calls
    return {
      success: false,
      error: `Task incomplete after ${DevAgent.MAX_TASK_RETRIES} attempts: ${lastVerification.reason}`,
      output: lastResponse,
    };
  }

  /**
   * Build a prompt for the task
   */
  private buildTaskPrompt(
    task: Task,
    retryContext?: { attemptNumber: number; previousReason?: string }
  ): string {
    let prompt = '';

    // Add retry warning if this is a retry attempt
    if (retryContext) {
      prompt += `## ⚠️ RETRY ATTEMPT ${retryContext.attemptNumber}/${DevAgent.MAX_TASK_RETRIES}\n\n`;
      prompt += `Your previous attempt FAILED because:\n`;
      prompt += `> ${retryContext.previousReason}\n\n`;
      prompt += `**YOU MUST EXECUTE TOOL CALLS THIS TIME.**\n`;
      prompt += `Describing what you would do is NOT acceptable. You must CALL THE TOOLS.\n`;
      prompt += `If you do not call tools, this task will FAIL PERMANENTLY.\n\n`;
      prompt += `---\n\n`;
    }

    prompt += `## Task: ${task.title}\n\n`;
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
      prompt += `## CUSTOMIZE TASK - TOOL CALLS MANDATORY\n\n`;
      prompt += `The project structure already exists. You MUST modify files using write_file.\n\n`;

      prompt += `### REQUIRED WORKFLOW:\n`;
      prompt += `1. **READ** existing file first:\n`;
      prompt += `   \`\`\`\n   <tool_call>{"tool": "read_file", "params": {"path": "project/src/file.ts"}}</tool_call>\n   \`\`\`\n\n`;
      prompt += `2. **WRITE** your changes:\n`;
      prompt += `   \`\`\`\n   <tool_call>{"tool": "write_file", "params": {"path": "...", "content": "..."}}</tool_call>\n   \`\`\`\n\n`;

      // Add context-specific instructions based on agent type
      const agentType = task.context?.agentType;
      if (agentType === 'backend') {
        prompt += `### BACKEND CHECKLIST:\n`;
        prompt += `- [ ] Create route file in src/routes/ (write_file)\n`;
        prompt += `- [ ] UPDATE app.ts to import and register the route (write_file)\n`;
        prompt += `Both files require write_file calls! The route won't work unless app.ts is updated.\n\n`;
      } else if (agentType === 'frontend') {
        prompt += `### FRONTEND CHECKLIST:\n`;
        prompt += `- [ ] Create component files in src/components/ (write_file)\n`;
        prompt += `- [ ] Create hooks in src/hooks/ if needed (write_file)\n`;
        prompt += `- [ ] UPDATE App.tsx to import and use components (write_file)\n`;
        prompt += `All require write_file calls! App.tsx MUST be updated or components won't render.\n\n`;
      }

      prompt += `**CRITICAL**: If you only describe what to do, the task will FAIL and retry.\n`;
      prompt += `**CRITICAL**: EVERY implementation requires at least one write_file call.\n\n`;
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
   * Verify that sufficient tool calls were made for the task type.
   * Returns whether the work is sufficient and why if not.
   */
  private verifyToolCalls(task: Task): ToolCallVerification {
    const metrics = this.getToolCallMetrics();

    // Scaffold tasks: MUST call generate_project
    if (this.isScaffoldTask(task)) {
      const genCalls = metrics.byTool.get('generate_project') ?? 0;
      if (genCalls === 0) {
        return {
          sufficient: false,
          reason: 'Scaffold task requires generate_project tool call. You described what to do instead of doing it.',
          required: ['generate_project'],
        };
      }
      return { sufficient: true };
    }

    // Customize tasks: MUST call write_file
    if (this.isCustomizeTask(task)) {
      const writeCalls = metrics.byTool.get('write_file') ?? 0;
      if (writeCalls === 0) {
        return {
          sufficient: false,
          reason: 'Customize task requires at least one write_file call. You described changes instead of making them.',
          required: ['write_file'],
        };
      }
      return { sufficient: true };
    }

    // General tasks: at least one tool call expected
    if (metrics.total === 0) {
      return {
        sufficient: false,
        reason: 'No tool calls were made. You must use tools to complete the task, not just describe what you would do.',
      };
    }

    return { sufficient: true };
  }

  /**
   * Analyze response to determine if task was successful.
   * Primary signal: Tool call metrics - if tools were successfully called, that's success.
   * Secondary signal: Text analysis for cases without tool tracking.
   */
  private analyzeResponse(response: string): boolean {
    const lowerResponse = response.toLowerCase();
    const metrics = this.getToolCallMetrics();

    // PRIORITY 1: Trust tool call metrics
    // If tools were successfully called, that's strong evidence of success
    // Only override with hard failures (actual errors, not soft language)
    if (metrics.successful > 0) {
      const hardFailures = [
        'error:',
        'exception:',
        'failed to write',
        'permission denied',
        'enoent',           // File not found errors
        'eacces',           // Permission errors
        'syntax error',
        'compilation failed',
      ];
      const hasHardFailure = hardFailures.some(f => lowerResponse.includes(f));
      if (!hasHardFailure) {
        return true;  // Tools worked, no hard failure = success
      }
    }

    // PRIORITY 2: Soft failure indicators (only if no successful tool calls)
    const softFailureIndicators = [
      'failed to',
      'could not',
      'unable to',
      'cannot complete',
      'blocked by',
    ];

    for (const indicator of softFailureIndicators) {
      if (lowerResponse.includes(indicator)) {
        return false;
      }
    }

    // PRIORITY 3: Check for evidence of actual work done (text-based detection)
    // Used when tool metrics aren't available or tools weren't tracked
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
