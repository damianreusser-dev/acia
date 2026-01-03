/**
 * Docker Tools
 *
 * Provides Docker operations for agents.
 * Tools for building, running, and managing Docker containers.
 *
 * Part of Phase 6b: Deployment & Operations
 */

import { spawn } from 'child_process';
import { Tool, ToolDefinition, ToolResult, AgentRole } from './types.js';

/** Roles that can use Docker tools */
const DOCKER_TOOL_ROLES: AgentRole[] = ['devops', 'ops'];

/**
 * Execute a shell command and return the result
 */
async function executeCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: options?.cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
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
 * Docker Build Tool
 * Builds a Docker image from a Dockerfile
 */
export class DockerBuildTool implements Tool {
  roles: AgentRole[] = DOCKER_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'docker_build',
      description: 'Build a Docker image from a Dockerfile. Returns the build output.',
      parameters: [
        {
          name: 'context',
          type: 'string',
          description: 'Path to the build context (directory containing Dockerfile)',
          required: true,
        },
        {
          name: 'tag',
          type: 'string',
          description: 'Tag for the built image (e.g., "myapp:latest")',
          required: true,
        },
        {
          name: 'dockerfile',
          type: 'string',
          description: 'Path to Dockerfile (relative to context). Defaults to "Dockerfile"',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const context = params['context'];
    const tag = params['tag'];
    const dockerfile = params['dockerfile'];

    if (typeof context !== 'string') {
      return { success: false, error: 'Parameter "context" must be a string' };
    }
    if (typeof tag !== 'string') {
      return { success: false, error: 'Parameter "tag" must be a string' };
    }

    const args = ['build', '-t', tag];
    if (typeof dockerfile === 'string') {
      args.push('-f', dockerfile);
    }
    args.push(context);

    try {
      const result = await executeCommand('docker', args, { timeout: 600000 }); // 10 min for builds

      if (result.code !== 0) {
        return {
          success: false,
          error: `Docker build failed with code ${result.code}: ${result.stderr}`,
          output: result.stdout,
        };
      }

      return {
        success: true,
        output: `Successfully built image ${tag}\n${result.stdout}`,
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
 * Docker Run Tool
 * Runs a Docker container from an image
 */
export class DockerRunTool implements Tool {
  roles: AgentRole[] = DOCKER_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'docker_run',
      description: 'Run a Docker container from an image. Returns container ID.',
      parameters: [
        {
          name: 'image',
          type: 'string',
          description: 'Docker image to run (e.g., "myapp:latest")',
          required: true,
        },
        {
          name: 'name',
          type: 'string',
          description: 'Name for the container',
          required: false,
        },
        {
          name: 'ports',
          type: 'string',
          description: 'Port mapping (e.g., "3000:3000" or "3000:3000,8080:8080")',
          required: false,
        },
        {
          name: 'detach',
          type: 'boolean',
          description: 'Run container in background (default: true)',
          required: false,
        },
        {
          name: 'env',
          type: 'string',
          description: 'Environment variables (e.g., "NODE_ENV=production,PORT=3000")',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const image = params['image'];
    const name = params['name'];
    const ports = params['ports'];
    const detach = params['detach'] ?? true;
    const env = params['env'];

    if (typeof image !== 'string') {
      return { success: false, error: 'Parameter "image" must be a string' };
    }

    const args = ['run'];

    if (detach) {
      args.push('-d');
    }

    if (typeof name === 'string') {
      args.push('--name', name);
    }

    if (typeof ports === 'string') {
      const portMappings = ports.split(',');
      for (const mapping of portMappings) {
        args.push('-p', mapping.trim());
      }
    }

    if (typeof env === 'string') {
      const envVars = env.split(',');
      for (const envVar of envVars) {
        args.push('-e', envVar.trim());
      }
    }

    args.push(image);

    try {
      const result = await executeCommand('docker', args);

      if (result.code !== 0) {
        return {
          success: false,
          error: `Docker run failed with code ${result.code}: ${result.stderr}`,
        };
      }

      const containerId = result.stdout.trim().substring(0, 12);
      return {
        success: true,
        output: `Container started: ${containerId}\n${result.stdout}`,
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
 * Docker Compose Up Tool
 * Starts services defined in docker-compose.yml
 */
export class DockerComposeUpTool implements Tool {
  roles: AgentRole[] = DOCKER_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'docker_compose_up',
      description: 'Start services defined in docker-compose.yml',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Path to directory containing docker-compose.yml',
          required: true,
        },
        {
          name: 'detach',
          type: 'boolean',
          description: 'Run in background (default: true)',
          required: false,
        },
        {
          name: 'build',
          type: 'boolean',
          description: 'Build images before starting (default: false)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const compPath = params['path'];
    const detach = params['detach'] ?? true;
    const build = params['build'] ?? false;

    if (typeof compPath !== 'string') {
      return { success: false, error: 'Parameter "path" must be a string' };
    }

    const args = ['compose', 'up'];

    if (detach) {
      args.push('-d');
    }

    if (build) {
      args.push('--build');
    }

    try {
      const result = await executeCommand('docker', args, { cwd: compPath, timeout: 600000 });

      if (result.code !== 0) {
        return {
          success: false,
          error: `Docker compose up failed: ${result.stderr}`,
          output: result.stdout,
        };
      }

      return {
        success: true,
        output: `Services started successfully\n${result.stdout}`,
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
 * Docker Compose Down Tool
 * Stops and removes services defined in docker-compose.yml
 */
export class DockerComposeDownTool implements Tool {
  roles: AgentRole[] = DOCKER_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'docker_compose_down',
      description: 'Stop and remove services defined in docker-compose.yml',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Path to directory containing docker-compose.yml',
          required: true,
        },
        {
          name: 'volumes',
          type: 'boolean',
          description: 'Also remove volumes (default: false)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const compPath = params['path'];
    const volumes = params['volumes'] ?? false;

    if (typeof compPath !== 'string') {
      return { success: false, error: 'Parameter "path" must be a string' };
    }

    const args = ['compose', 'down'];

    if (volumes) {
      args.push('-v');
    }

    args.push('--remove-orphans');

    try {
      const result = await executeCommand('docker', args, { cwd: compPath });

      if (result.code !== 0) {
        return {
          success: false,
          error: `Docker compose down failed: ${result.stderr}`,
        };
      }

      return {
        success: true,
        output: `Services stopped and removed\n${result.stdout}`,
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
 * Docker Logs Tool
 * Get logs from a running container
 */
export class DockerLogsTool implements Tool {
  roles: AgentRole[] = DOCKER_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'docker_logs',
      description: 'Get logs from a Docker container',
      parameters: [
        {
          name: 'container',
          type: 'string',
          description: 'Container name or ID',
          required: true,
        },
        {
          name: 'tail',
          type: 'number',
          description: 'Number of lines to show from end (default: 100)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const container = params['container'];
    const tail = params['tail'] ?? 100;

    if (typeof container !== 'string') {
      return { success: false, error: 'Parameter "container" must be a string' };
    }

    const args = ['logs', '--tail', String(tail), container];

    try {
      const result = await executeCommand('docker', args);

      if (result.code !== 0) {
        return {
          success: false,
          error: `Docker logs failed: ${result.stderr}`,
        };
      }

      return {
        success: true,
        output: result.stdout || result.stderr || '(no logs)',
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
 * Docker PS Tool
 * List running containers
 */
export class DockerPsTool implements Tool {
  roles: AgentRole[] = DOCKER_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'docker_ps',
      description: 'List running Docker containers',
      parameters: [
        {
          name: 'all',
          type: 'boolean',
          description: 'Show all containers, not just running (default: false)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const showAll = params['all'] ?? false;

    const args = ['ps', '--format', 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'];

    if (showAll) {
      args.push('-a');
    }

    try {
      const result = await executeCommand('docker', args);

      if (result.code !== 0) {
        return {
          success: false,
          error: `Docker ps failed: ${result.stderr}`,
        };
      }

      return {
        success: true,
        output: result.stdout || '(no containers)',
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
 * Docker Stop Tool
 * Stop a running container
 */
export class DockerStopTool implements Tool {
  roles: AgentRole[] = DOCKER_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'docker_stop',
      description: 'Stop a running Docker container',
      parameters: [
        {
          name: 'container',
          type: 'string',
          description: 'Container name or ID to stop',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const container = params['container'];

    if (typeof container !== 'string') {
      return { success: false, error: 'Parameter "container" must be a string' };
    }

    try {
      const result = await executeCommand('docker', ['stop', container]);

      if (result.code !== 0) {
        return {
          success: false,
          error: `Docker stop failed: ${result.stderr}`,
        };
      }

      return {
        success: true,
        output: `Container ${container} stopped`,
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
 * Docker Remove Tool
 * Remove a container
 */
export class DockerRemoveTool implements Tool {
  roles: AgentRole[] = DOCKER_TOOL_ROLES;

  get definition(): ToolDefinition {
    return {
      name: 'docker_rm',
      description: 'Remove a Docker container',
      parameters: [
        {
          name: 'container',
          type: 'string',
          description: 'Container name or ID to remove',
          required: true,
        },
        {
          name: 'force',
          type: 'boolean',
          description: 'Force remove running container (default: false)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const container = params['container'];
    const force = params['force'] ?? false;

    if (typeof container !== 'string') {
      return { success: false, error: 'Parameter "container" must be a string' };
    }

    const args = ['rm'];
    if (force) {
      args.push('-f');
    }
    args.push(container);

    try {
      const result = await executeCommand('docker', args);

      if (result.code !== 0) {
        return {
          success: false,
          error: `Docker rm failed: ${result.stderr}`,
        };
      }

      return {
        success: true,
        output: `Container ${container} removed`,
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
 * Creates all Docker tools
 */
export function createDockerTools(): Tool[] {
  return [
    new DockerBuildTool(),
    new DockerRunTool(),
    new DockerComposeUpTool(),
    new DockerComposeDownTool(),
    new DockerLogsTool(),
    new DockerPsTool(),
    new DockerStopTool(),
    new DockerRemoveTool(),
  ];
}
