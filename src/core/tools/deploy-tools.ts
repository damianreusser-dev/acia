/**
 * Deployment Tools
 *
 * Provides generic deployment utilities for agents.
 * Platform-specific tools (Azure) are in azure-tools.ts.
 *
 * Part of Phase 6b: Deployment & Operations
 * Updated in Phase 6h: Azure Deployment + E2E Build-Deploy-Monitor Integration
 */

import { spawn } from 'child_process';
import { Tool, ToolDefinition, ToolResult, AgentRole } from './types.js';

/** Roles that can use deployment tools */
const DEPLOY_TOOL_ROLES: AgentRole[] = ['devops', 'ops'];

/**
 * Execute a shell command and return the result
 */
export async function executeCommand(
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
          description: 'URL to check (e.g., "https://myapp.azurewebsites.net/health")',
          required: true,
        },
        {
          name: 'expectedStatus',
          type: 'number',
          description: 'Expected HTTP status code (default: 200)',
          required: false,
        },
        {
          name: 'timeout',
          type: 'number',
          description: 'Timeout in seconds (default: 10)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const url = params['url'];
    const expectedStatus = params['expectedStatus'] ?? 200;
    const timeout = params['timeout'] ?? 10;

    if (typeof url !== 'string') {
      return { success: false, error: 'Parameter "url" must be a string' };
    }

    try {
      const result = await executeCommand('curl', [
        '-s',
        '-o',
        '/dev/null',
        '-w',
        '%{http_code}',
        '--max-time',
        String(timeout),
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
 * Wait for Health Tool
 * Wait for an endpoint to become healthy with retries
 */
export class WaitForHealthTool implements Tool {
  roles: AgentRole[] = [...DEPLOY_TOOL_ROLES, 'monitoring'];

  get definition(): ToolDefinition {
    return {
      name: 'wait_for_health',
      description: 'Wait for a URL endpoint to become healthy with retries',
      parameters: [
        {
          name: 'url',
          type: 'string',
          description: 'URL to check',
          required: true,
        },
        {
          name: 'maxAttempts',
          type: 'number',
          description: 'Maximum number of attempts (default: 30)',
          required: false,
        },
        {
          name: 'intervalSeconds',
          type: 'number',
          description: 'Seconds between attempts (default: 10)',
          required: false,
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
    const maxAttempts = (params['maxAttempts'] as number) ?? 30;
    const intervalSeconds = (params['intervalSeconds'] as number) ?? 10;
    const expectedStatus = (params['expectedStatus'] as number) ?? 200;

    if (typeof url !== 'string') {
      return { success: false, error: 'Parameter "url" must be a string' };
    }

    const healthCheckTool = new HealthCheckTool();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await healthCheckTool.execute({
        url,
        expectedStatus,
        timeout: 10,
      });

      if (result.success) {
        return {
          success: true,
          output: `Service healthy after ${attempt} attempt(s): ${url}`,
        };
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
      }
    }

    return {
      success: false,
      error: `Service not healthy after ${maxAttempts} attempts: ${url}`,
    };
  }
}

/**
 * Creates all generic deployment tools
 * Note: Platform-specific tools (Azure) are in azure-tools.ts
 */
export function createDeployTools(): Tool[] {
  return [new HealthCheckTool(), new WaitForHealthTool()];
}
