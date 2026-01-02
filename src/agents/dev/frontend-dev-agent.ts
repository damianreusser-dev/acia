/**
 * Frontend Developer Agent
 *
 * Specializes in frontend development: React, TypeScript, HTML/CSS, UI components.
 * Follows modern frontend best practices and patterns.
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Task, TaskResult } from '../../core/tasks/types.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient } from '../../core/llm/client.js';

const FRONTEND_DEV_SYSTEM_PROMPT = `You are a Frontend Developer Agent specializing in React and TypeScript.

Your expertise:
- React 18+ with hooks and functional components
- TypeScript with strict typing
- CSS/SCSS, Tailwind CSS, styled-components
- State management (useState, useContext, Redux if needed)
- API integration with fetch/axios
- Modern build tools (Vite, webpack)
- Component architecture and reusability

When implementing frontend tasks:
1. Create clean, typed React components
2. Use functional components with hooks
3. Follow React naming conventions (PascalCase for components)
4. Keep components focused and single-purpose
5. Use proper TypeScript interfaces for props
6. Handle loading, error, and empty states
7. Make components accessible (aria labels, semantic HTML)

File organization:
- src/components/ - Reusable UI components
- src/pages/ - Page-level components
- src/hooks/ - Custom React hooks
- src/types/ - TypeScript type definitions
- src/api/ - API client functions
- src/styles/ - Global styles and themes

Always:
- Export components as named exports
- Include TypeScript interfaces for props
- Handle edge cases (loading, errors, empty data)
- Keep components under 200 lines
- Use meaningful variable and function names

For new projects, use the generate_project tool with template "react" to scaffold a complete React+TypeScript project with Vite.`;

export interface FrontendDevAgentConfig {
  name?: string;
  llmClient: LLMClient;
  tools: Tool[];
  workspace: string;
}

export class FrontendDevAgent extends Agent {
  private workspace: string;

  constructor(config: FrontendDevAgentConfig) {
    const agentConfig: AgentConfig = {
      name: config.name ?? 'FrontendDevAgent',
      role: 'Frontend Developer',
      systemPrompt: FRONTEND_DEV_SYSTEM_PROMPT,
      llmClient: config.llmClient,
      tools: config.tools,
    };
    super(agentConfig);
    this.workspace = config.workspace;
  }

  /**
   * Execute a frontend development task
   */
  async executeTask(task: Task): Promise<TaskResult> {
    const prompt = this.buildTaskPrompt(task);

    try {
      const response = await this.processMessageWithTools(prompt);
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
   * Build a frontend-specific task prompt
   */
  private buildTaskPrompt(task: Task): string {
    let prompt = `## Frontend Task: ${task.title}\n\n`;
    prompt += `**Type**: ${task.type}\n`;
    prompt += `**Priority**: ${task.priority}\n\n`;
    prompt += `**Description**:\n${task.description}\n\n`;

    if (task.context) {
      prompt += `**Additional Context**:\n${JSON.stringify(task.context, null, 2)}\n\n`;

      // If there's an API contract, include it
      if (task.context.apiContract) {
        prompt += `**API Contract to integrate with**:\n`;
        prompt += `\`\`\`typescript\n${JSON.stringify(task.context.apiContract, null, 2)}\n\`\`\`\n\n`;
      }
    }

    prompt += `**Workspace**: ${this.workspace}\n\n`;
    prompt += `Please implement this frontend task. Create React components with TypeScript, `;
    prompt += `handle state management appropriately, and ensure proper error handling.\n\n`;
    prompt += `Remember to:\n`;
    prompt += `- Use functional components with hooks\n`;
    prompt += `- Define TypeScript interfaces for all props and state\n`;
    prompt += `- Handle loading and error states\n`;
    prompt += `- Follow React naming conventions`;

    return prompt;
  }

  /**
   * Analyze response to determine if task was successful
   */
  private analyzeResponse(response: string): boolean {
    const lowerResponse = response.toLowerCase();

    const failureIndicators = [
      'failed to',
      'could not',
      'unable to',
      'error:',
      'exception:',
      'cannot complete',
      'blocked by',
      'syntax error',
      'type error',
    ];

    for (const indicator of failureIndicators) {
      if (lowerResponse.includes(indicator)) {
        return false;
      }
    }

    const successIndicators = [
      'created component',
      'implemented',
      'completed',
      'wrote',
      'created',
      'updated',
      'successfully',
      '.tsx',
      '.jsx',
    ];

    for (const indicator of successIndicators) {
      if (lowerResponse.includes(indicator)) {
        return true;
      }
    }

    return true;
  }

  /**
   * Extract file paths that were modified from the response
   */
  private extractModifiedFiles(response: string): string[] {
    const files: string[] = [];

    // Look for frontend file extensions
    const filePatterns = [
      /wrote\s+to\s+['"]?([^'">\n]+\.tsx?)['"]?/gi,
      /created\s+['"]?([^\s'">\n]+\.tsx?)['"]?/gi,
      /wrote\s+to\s+['"]?([^'">\n]+\.css)['"]?/gi,
      /created\s+['"]?([^\s'">\n]+\.css)['"]?/gi,
    ];

    for (const pattern of filePatterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          files.push(match[1]);
        }
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
