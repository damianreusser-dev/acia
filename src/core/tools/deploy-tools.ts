/**
 * Deployment Tools
 *
 * Provides cloud deployment operations for agents.
 * Supports Railway (backend) and Vercel (frontend) deployments.
 *
 * Part of Phase 6b: Deployment & Operations
 *
 * Environment Variables Required:
 * - RAILWAY_TOKEN: Railway API token for authentication
 * - VERCEL_TOKEN: Vercel API token for authentication
 */

import { spawn } from 'child_process';
import { Tool, ToolDefinition, ToolResult, AgentRole } from './types.js';

/** Roles that can use deployment tools */
const DEPLOY_TOOL_ROLES: AgentRole[] = ['devops', 'ops'];

/**
 * Execute a shell command and return the result
 */
async function executeCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; timeout?: number; env?: Record<string, string> }
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: options?.cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...options?.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => (stdout += data.toString()));
    proc.stderr?.on('data', (data) => (stderr += data.toString()));

    // Timeout handling
    const timeout = options?.timeout ?? 300000; // 5 min default
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      stderr += '\nProcess timed out';
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: err.message });
    });
  });
}

/**
 * Deploy to Railway Tool
 * Deploys a project to Railway platform
 */
export class DeployToRailwayTool implements Tool {
  roles: AgentRole[] = DEPLOY_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'deploy_to_railway',
      description: 'Deploy a project to Railway. Requires RAILWAY_TOKEN environment variable.',
      parameters: [
        {
          name: 'projectPath',
          type: 'string',
          description: 'Path to the project directory to deploy',
          required: true,
        },
        {
          name: 'serviceName',
          type: 'string',
          description: 'Name for the Railway service (optional)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const projectPath = params['projectPath'];
    const serviceName = params['serviceName'];

    if (typeof projectPath !== 'string') {
      return { success: false, error: 'Parameter "projectPath" must be a string' };
    }

    // Check for Railway token
    if (!process.env.RAILWAY_TOKEN) {
      return {
        success: false,
        error: 'RAILWAY_TOKEN environment variable is required for Railway deployments',
      };
    }

    try {
      // Check if Railway CLI is installed
      const checkResult = await executeCommand('railway', ['--version']);
      if (checkResult.code !== 0) {
        return {
          success: false,
          error: 'Railway CLI is not installed. Install with: npm install -g @railway/cli',
        };
      }

      // Link to project or create new one
      const linkArgs = ['link'];
      if (typeof serviceName === 'string') {
        linkArgs.push('--name', serviceName);
      }

      // Try linking, if fails, init new project
      const linkResult = await executeCommand('railway', linkArgs, { cwd: projectPath });
      if (linkResult.code !== 0) {
        // Initialize new project
        const projectName = typeof serviceName === 'string' ? serviceName : 'acia-deployment';
        const initResult = await executeCommand('railway', ['init', '--name', projectName], { cwd: projectPath });
        if (initResult.code !== 0) {
          return {
            success: false,
            error: `Failed to initialize Railway project: ${initResult.stderr}`,
          };
        }
      }

      // Deploy
      const deployResult = await executeCommand('railway', ['up', '--detach'], {
        cwd: projectPath,
        timeout: 600000, // 10 min for deployment
      });

      if (deployResult.code !== 0) {
        return {
          success: false,
          error: `Railway deployment failed: ${deployResult.stderr}`,
          output: deployResult.stdout,
        };
      }

      // Get deployment URL
      const statusResult = await executeCommand('railway', ['status', '--json'], { cwd: projectPath });
      let deploymentUrl = '';
      if (statusResult.code === 0) {
        try {
          const status = JSON.parse(statusResult.stdout);
          deploymentUrl = status.deploymentUrl || status.url || '';
        } catch {
          // Ignore parse errors
        }
      }

      return {
        success: true,
        output: `Deployed to Railway successfully!\n${deploymentUrl ? `URL: ${deploymentUrl}` : ''}\n${deployResult.stdout}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Deploy to Vercel Tool
 * Deploys a project to Vercel platform
 */
export class DeployToVercelTool implements Tool {
  roles: AgentRole[] = DEPLOY_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'deploy_to_vercel',
      description: 'Deploy a project to Vercel. Requires VERCEL_TOKEN environment variable.',
      parameters: [
        {
          name: 'projectPath',
          type: 'string',
          description: 'Path to the project directory to deploy',
          required: true,
        },
        {
          name: 'production',
          type: 'boolean',
          description: 'Deploy to production (default: false for preview)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const projectPath = params['projectPath'];
    const production = params['production'] ?? false;

    if (typeof projectPath !== 'string') {
      return { success: false, error: 'Parameter "projectPath" must be a string' };
    }

    // Check for Vercel token
    if (!process.env.VERCEL_TOKEN) {
      return {
        success: false,
        error: 'VERCEL_TOKEN environment variable is required for Vercel deployments',
      };
    }

    try {
      // Check if Vercel CLI is installed
      const checkResult = await executeCommand('vercel', ['--version']);
      if (checkResult.code !== 0) {
        return {
          success: false,
          error: 'Vercel CLI is not installed. Install with: npm install -g vercel',
        };
      }

      // Deploy
      const deployArgs = ['--yes', '--token', process.env.VERCEL_TOKEN];
      if (production) {
        deployArgs.push('--prod');
      }

      const deployResult = await executeCommand('vercel', deployArgs, {
        cwd: projectPath,
        timeout: 600000, // 10 min for deployment
      });

      if (deployResult.code !== 0) {
        return {
          success: false,
          error: `Vercel deployment failed: ${deployResult.stderr}`,
          output: deployResult.stdout,
        };
      }

      // Extract URL from output
      const urlMatch = deployResult.stdout.match(/https:\/\/[a-z0-9-]+\.vercel\.app/);
      const deploymentUrl = urlMatch ? urlMatch[0] : '';

      return {
        success: true,
        output: `Deployed to Vercel successfully!\n${deploymentUrl ? `URL: ${deploymentUrl}` : ''}\n${deployResult.stdout}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Get Deployment Status Tool
 * Check the status of a deployment
 */
export class GetDeploymentStatusTool implements Tool {
  roles: AgentRole[] = DEPLOY_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'get_deployment_status',
      description: 'Check the status of a Railway or Vercel deployment',
      parameters: [
        {
          name: 'platform',
          type: 'string',
          description: 'Deployment platform: "railway" or "vercel"',
          required: true,
        },
        {
          name: 'projectPath',
          type: 'string',
          description: 'Path to the project directory',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const platform = params['platform'];
    const projectPath = params['projectPath'];

    if (typeof platform !== 'string' || !['railway', 'vercel'].includes(platform)) {
      return { success: false, error: 'Parameter "platform" must be "railway" or "vercel"' };
    }
    if (typeof projectPath !== 'string') {
      return { success: false, error: 'Parameter "projectPath" must be a string' };
    }

    try {
      if (platform === 'railway') {
        const result = await executeCommand('railway', ['status'], { cwd: projectPath });
        return {
          success: result.code === 0,
          output: result.stdout || result.stderr,
          error: result.code !== 0 ? `Status check failed: ${result.stderr}` : undefined,
        };
      } else {
        // Vercel
        const result = await executeCommand('vercel', ['list', '--token', process.env.VERCEL_TOKEN || ''], { cwd: projectPath });
        return {
          success: result.code === 0,
          output: result.stdout || result.stderr,
          error: result.code !== 0 ? `Status check failed: ${result.stderr}` : undefined,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Get Deployment Logs Tool
 * Get logs from a deployment
 */
export class GetDeploymentLogsTool implements Tool {
  roles: AgentRole[] = DEPLOY_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'get_deployment_logs',
      description: 'Get logs from a Railway deployment',
      parameters: [
        {
          name: 'projectPath',
          type: 'string',
          description: 'Path to the project directory',
          required: true,
        },
        {
          name: 'lines',
          type: 'number',
          description: 'Number of log lines to retrieve (default: 100)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const projectPath = params['projectPath'];
    const lines = params['lines'] ?? 100;

    if (typeof projectPath !== 'string') {
      return { success: false, error: 'Parameter "projectPath" must be a string' };
    }

    try {
      const result = await executeCommand('railway', ['logs', '--tail', String(lines)], { cwd: projectPath });

      return {
        success: result.code === 0,
        output: result.stdout || result.stderr || '(no logs)',
        error: result.code !== 0 ? `Failed to get logs: ${result.stderr}` : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Rollback Deployment Tool
 * Rollback to a previous deployment
 */
export class RollbackDeploymentTool implements Tool {
  roles: AgentRole[] = DEPLOY_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'rollback_deployment',
      description: 'Rollback a Railway deployment to the previous version',
      parameters: [
        {
          name: 'projectPath',
          type: 'string',
          description: 'Path to the project directory',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const projectPath = params['projectPath'];

    if (typeof projectPath !== 'string') {
      return { success: false, error: 'Parameter "projectPath" must be a string' };
    }

    try {
      // Get deployment history
      const historyResult = await executeCommand('railway', ['deployments', '--json'], { cwd: projectPath });

      if (historyResult.code !== 0) {
        return {
          success: false,
          error: `Failed to get deployment history: ${historyResult.stderr}`,
        };
      }

      let previousDeployment = '';
      try {
        const deployments = JSON.parse(historyResult.stdout);
        if (Array.isArray(deployments) && deployments.length >= 2) {
          previousDeployment = deployments[1].id;
        }
      } catch {
        return {
          success: false,
          error: 'Failed to parse deployment history',
        };
      }

      if (!previousDeployment) {
        return {
          success: false,
          error: 'No previous deployment found to rollback to',
        };
      }

      // Rollback to previous deployment
      const rollbackResult = await executeCommand('railway', ['rollback', previousDeployment], { cwd: projectPath });

      if (rollbackResult.code !== 0) {
        return {
          success: false,
          error: `Rollback failed: ${rollbackResult.stderr}`,
        };
      }

      return {
        success: true,
        output: `Rolled back to deployment ${previousDeployment}\n${rollbackResult.stdout}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Delete Deployment Tool
 * Delete a deployment (for cleanup)
 */
export class DeleteDeploymentTool implements Tool {
  roles: AgentRole[] = DEPLOY_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'delete_deployment',
      description: 'Delete a deployment from Railway or Vercel (for cleanup)',
      parameters: [
        {
          name: 'platform',
          type: 'string',
          description: 'Deployment platform: "railway" or "vercel"',
          required: true,
        },
        {
          name: 'projectPath',
          type: 'string',
          description: 'Path to the project directory',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const platform = params['platform'];
    const projectPath = params['projectPath'];

    if (typeof platform !== 'string' || !['railway', 'vercel'].includes(platform)) {
      return { success: false, error: 'Parameter "platform" must be "railway" or "vercel"' };
    }
    if (typeof projectPath !== 'string') {
      return { success: false, error: 'Parameter "projectPath" must be a string' };
    }

    try {
      if (platform === 'railway') {
        const result = await executeCommand('railway', ['delete', '-y'], { cwd: projectPath });
        return {
          success: result.code === 0,
          output: result.code === 0 ? 'Railway project deleted' : result.stderr,
          error: result.code !== 0 ? `Delete failed: ${result.stderr}` : undefined,
        };
      } else {
        // Vercel - remove with confirmation bypass
        const result = await executeCommand('vercel', ['remove', '--yes', '--token', process.env.VERCEL_TOKEN || ''], { cwd: projectPath });
        return {
          success: result.code === 0,
          output: result.code === 0 ? 'Vercel project deleted' : result.stderr,
          error: result.code !== 0 ? `Delete failed: ${result.stderr}` : undefined,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Health Check Tool
 * Check if a deployed endpoint is healthy
 */
export class HealthCheckTool implements Tool {
  roles: AgentRole[] = [...DEPLOY_TOOL_ROLES, 'monitoring'];

  get definition(): ToolDefinition {
    return {
      name: 'health_check',
      description: 'Check if a URL endpoint is healthy',
      parameters: [
        {
          name: 'url',
          type: 'string',
          description: 'URL to check (e.g., "https://myapp.railway.app/health")',
          required: true,
        },
        {
          name: 'expectedStatus',
          type: 'number',
          description: 'Expected HTTP status code (default: 200)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const url = params['url'];
    const expectedStatus = params['expectedStatus'] ?? 200;

    if (typeof url !== 'string') {
      return { success: false, error: 'Parameter "url" must be a string' };
    }

    try {
      const result = await executeCommand('curl', [
        '-s',
        '-o', '/dev/null',
        '-w', '%{http_code}',
        '--max-time', '10',
        url,
      ]);

      const statusCode = parseInt(result.stdout.trim(), 10);

      if (statusCode === expectedStatus) {
        return {
          success: true,
          output: `Health check passed: ${url} returned ${statusCode}`,
        };
      } else {
        return {
          success: false,
          error: `Health check failed: ${url} returned ${statusCode}, expected ${expectedStatus}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Creates all deployment tools
 */
export function createDeployTools(): Tool[] {
  return [
    new DeployToRailwayTool(),
    new DeployToVercelTool(),
    new GetDeploymentStatusTool(),
    new GetDeploymentLogsTool(),
    new RollbackDeploymentTool(),
    new DeleteDeploymentTool(),
    new HealthCheckTool(),
  ];
}
