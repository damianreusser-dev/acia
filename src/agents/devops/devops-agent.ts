/**
 * DevOps Agent
 *
 * Specializes in deployment, Docker, CI/CD, and infrastructure tasks.
 * Uses Docker and deployment tools to containerize and deploy applications.
 *
 * Part of Phase 6b: Deployment & Operations
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Task, TaskResult } from '../../core/tasks/types.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient, ChatOptions } from '../../core/llm/client.js';

const DEVOPS_SYSTEM_PROMPT = `You are a DevOps Agent. You containerize, deploy, and manage infrastructure by CALLING TOOLS, not by describing what to do.

## ABSOLUTE RULE: CALL TOOLS OR FAIL

Every task requires tool calls. There are NO exceptions.

WRONG (will FAIL):
- "I would create a Dockerfile with..."
- "Here's what the deployment config should look like..."
- "You can deploy by..."

CORRECT (will SUCCEED):
<tool_call>{"tool": "write_file", "params": {"path": "Dockerfile", "content": "..."}}</tool_call>

## Core Responsibilities

1. **Containerization**: Create Dockerfiles and docker-compose.yml
2. **Deployment**: Deploy to Railway, Vercel, or other platforms
3. **Monitoring**: Set up health checks and monitoring configs
4. **CI/CD**: Create pipeline configurations

## Required Workflow for Docker Tasks

Step 1: Analyze the application structure
<tool_call>{"tool": "list_directory", "params": {"path": "."}}</tool_call>

Step 2: Create Dockerfile
<tool_call>{"tool": "write_file", "params": {"path": "Dockerfile", "content": "FROM node:20-alpine..."}}</tool_call>

Step 3: Create docker-compose.yml (for multi-service apps)
<tool_call>{"tool": "write_file", "params": {"path": "docker-compose.yml", "content": "version: '3.8'..."}}</tool_call>

Step 4: Build and test (if Docker available)
<tool_call>{"tool": "docker_build", "params": {"context": ".", "tag": "app:latest"}}</tool_call>

## Tools Reference

| Tool | Use For | Required? |
|------|---------|-----------|
| write_file | Create Dockerfiles, configs | YES - every task |
| read_file | Understand app structure | YES - before writing |
| docker_build | Build Docker images | When Docker available |
| docker_run | Run containers | When Docker available |
| docker_compose_up | Start multi-service stack | For fullstack apps |
| deploy_to_railway | Deploy backend to Railway | When deploying backend |
| deploy_to_vercel | Deploy frontend to Vercel | When deploying frontend |

## Dockerfile Best Practices

1. Use multi-stage builds for smaller images
2. Use alpine variants when possible
3. Copy package*.json first for better layer caching
4. Run as non-root user in production
5. Always include a health check

## Docker Compose Best Practices

1. Define health checks for all services
2. Use environment variables for configuration
3. Set restart policies (on-failure or unless-stopped)
4. Define networks for service isolation
5. Use depends_on with condition: service_healthy

## Deployment Configuration

### Railway (Backend)
- Create railway.json with health check settings
- Ensure /health endpoint exists
- Set restart policy for resilience

### Vercel (Frontend)
- Create vercel.json with routing rules
- Configure API proxy for backend calls
- Set framework preset if applicable

## Output Format

After completing, report:
- Artifacts created: [Dockerfile, docker-compose.yml, etc.]
- Configuration files: [railway.json, vercel.json, etc.]
- Deployment status: [if deployed]
- Tool calls made: [count]

If you cannot complete the task, explain why and what's blocking you.`;

export interface DevOpsAgentConfig {
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

export class DevOpsAgent extends Agent {
  private workspace: string;

  /** Maximum number of retry attempts when insufficient tool calls are made */
  private static readonly MAX_TASK_RETRIES = 3;

  constructor(config: DevOpsAgentConfig) {
    const agentConfig: AgentConfig = {
      name: config.name ?? 'DevOpsAgent',
      role: 'DevOps Engineer',
      systemPrompt: DEVOPS_SYSTEM_PROMPT,
      llmClient: config.llmClient,
      tools: config.tools,
    };
    super(agentConfig);
    this.workspace = config.workspace;
  }

  /**
   * Execute a DevOps task with retry loop for insufficient tool calls.
   * Agents that describe what they would do instead of actually doing it
   * will be retried with stronger instructions.
   */
  async executeTask(task: Task): Promise<TaskResult> {
    console.log(`[${this.name}] === TASK START: ${task.title} ===`);
    let lastResponse = '';
    let lastVerification: ToolCallVerification = { sufficient: true };

    // Determine task type for tool forcing
    const isDockerTask = this.isDockerTask(task);
    const isDeployTask = this.isDeployTask(task);

    for (let attempt = 1; attempt <= DevOpsAgent.MAX_TASK_RETRIES; attempt++) {
      // Reset metrics for each attempt to measure tool calls
      this.resetToolCallMetrics();

      // Build prompt (with retry context if not first attempt)
      const retryContext = attempt > 1
        ? { attemptNumber: attempt, previousReason: lastVerification.reason }
        : undefined;
      const prompt = this.buildTaskPrompt(task, retryContext);

      // Chat options for tool forcing on first attempt
      let options: ChatOptions | undefined;
      if (attempt === 1) {
        if (isDockerTask && this.hasTool('write_file')) {
          // Docker tasks should write Dockerfile first
          options = { toolChoice: { name: 'write_file' } };
        } else if (isDeployTask && this.hasTool('deploy_to_railway')) {
          options = { toolChoice: { name: 'deploy_to_railway' } };
        }
      }

      try {
        // Use fewer iterations for deployment tasks
        const maxIter = isDockerTask ? 5 : 3;
        const response = await this.processMessageWithTools(prompt, maxIter, options);
        lastResponse = response;

        // Verify sufficient tool calls were made
        const verification = this.verifyToolCalls(task);
        lastVerification = verification;
        console.log(`[${this.name}] Verification: sufficient=${verification.sufficient}, reason=${verification.reason ?? 'none'}`);
        const m = this.getToolCallMetrics();
        console.log(`[${this.name}] Metrics: total=${m.total}, byTool=${JSON.stringify(Object.fromEntries(m.byTool))}`);

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
        if (attempt < DevOpsAgent.MAX_TASK_RETRIES) {
          console.log(
            `[DevOpsAgent] Attempt ${attempt}/${DevOpsAgent.MAX_TASK_RETRIES} insufficient: ${verification.reason}. Retrying...`
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
      error: `Task incomplete after ${DevOpsAgent.MAX_TASK_RETRIES} attempts: ${lastVerification.reason}`,
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
      prompt += `## ⚠️ RETRY ${retryContext.attemptNumber}/${DevOpsAgent.MAX_TASK_RETRIES} - LAST CHANCE\n\n`;
      prompt += `**FAILURE REASON**: ${retryContext.previousReason}\n\n`;
      prompt += `### WHAT YOU DID WRONG\n`;
      prompt += `You DESCRIBED what to do instead of DOING it.\n\n`;
      prompt += `### WHAT YOU MUST DO NOW\n`;
      prompt += `1. Output a <tool_call> block (not a description)\n`;
      prompt += `2. The tool_call must contain valid JSON\n`;
      prompt += `3. Use write_file to create Dockerfiles, configs, etc.\n\n`;
      prompt += `### CORRECT FORMAT\n`;
      prompt += `\`\`\`\n`;
      prompt += `<tool_call>\n`;
      prompt += `{"tool": "write_file", "params": {"path": "Dockerfile", "content": "FROM node:20-alpine..."}}\n`;
      prompt += `</tool_call>\n`;
      prompt += `\`\`\`\n\n`;
      prompt += `**WARNING**: This is attempt ${retryContext.attemptNumber} of ${DevOpsAgent.MAX_TASK_RETRIES}. `;
      prompt += `If you fail again, the task will be marked as FAILED permanently.\n\n`;
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

    // Add task-specific instructions
    if (this.isDockerTask(task)) {
      prompt += `## DOCKER TASK - TOOL CALLS MANDATORY\n\n`;
      prompt += `You MUST create Docker artifacts using write_file.\n\n`;
      prompt += `### REQUIRED FILES:\n`;
      prompt += `1. **Dockerfile** - Container build instructions\n`;
      prompt += `2. **docker-compose.yml** (if multi-service) - Service orchestration\n`;
      prompt += `3. **.dockerignore** - Exclude unnecessary files\n\n`;
      prompt += `### EXAMPLE DOCKERFILE:\n`;
      prompt += `\`\`\`dockerfile\n`;
      prompt += `FROM node:20-alpine\n`;
      prompt += `WORKDIR /app\n`;
      prompt += `COPY package*.json ./\n`;
      prompt += `RUN npm ci --only=production\n`;
      prompt += `COPY dist/ ./dist/\n`;
      prompt += `EXPOSE 3000\n`;
      prompt += `HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1\n`;
      prompt += `CMD ["node", "dist/index.js"]\n`;
      prompt += `\`\`\`\n\n`;
    } else if (this.isDeployTask(task)) {
      prompt += `## DEPLOYMENT TASK - TOOL CALLS MANDATORY\n\n`;
      prompt += `You MUST create deployment configs and/or call deploy tools.\n\n`;
      prompt += `### REQUIRED FOR RAILWAY:\n`;
      prompt += `1. Create railway.json with health check settings\n`;
      prompt += `2. Ensure /health endpoint exists in the app\n`;
      prompt += `3. Call deploy_to_railway if deploying\n\n`;
      prompt += `### REQUIRED FOR VERCEL:\n`;
      prompt += `1. Create vercel.json with routes and build settings\n`;
      prompt += `2. Call deploy_to_vercel if deploying\n\n`;
    }

    prompt += `Please complete this DevOps task. Use the available tools to create configs, `;
    prompt += `build images, and deploy services.`;

    return prompt;
  }

  /**
   * Check if a task is Docker-related
   */
  private isDockerTask(task: Task): boolean {
    const text = `${task.title} ${task.description}`.toLowerCase();
    const dockerKeywords = [
      'docker',
      'dockerfile',
      'container',
      'compose',
      'image',
      'containerize',
      'containerization',
    ];

    return dockerKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if a task is deployment-related
   */
  private isDeployTask(task: Task): boolean {
    const text = `${task.title} ${task.description}`.toLowerCase();
    const deployKeywords = [
      'deploy',
      'railway',
      'vercel',
      'production',
      'staging',
      'release',
      'publish',
    ];

    return deployKeywords.some(keyword => text.includes(keyword));
  }

  // Note: isMonitoringTask will be used in Phase 6c when MonitoringAgent is implemented
  // For now, DevOpsAgent handles monitoring-related tasks as general DevOps work

  /**
   * Verify that sufficient tool calls were made for the task type.
   */
  private verifyToolCalls(task: Task): ToolCallVerification {
    const metrics = this.getToolCallMetrics();

    // Docker tasks: MUST write Dockerfile or compose
    if (this.isDockerTask(task)) {
      const writeCalls = metrics.byTool.get('write_file') ?? 0;
      if (writeCalls === 0) {
        return {
          sufficient: false,
          reason: 'Docker task requires write_file to create Dockerfile/compose. You described what to do instead of doing it.',
          required: ['write_file'],
        };
      }
      return { sufficient: true };
    }

    // Deploy tasks: MUST write config or call deploy tool
    if (this.isDeployTask(task)) {
      const writeCalls = metrics.byTool.get('write_file') ?? 0;
      const deployCalls = (metrics.byTool.get('deploy_to_railway') ?? 0) +
                          (metrics.byTool.get('deploy_to_vercel') ?? 0);
      if (writeCalls === 0 && deployCalls === 0) {
        return {
          sufficient: false,
          reason: 'Deploy task requires write_file for configs or deploy_* tool call. You described what to do instead of doing it.',
          required: ['write_file', 'deploy_to_railway', 'deploy_to_vercel'],
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
   */
  private analyzeResponse(response: string): boolean {
    const lowerResponse = response.toLowerCase();
    const metrics = this.getToolCallMetrics();

    // Trust tool call metrics
    if (metrics.successful > 0) {
      const hardFailures = [
        'error:',
        'exception:',
        'failed to write',
        'permission denied',
        'build failed',
        'deployment failed',
      ];
      const hasHardFailure = hardFailures.some(f => lowerResponse.includes(f));
      if (!hasHardFailure) {
        return true;
      }
    }

    // Soft failure indicators
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

    // Evidence of work done
    const toolUsageIndicators = [
      'tool_call',
      'tool_result',
      'wrote to',
      'file created',
      'dockerfile created',
      'image built',
      'deployed',
      'container running',
    ];

    const hasToolUsage = toolUsageIndicators.some(indicator =>
      lowerResponse.includes(indicator)
    );

    if (hasToolUsage) {
      return true;
    }

    return false;
  }

  /**
   * Extract file paths that were modified from the response
   */
  private extractModifiedFiles(response: string): string[] {
    const files: string[] = [];

    // Look for file paths in tool results
    const writeMatches = response.matchAll(/wrote\s+to\s+['"]?([\w./-]+)['"]?/gi);
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
