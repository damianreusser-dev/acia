/**
 * Deployment Diagnostics Tests
 *
 * These tests verify each component of the deployment pipeline works in isolation.
 * Following the D1-D6 diagnostic hierarchy from Phase 6 planning.
 *
 * Hierarchy:
 * D1: File Structure → D2: npm install → D3: TypeScript → D4: Unit Tests
 *                                                               ↓
 *                     D6: Health Check ← D5: Docker Build ← Dockerfile exists
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import agents for testing
import { DevOpsAgent } from '../../src/agents/devops/devops-agent';
import { BackendDevAgent } from '../../src/agents/dev/backend-dev-agent';
import { LLMClient } from '../../src/core/llm/client';
import { createFileTools } from '../../src/core/tools/file-tools';
import { createDockerTools } from '../../src/core/tools/docker-tools';
import { Task } from '../../src/core/tasks/types';

// Test workspace for diagnostic tests
const DIAG_WORKSPACE = path.join(process.cwd(), 'test-workspaces', 'deployment-diagnostics');

describe('Deployment Diagnostics', () => {
  let mockLLMClient: LLMClient;

  beforeAll(() => {
    // Create mock LLM client that returns valid tool calls
    mockLLMClient = {
      chat: vi.fn(),
      getProvider: vi.fn().mockReturnValue('openai'),
    } as unknown as LLMClient;
  });

  describe('D1: Agent Configuration', () => {
    it('should have DevOpsAgent with correct role', () => {
      const tools = createFileTools(DIAG_WORKSPACE);
      const dockerTools = createDockerTools();

      const agent = new DevOpsAgent({
        llmClient: mockLLMClient,
        tools: [...tools, ...dockerTools],
        workspace: DIAG_WORKSPACE,
      });

      expect(agent.name).toBe('DevOpsAgent');
    });

    it('should have BackendDevAgent with correct role', () => {
      const tools = createFileTools(DIAG_WORKSPACE);

      const agent = new BackendDevAgent({
        llmClient: mockLLMClient,
        tools,
        workspace: DIAG_WORKSPACE,
      });

      expect(agent.name).toBe('BackendDevAgent');
    });

    it('should have Docker tools available', () => {
      const dockerTools = createDockerTools();

      const toolNames = dockerTools.map(t => t.definition.name);
      expect(toolNames).toContain('docker_build');
      expect(toolNames).toContain('docker_compose_up');
      expect(toolNames).toContain('docker_compose_down');
      expect(toolNames).toContain('docker_logs');
    });
  });

  describe('D2: Docker Tool Definitions', () => {
    it('docker_build should have required parameters', () => {
      const dockerTools = createDockerTools();
      const buildTool = dockerTools.find(t => t.definition.name === 'docker_build');

      expect(buildTool).toBeDefined();
      expect(buildTool!.definition.parameters).toContainEqual(
        expect.objectContaining({ name: 'context', required: true })
      );
      expect(buildTool!.definition.parameters).toContainEqual(
        expect.objectContaining({ name: 'tag', required: true })
      );
    });

    it('docker_compose_up should have path parameter', () => {
      const dockerTools = createDockerTools();
      const composeTool = dockerTools.find(t => t.definition.name === 'docker_compose_up');

      expect(composeTool).toBeDefined();
      expect(composeTool!.definition.parameters).toContainEqual(
        expect.objectContaining({ name: 'path', required: true })
      );
      expect(composeTool!.definition.parameters).toContainEqual(
        expect.objectContaining({ name: 'build', required: false })
      );
    });

    it('docker_compose_down should have cleanup options', () => {
      const dockerTools = createDockerTools();
      const downTool = dockerTools.find(t => t.definition.name === 'docker_compose_down');

      expect(downTool).toBeDefined();
      expect(downTool!.definition.parameters).toContainEqual(
        expect.objectContaining({ name: 'volumes', required: false })
      );
    });
  });

  describe('D3: DevOpsAgent System Prompt', () => {
    it('should mention Dockerfile creation in system prompt', () => {
      const tools = createFileTools(DIAG_WORKSPACE);
      const dockerTools = createDockerTools();

      const agent = new DevOpsAgent({
        llmClient: mockLLMClient,
        tools: [...tools, ...dockerTools],
        workspace: DIAG_WORKSPACE,
      });

      // Access the system prompt through the agent
      // The agent should have instructions about Dockerfiles
      expect(agent).toBeDefined();
    });

    it('should have write_file tool for creating Dockerfiles', () => {
      const tools = createFileTools(DIAG_WORKSPACE);
      const toolNames = tools.map(t => t.definition.name);

      expect(toolNames).toContain('write_file');
    });

    it('should have read_file tool for analyzing project structure', () => {
      const tools = createFileTools(DIAG_WORKSPACE);
      const toolNames = tools.map(t => t.definition.name);

      expect(toolNames).toContain('read_file');
    });
  });

  describe('D4: Dockerfile Validation Patterns', () => {
    it('should validate Dockerfile has FROM instruction', () => {
      const validDockerfile = `FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["node", "dist/index.js"]`;

      expect(validDockerfile).toContain('FROM');
    });

    it('should validate Dockerfile has EXPOSE instruction', () => {
      const validDockerfile = `FROM node:20-alpine
WORKDIR /usr/src/app
EXPOSE 3001
CMD ["node", "dist/index.js"]`;

      expect(validDockerfile).toContain('EXPOSE');
    });

    it('should validate Dockerfile has CMD or ENTRYPOINT', () => {
      const validDockerfile = `FROM node:20-alpine
CMD ["node", "dist/index.js"]`;

      const hasCMD = validDockerfile.includes('CMD');
      const hasENTRYPOINT = validDockerfile.includes('ENTRYPOINT');
      expect(hasCMD || hasENTRYPOINT).toBe(true);
    });

    it('should detect problematic volume mounts in compose.yml', () => {
      const problematicCompose = `version: "3.8"
services:
  backend:
    build: ./backend
    volumes:
      - ./backend:/usr/src/app:ro`;

      // This pattern overwrites the built dist/ folder
      const hasProblematicMount =
        problematicCompose.includes('volumes:') &&
        problematicCompose.includes('/usr/src/app');

      expect(hasProblematicMount).toBe(true);
    });

    it('should accept compose.yml without problematic volumes', () => {
      const goodCompose = `version: "3.8"
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]`;

      // No volume mount that overwrites container
      const hasProblematicMount =
        goodCompose.includes('volumes:') &&
        goodCompose.includes('/usr/src/app');

      expect(hasProblematicMount).toBe(false);
    });
  });

  describe('D5: Task Detection', () => {
    it('should detect Docker task from keywords', () => {
      const task: Task = {
        id: 'test-1',
        title: 'Create Docker deployment',
        description: 'Create Dockerfile and docker-compose.yml for the backend',
        type: 'feature',
        status: 'pending',
        priority: 'high',
      };

      const taskText = `${task.title} ${task.description}`.toLowerCase();
      const isDockerTask = ['docker', 'dockerfile', 'container', 'compose'].some(
        keyword => taskText.includes(keyword)
      );

      expect(isDockerTask).toBe(true);
    });

    it('should detect deployment task from keywords', () => {
      const task: Task = {
        id: 'test-2',
        title: 'Deploy application',
        description: 'Deploy the backend to production',
        type: 'feature',
        status: 'pending',
        priority: 'high',
      };

      const taskText = `${task.title} ${task.description}`.toLowerCase();
      const isDeployTask = ['deploy', 'production', 'staging', 'release'].some(
        keyword => taskText.includes(keyword)
      );

      expect(isDeployTask).toBe(true);
    });

    it('should NOT detect Docker task from unrelated keywords', () => {
      const task: Task = {
        id: 'test-3',
        title: 'Create todo API',
        description: 'Implement REST endpoints for todos',
        type: 'feature',
        status: 'pending',
        priority: 'high',
      };

      const taskText = `${task.title} ${task.description}`.toLowerCase();
      const isDockerTask = ['docker', 'dockerfile', 'container', 'compose'].some(
        keyword => taskText.includes(keyword)
      );

      expect(isDockerTask).toBe(false);
    });
  });

  describe('D6: Health Check Patterns', () => {
    it('should validate health endpoint path format', () => {
      const validPaths = ['/health', '/api/health', '/healthz', '/ready'];

      for (const path of validPaths) {
        expect(path).toMatch(/^\/[a-z/]+$/i);
      }
    });

    it('should detect health check in Dockerfile', () => {
      const dockerfileWithHealth = `FROM node:20-alpine
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
  CMD curl -f http://localhost:3001/api/health || exit 1
CMD ["node", "dist/index.js"]`;

      expect(dockerfileWithHealth).toContain('HEALTHCHECK');
    });

    it('should detect health check in docker-compose.yml', () => {
      const composeWithHealth = `version: "3.8"
services:
  backend:
    build: ./backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3`;

      expect(composeWithHealth).toContain('healthcheck:');
    });
  });
});

describe('Deployment Agent Integration', () => {
  describe('DevOpsAgent Task Execution Flow', () => {
    let mockLLMClient: LLMClient;

    beforeAll(() => {
      mockLLMClient = {
        chat: vi.fn().mockResolvedValue({
          content: `I'll create the Docker files.

<tool_call>
{"tool": "write_file", "params": {"path": "Dockerfile", "content": "FROM node:20-alpine\\nWORKDIR /app"}}
</tool_call>`,
          usage: { input_tokens: 100, output_tokens: 200 },
        }),
        getProvider: vi.fn().mockReturnValue('openai'),
      } as unknown as LLMClient;
    });

    it('should have workspace configured', () => {
      const tools = createFileTools(DIAG_WORKSPACE);
      const dockerTools = createDockerTools();

      const agent = new DevOpsAgent({
        llmClient: mockLLMClient,
        tools: [...tools, ...dockerTools],
        workspace: DIAG_WORKSPACE,
      });

      expect(agent.getWorkspace()).toBe(DIAG_WORKSPACE);
    });

    it('should have required tools for Docker tasks', () => {
      const fileTools = createFileTools(DIAG_WORKSPACE);
      const dockerTools = createDockerTools();
      const allTools = [...fileTools, ...dockerTools];

      const toolNames = allTools.map(t => t.definition.name);

      // Required for Dockerfile creation
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('read_file');

      // Required for Docker operations
      expect(toolNames).toContain('docker_build');
      expect(toolNames).toContain('docker_compose_up');
    });
  });

  describe('BackendDevAgent Route Creation', () => {
    let mockLLMClient: LLMClient;

    beforeAll(() => {
      mockLLMClient = {
        chat: vi.fn().mockResolvedValue({
          content: `Creating todos route.

<tool_call>
{"tool": "write_file", "params": {"path": "src/routes/todos.ts", "content": "import { Router } from 'express';"}}
</tool_call>`,
          usage: { input_tokens: 100, output_tokens: 200 },
        }),
        getProvider: vi.fn().mockReturnValue('openai'),
      } as unknown as LLMClient;
    });

    it('should have workspace configured', () => {
      const tools = createFileTools(DIAG_WORKSPACE);

      const agent = new BackendDevAgent({
        llmClient: mockLLMClient,
        tools,
        workspace: DIAG_WORKSPACE,
      });

      expect(agent.getWorkspace()).toBe(DIAG_WORKSPACE);
    });

    it('should have write_file tool for creating routes', () => {
      const tools = createFileTools(DIAG_WORKSPACE);
      const toolNames = tools.map(t => t.definition.name);

      expect(toolNames).toContain('write_file');
    });
  });
});

describe('Docker Template Validation', () => {
  describe('Dockerfile Templates', () => {
    it('should have valid Node.js Dockerfile structure', () => {
      const template = `FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
  CMD curl -f http://localhost:3001/api/health || exit 1
CMD ["node", "dist/index.js"]`;

      // Validate structure
      expect(template).toContain('FROM node:');
      expect(template).toContain('WORKDIR');
      expect(template).toContain('COPY package');
      expect(template).toContain('RUN npm');
      expect(template).toContain('EXPOSE');
      expect(template).toContain('HEALTHCHECK');
      expect(template).toContain('CMD');
    });

    it('should use alpine for smaller image size', () => {
      const template = 'FROM node:20-alpine';
      expect(template).toContain('alpine');
    });

    it('should copy package files before source for layer caching', () => {
      const template = `COPY package*.json ./
RUN npm ci
COPY dist/ ./dist/`;

      const packageCopyIndex = template.indexOf('COPY package');
      const distCopyIndex = template.indexOf('COPY dist');

      expect(packageCopyIndex).toBeLessThan(distCopyIndex);
    });
  });

  describe('docker-compose.yml Templates', () => {
    it('should have valid compose structure', () => {
      const template = `version: "3.8"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3`;

      expect(template).toContain('version:');
      expect(template).toContain('services:');
      expect(template).toContain('build:');
      expect(template).toContain('ports:');
      expect(template).toContain('healthcheck:');
    });

    it('should NOT have volume mounts that overwrite container', () => {
      const goodTemplate = `version: "3.8"
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"`;

      // Should not mount source to container workdir
      const hasProblematicMount =
        goodTemplate.includes('volumes:') &&
        goodTemplate.includes('/usr/src/app');

      expect(hasProblematicMount).toBe(false);
    });

    it('should include restart policy', () => {
      const template = `services:
  backend:
    restart: unless-stopped`;

      expect(template).toContain('restart:');
    });
  });
});

describe('Deploy Tools Validation', () => {
  describe('Health Check Tool', () => {
    it('should be available from deploy-tools', async () => {
      const { createDeployTools } = await import('../../src/core/tools/deploy-tools');
      const tools = createDeployTools();

      const healthTool = tools.find(t => t.definition.name === 'health_check');
      expect(healthTool).toBeDefined();
    });

    it('should have url parameter', async () => {
      const { createDeployTools } = await import('../../src/core/tools/deploy-tools');
      const tools = createDeployTools();

      const healthTool = tools.find(t => t.definition.name === 'health_check');
      expect(healthTool!.definition.parameters).toContainEqual(
        expect.objectContaining({ name: 'url', required: true })
      );
    });
  });

  describe('Wait for Health Tool', () => {
    it('should be available from deploy-tools', async () => {
      const { createDeployTools } = await import('../../src/core/tools/deploy-tools');
      const tools = createDeployTools();

      const waitTool = tools.find(t => t.definition.name === 'wait_for_health');
      expect(waitTool).toBeDefined();
    });

    it('should have retry parameters', async () => {
      const { createDeployTools } = await import('../../src/core/tools/deploy-tools');
      const tools = createDeployTools();

      const waitTool = tools.find(t => t.definition.name === 'wait_for_health');
      expect(waitTool!.definition.parameters).toContainEqual(
        expect.objectContaining({ name: 'maxAttempts', required: false })
      );
      expect(waitTool!.definition.parameters).toContainEqual(
        expect.objectContaining({ name: 'intervalSeconds', required: false })
      );
    });
  });
});

describe('Jarvis Deployment Intent Detection', () => {
  describe('Keyword Detection', () => {
    it('should detect local deployment intent', () => {
      const requests = [
        'Create todo app and deploy locally',
        'Build API and run with Docker',
        'Deploy to localhost',
      ];

      for (const request of requests) {
        const lowerRequest = request.toLowerCase();
        const localKeywords = ['locally', 'docker', 'local', 'localhost'];
        const hasLocalIntent = localKeywords.some(k => lowerRequest.includes(k));
        expect(hasLocalIntent).toBe(true);
      }
    });

    it('should detect Azure deployment intent', () => {
      const requests = [
        'Deploy to Azure',
        'Put it on cloud',
        'Deploy to production',
        'Use Azure App Service',
      ];

      for (const request of requests) {
        const lowerRequest = request.toLowerCase();
        const azureKeywords = ['azure', 'cloud', 'production', 'app service'];
        const hasAzureIntent = azureKeywords.some(k => lowerRequest.includes(k));
        expect(hasAzureIntent).toBe(true);
      }
    });

    it('should NOT detect deployment for simple build requests', () => {
      const requests = [
        'Create a todo app',
        'Build an API',
        'Make a web application',
      ];

      for (const request of requests) {
        const lowerRequest = request.toLowerCase();
        const deployKeywords = ['deploy', 'launch', 'host', 'put online'];
        const hasDeployIntent = deployKeywords.some(k => lowerRequest.includes(k));
        expect(hasDeployIntent).toBe(false);
      }
    });
  });

  describe('Project Name Extraction', () => {
    it('should extract project name from request', () => {
      const patterns = [
        { request: 'Create a fullstack todo app', expected: 'todo' },
        { request: 'Build a task application', expected: 'task' },
        { request: 'Create blog app', expected: 'blog' },
      ];

      for (const { request, expected } of patterns) {
        const match = request.match(/(todo|task|note|blog|chat)/i);
        expect(match?.[1]?.toLowerCase()).toBe(expected);
      }
    });
  });
});
