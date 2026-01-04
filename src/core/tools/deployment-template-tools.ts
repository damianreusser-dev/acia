/**
 * Deployment Template Tools
 *
 * Tools for agents to generate Docker deployment files from templates.
 * These tools create production-ready Dockerfiles and docker-compose.yml files
 * that avoid common pitfalls (like volume mounts that overwrite container files).
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolDefinition, ToolResult, AgentRole } from './types.js';
import {
  createNodeDockerfile,
  createNodeDockerfileWithBuild,
  createDockerignore,
  createSingleServiceCompose,
  createFullstackCompose,
  type DockerTemplateOptions,
} from '../../templates/docker/index.js';

/**
 * Tool to generate Docker deployment files for a project
 */
export class GenerateDeploymentTool implements Tool {
  private workspace: string;

  definition: ToolDefinition = {
    name: 'generate_deployment',
    description:
      'Generate Docker deployment files (Dockerfile, docker-compose.yml, .dockerignore) from tested templates. ' +
      'Creates production-ready configurations with health checks and proper settings. ' +
      'ALWAYS use this tool for Docker deployments instead of writing Dockerfiles from scratch.',
    parameters: [
      {
        name: 'projectPath',
        type: 'string',
        description: 'Path to the project directory (relative to workspace)',
        required: true,
      },
      {
        name: 'port',
        type: 'number',
        description: 'Port the application runs on (e.g., 3001)',
        required: true,
      },
      {
        name: 'healthPath',
        type: 'string',
        description: 'Health check endpoint path (default: /api/health)',
        required: false,
      },
      {
        name: 'includeBuildStep',
        type: 'boolean',
        description: 'Include TypeScript build step in Dockerfile (default: true)',
        required: false,
      },
    ],
  };

  roles: AgentRole[] = ['devops', 'ops'];

