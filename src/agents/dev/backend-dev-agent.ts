/**
 * Backend Developer Agent
 *
 * Specializes in backend development: Node.js, Express, APIs, databases.
 * Follows RESTful conventions and backend best practices.
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Task, TaskResult } from '../../core/tasks/types.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient } from '../../core/llm/client.js';

const BACKEND_DEV_SYSTEM_PROMPT = `You are a Backend Developer Agent specializing in Node.js and Express.

Your expertise:
- Node.js with TypeScript
- Express.js for REST APIs
- RESTful API design patterns
- Middleware and error handling
- Database integration (SQL, MongoDB)
- Authentication (JWT, sessions)
- Input validation and sanitization
- API documentation

When implementing backend tasks:
1. Create RESTful API endpoints
2. Use proper HTTP methods (GET, POST, PUT, DELETE)
3. Return appropriate status codes
4. Implement proper error handling middleware
5. Validate all input data
6. Use TypeScript interfaces for request/response types
7. Follow separation of concerns (routes, controllers, services)

File organization:
- src/routes/ - Express route definitions
- src/controllers/ - Request handlers
- src/services/ - Business logic
- src/models/ - Data models and types
- src/middleware/ - Express middleware
- src/utils/ - Utility functions
- src/config/ - Configuration files

API Response Format:
\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed"
}
\`\`\`

Error Response Format:
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
\`\`\`

Always:
- Use async/await for async operations
- Wrap async handlers in try/catch or use asyncHandler
- Log errors appropriately
- Return consistent response structures
- Never expose internal error details to clients`;

export interface BackendDevAgentConfig {
  name?: string;
  llmClient: LLMClient;
  tools: Tool[];
  workspace: string;
}

export class BackendDevAgent extends Agent {
  private workspace: string;

  constructor(config: BackendDevAgentConfig) {
    const agentConfig: AgentConfig = {
      name: config.name ?? 'BackendDevAgent',
      role: 'Backend Developer',
      systemPrompt: BACKEND_DEV_SYSTEM_PROMPT,
      llmClient: config.llmClient,
      tools: config.tools,
    };
    super(agentConfig);
    this.workspace = config.workspace;
  }

  /**
   * Execute a backend development task
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
   * Build a backend-specific task prompt
   */
  private buildTaskPrompt(task: Task): string {
    let prompt = `## Backend Task: ${task.title}\n\n`;
    prompt += `**Type**: ${task.type}\n`;
    prompt += `**Priority**: ${task.priority}\n\n`;
    prompt += `**Description**:\n${task.description}\n\n`;

    if (task.context) {
      prompt += `**Additional Context**:\n${JSON.stringify(task.context, null, 2)}\n\n`;

      // If there's an API contract, include it
      if (task.context.apiContract) {
        prompt += `**API Contract to implement**:\n`;
        prompt += `\`\`\`typescript\n`;
        const contracts = Array.isArray(task.context.apiContract)
          ? task.context.apiContract
          : [task.context.apiContract];
        for (const contract of contracts) {
          prompt += `// ${contract.method} ${contract.path}\n`;
          prompt += `// ${contract.description}\n`;
          if (contract.requestType) {
            prompt += `// Request: ${contract.requestType}\n`;
          }
          prompt += `// Response: ${contract.responseType}\n\n`;
        }
        prompt += `\`\`\`\n\n`;
      }

      // If there are data models, include them
      if (task.context.dataModels) {
        prompt += `**Data Models**:\n`;
        prompt += `\`\`\`typescript\n${task.context.dataModels}\n\`\`\`\n\n`;
      }
    }

    prompt += `**Workspace**: ${this.workspace}\n\n`;
    prompt += `Please implement this backend task. Create Express routes and handlers, `;
    prompt += `implement proper error handling, and follow RESTful conventions.\n\n`;
    prompt += `Remember to:\n`;
    prompt += `- Use proper HTTP methods and status codes\n`;
    prompt += `- Validate input data\n`;
    prompt += `- Handle errors gracefully\n`;
    prompt += `- Return consistent response structures`;

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
      'created route',
      'created endpoint',
      'implemented',
      'completed',
      'wrote',
      'created',
      'updated',
      'successfully',
      'express',
      'router',
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

    // Look for backend file patterns
    const filePatterns = [
      /wrote\s+to\s+['"]?([^'">\n]+\.ts)['"]?/gi,
      /created\s+['"]?([^\s'">\n]+\.ts)['"]?/gi,
      /wrote\s+to\s+['"]?([^'">\n]+\.js)['"]?/gi,
      /created\s+['"]?([^\s'">\n]+\.js)['"]?/gi,
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