  constructor(workspace: string) {
    this.workspace = workspace;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const projectPath = params.projectPath as string;
    const port = params.port as number;
    const healthPath = (params.healthPath as string) || '/api/health';
    const includeBuildStep = params.includeBuildStep !== false; // Default to true

    if (!projectPath || port === undefined) {
      return {
        success: false,
        output: 'Missing required parameters: projectPath and port',
        error: 'MISSING_PARAMS',
      };
    }

    if (typeof port !== 'number' || port < 1 || port > 65535) {
      return {
        success: false,
        output: 'Port must be a number between 1 and 65535',
        error: 'INVALID_PORT',
      };
    }

    const fullProjectPath = path.join(this.workspace, projectPath);

    try {
      // Check if project directory exists
      await fs.access(fullProjectPath);

      // Read package.json to get entry point
      const entryPoint = await this.detectEntryPoint(fullProjectPath);

      // Prepare template options
      const options: DockerTemplateOptions = {
        projectName: path.basename(projectPath),
        port,
        healthPath,
        entryPoint,
      };

      // Generate Dockerfile
      const dockerfile = includeBuildStep
        ? createNodeDockerfileWithBuild(options)
        : createNodeDockerfile(options);

      // Generate .dockerignore
      const dockerignore = createDockerignore();

      // Generate docker-compose.yml
      const compose = createSingleServiceCompose(options.projectName, port, healthPath);

      // Write files
      const filesCreated: string[] = [];

      await fs.writeFile(path.join(fullProjectPath, 'Dockerfile'), dockerfile);
      filesCreated.push('Dockerfile');

      await fs.writeFile(path.join(fullProjectPath, '.dockerignore'), dockerignore);
      filesCreated.push('.dockerignore');

      await fs.writeFile(path.join(fullProjectPath, 'docker-compose.yml'), compose);
      filesCreated.push('docker-compose.yml');

      return {
        success: true,
        output:
          `Successfully generated Docker deployment files for "${projectPath}"!\n\n` +
          `Created files:\n` +
          filesCreated.map((f) => `  - ${projectPath}/${f}`).join('\n') +
          `\n\nConfiguration:\n` +
          `  - Port: ${port}\n` +
          `  - Health check: ${healthPath}\n` +
          `  - Entry point: ${entryPoint}\n` +
          `  - Build step: ${includeBuildStep ? 'included' : 'not included'}\n\n` +
          `Next steps:\n` +
          `1. npm run build (if not already built)\n` +
          `2. docker compose up --build\n` +
          `3. Visit http://localhost:${port}${healthPath}\n`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: `Failed to generate deployment files: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Detect the entry point from package.json
   */
  private async detectEntryPoint(projectPath: string): Promise<string> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Check main field
      if (packageJson.main) {
        return packageJson.main;
      }

      // Check for common entry points in scripts
      const startScript = packageJson.scripts?.start;
      if (startScript) {
        const match = startScript.match(/node\s+([^\s]+)/);
        if (match) {
          return match[1];
        }
      }

      // Default to dist/index.js for TypeScript projects
      return 'dist/index.js';
    } catch {
      return 'dist/index.js';
    }
  }
}

/**
 * Tool to generate fullstack Docker deployment (frontend + backend)
 */
export class GenerateFullstackDeploymentTool implements Tool {
  private workspace: string;

  definition: ToolDefinition = {
    name: 'generate_fullstack_deployment',
    description:
      'Generate Docker deployment files for a fullstack project with separate frontend and backend services. ' +
      'Creates docker-compose.yml that orchestrates both services with proper dependencies and health checks.',
    parameters: [
      {
        name: 'projectPath',
        type: 'string',
        description: 'Path to the project root (should contain frontend/ and backend/ directories)',
        required: true,
      },
      {
        name: 'backendPort',
        type: 'number',
        description: 'Port for the backend service (default: 3001)',
        required: false,
      },
      {
        name: 'frontendPort',
        type: 'number',
        description: 'Port for the frontend service (default: 3000)',
        required: false,
      },
      {
        name: 'backendHealthPath',
        type: 'string',
        description: 'Health check endpoint for backend (default: /api/health)',
        required: false,
      },
    ],
  };

  roles: AgentRole[] = ['devops', 'ops'];

  constructor(workspace: string) {
    this.workspace = workspace;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const projectPath = params.projectPath as string;
    const backendPort = (params.backendPort as number) || 3001;
    const frontendPort = (params.frontendPort as number) || 3000;
    const backendHealthPath = (params.backendHealthPath as string) || '/api/health';

    if (!projectPath) {
      return {
        success: false,
        output: 'Missing required parameter: projectPath',
        error: 'MISSING_PARAMS',
      };
    }

    const fullProjectPath = path.join(this.workspace, projectPath);

    try {
      // Check project structure
      const backendPath = path.join(fullProjectPath, 'backend');
      const frontendPath = path.join(fullProjectPath, 'frontend');

      await fs.access(backendPath);
      await fs.access(frontendPath);

      // Generate backend Dockerfile
      const backendEntryPoint = await this.detectEntryPoint(backendPath);
      const backendDockerfile = createNodeDockerfileWithBuild({
        projectName: 'backend',
        port: backendPort,
        healthPath: backendHealthPath,
        entryPoint: backendEntryPoint,
      });

      // Generate frontend Dockerfile (simple, serves static files)
      const frontendDockerfile = this.createFrontendDockerfile(frontendPort);

      // Generate dockerignores
      const dockerignore = createDockerignore();

      // Generate fullstack compose
      const compose = createFullstackCompose(
        path.basename(projectPath),
        backendPort,
        frontendPort,
        backendHealthPath
      );

      const filesCreated: string[] = [];

      // Write backend files
      await fs.writeFile(path.join(backendPath, 'Dockerfile'), backendDockerfile);
      filesCreated.push('backend/Dockerfile');
      await fs.writeFile(path.join(backendPath, '.dockerignore'), dockerignore);
      filesCreated.push('backend/.dockerignore');

      // Write frontend files
      await fs.writeFile(path.join(frontendPath, 'Dockerfile'), frontendDockerfile);
      filesCreated.push('frontend/Dockerfile');
      await fs.writeFile(path.join(frontendPath, '.dockerignore'), dockerignore);
      filesCreated.push('frontend/.dockerignore');

      // Write root compose
      await fs.writeFile(path.join(fullProjectPath, 'docker-compose.yml'), compose);
      filesCreated.push('docker-compose.yml');

      return {
        success: true,
        output:
          `Successfully generated fullstack Docker deployment for "${projectPath}"!\n\n` +
          `Created files:\n` +
          filesCreated.map((f) => `  - ${projectPath}/${f}`).join('\n') +
          `\n\nConfiguration:\n` +
          `  - Backend: http://localhost:${backendPort}\n` +
          `  - Frontend: http://localhost:${frontendPort}\n` +
          `  - Backend health: ${backendHealthPath}\n\n` +
          `Next steps:\n` +
          `1. cd ${projectPath}\n` +
          `2. docker compose up --build\n` +
          `3. Visit http://localhost:${frontendPort}\n`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: `Failed to generate deployment files: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Create a Dockerfile for React/Vite frontend
   */
  private createFrontendDockerfile(port: number): string {
    return `# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Copy nginx config (if exists)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE ${port}

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  /**
   * Detect the entry point from package.json
   */
  private async detectEntryPoint(projectPath: string): Promise<string> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      if (packageJson.main) {
        return packageJson.main;
      }

      return 'dist/index.js';
    } catch {
      return 'dist/index.js';
    }
  }
}

/**
 * Create all deployment template tools for a workspace
 */
export function createDeploymentTemplateTools(workspace: string): Tool[] {
  return [
    new GenerateDeploymentTool(workspace),
    new GenerateFullstackDeploymentTool(workspace),
  ];
}
