/**
 * Deployment Template Tools Unit Tests
 *
 * Tests for the generate_deployment and generate_fullstack_deployment tools.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import {
  GenerateDeploymentTool,
  GenerateFullstackDeploymentTool,
  createDeploymentTemplateTools,
} from '../../src/core/tools/deployment-template-tools';

describe('Deployment Template Tools', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    // Create a temporary workspace
    testWorkspace = path.join(tmpdir(), `acia-deployment-test-${Date.now()}`);
    await fs.mkdir(testWorkspace, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  describe('GenerateDeploymentTool', () => {
    describe('Tool Definition', () => {
      it('should have correct tool name', () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        expect(tool.definition.name).toBe('generate_deployment');
      });

      it('should have descriptive description', () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        expect(tool.definition.description).toContain('Docker deployment files');
        expect(tool.definition.description).toContain('templates');
      });

      it('should have projectPath as required parameter', () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const projectPathParam = tool.definition.parameters.find(
          (p) => p.name === 'projectPath'
        );
        expect(projectPathParam).toBeDefined();
        expect(projectPathParam?.required).toBe(true);
        expect(projectPathParam?.type).toBe('string');
      });

      it('should have port as required parameter', () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const portParam = tool.definition.parameters.find((p) => p.name === 'port');
        expect(portParam).toBeDefined();
        expect(portParam?.required).toBe(true);
        expect(portParam?.type).toBe('number');
      });

      it('should have healthPath as optional parameter', () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const healthParam = tool.definition.parameters.find(
          (p) => p.name === 'healthPath'
        );
        expect(healthParam).toBeDefined();
        expect(healthParam?.required).toBe(false);
      });

      it('should have includeBuildStep as optional parameter', () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const buildParam = tool.definition.parameters.find(
          (p) => p.name === 'includeBuildStep'
        );
        expect(buildParam).toBeDefined();
        expect(buildParam?.required).toBe(false);
        expect(buildParam?.type).toBe('boolean');
      });

      it('should be available to devops role', () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        expect(tool.roles).toContain('devops');
      });

      it('should be available to ops role', () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        expect(tool.roles).toContain('ops');
      });
    });

    describe('Parameter Validation', () => {
      it('should fail when projectPath is missing', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const result = await tool.execute({ port: 3001 });
        expect(result.success).toBe(false);
        expect(result.output).toContain('Missing required parameters');
      });

      it('should fail when port is missing', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const result = await tool.execute({ projectPath: 'test-project' });
        expect(result.success).toBe(false);
        expect(result.output).toContain('Missing required parameters');
      });

      it('should fail when port is invalid (negative)', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const result = await tool.execute({ projectPath: 'test-project', port: -1 });
        expect(result.success).toBe(false);
        expect(result.output).toContain('Port must be a number');
      });

      it('should fail when port is invalid (too high)', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const result = await tool.execute({
          projectPath: 'test-project',
          port: 70000,
        });
        expect(result.success).toBe(false);
        expect(result.output).toContain('Port must be a number');
      });

      it('should fail when project directory does not exist', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const result = await tool.execute({
          projectPath: 'non-existent-project',
          port: 3001,
        });
        expect(result.success).toBe(false);
        expect(result.output).toContain('Failed to generate deployment files');
      });
    });

    describe('File Generation', () => {
      beforeEach(async () => {
        // Create a mock project with package.json
        const projectDir = path.join(testWorkspace, 'backend');
        await fs.mkdir(projectDir, { recursive: true });
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({
            name: 'backend',
            main: 'dist/index.js',
            scripts: {
              start: 'node dist/index.js',
              build: 'tsc',
            },
          })
        );
      });

      it('should create Dockerfile', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const result = await tool.execute({ projectPath: 'backend', port: 3001 });

        expect(result.success).toBe(true);
        const dockerfilePath = path.join(testWorkspace, 'backend', 'Dockerfile');
        const content = await fs.readFile(dockerfilePath, 'utf-8');
        expect(content).toContain('FROM node:20-alpine');
      });

      it('should create .dockerignore', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const result = await tool.execute({ projectPath: 'backend', port: 3001 });

        expect(result.success).toBe(true);
        const dockerignorePath = path.join(testWorkspace, 'backend', '.dockerignore');
        const content = await fs.readFile(dockerignorePath, 'utf-8');
        expect(content).toContain('node_modules');
      });

      it('should create docker-compose.yml', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const result = await tool.execute({ projectPath: 'backend', port: 3001 });

        expect(result.success).toBe(true);
        const composePath = path.join(testWorkspace, 'backend', 'docker-compose.yml');
        const content = await fs.readFile(composePath, 'utf-8');
        expect(content).toContain('version: "3.8"');
        expect(content).toContain('services:');
      });

      it('should include build step in Dockerfile by default', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        await tool.execute({ projectPath: 'backend', port: 3001 });

        const dockerfilePath = path.join(testWorkspace, 'backend', 'Dockerfile');
        const content = await fs.readFile(dockerfilePath, 'utf-8');
        expect(content).toContain('AS builder');
        expect(content).toContain('npm run build');
      });

      it('should exclude build step when includeBuildStep is false', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        await tool.execute({
          projectPath: 'backend',
          port: 3001,
          includeBuildStep: false,
        });

        const dockerfilePath = path.join(testWorkspace, 'backend', 'Dockerfile');
        const content = await fs.readFile(dockerfilePath, 'utf-8');
        expect(content).not.toContain('AS builder');
        expect(content).not.toContain('npm run build');
      });

      it('should use custom health path', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        await tool.execute({
          projectPath: 'backend',
          port: 3001,
          healthPath: '/health',
        });

        const dockerfilePath = path.join(testWorkspace, 'backend', 'Dockerfile');
        const content = await fs.readFile(dockerfilePath, 'utf-8');
        expect(content).toContain('/health');
      });

      it('should use correct port in Dockerfile', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        await tool.execute({ projectPath: 'backend', port: 8080 });

        const dockerfilePath = path.join(testWorkspace, 'backend', 'Dockerfile');
        const content = await fs.readFile(dockerfilePath, 'utf-8');
        expect(content).toContain('EXPOSE 8080');
      });

      it('should use correct port in docker-compose.yml', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        await tool.execute({ projectPath: 'backend', port: 8080 });

        const composePath = path.join(testWorkspace, 'backend', 'docker-compose.yml');
        const content = await fs.readFile(composePath, 'utf-8');
        expect(content).toContain('"8080:8080"');
      });

      it('should detect entry point from package.json', async () => {
        // Update package.json with custom main
        const projectDir = path.join(testWorkspace, 'backend');
        await fs.writeFile(
          path.join(projectDir, 'package.json'),
          JSON.stringify({ name: 'backend', main: 'dist/server.js' })
        );

        const tool = new GenerateDeploymentTool(testWorkspace);
        await tool.execute({ projectPath: 'backend', port: 3001 });

        const dockerfilePath = path.join(projectDir, 'Dockerfile');
        const content = await fs.readFile(dockerfilePath, 'utf-8');
        expect(content).toContain('dist/server.js');
      });

      it('should NOT include problematic volume mounts', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        await tool.execute({ projectPath: 'backend', port: 3001 });

        const composePath = path.join(testWorkspace, 'backend', 'docker-compose.yml');
        const content = await fs.readFile(composePath, 'utf-8');
        // Should NOT have volume mounts that overwrite container files
        expect(content).not.toContain('volumes:');
        expect(content).not.toContain('/usr/src/app');
      });

      it('should return list of created files in output', async () => {
        const tool = new GenerateDeploymentTool(testWorkspace);
        const result = await tool.execute({ projectPath: 'backend', port: 3001 });

        expect(result.output).toContain('Dockerfile');
        expect(result.output).toContain('.dockerignore');
        expect(result.output).toContain('docker-compose.yml');
      });
    });
  });

  describe('GenerateFullstackDeploymentTool', () => {
    describe('Tool Definition', () => {
      it('should have correct tool name', () => {
        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        expect(tool.definition.name).toBe('generate_fullstack_deployment');
      });

      it('should have descriptive description', () => {
        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        expect(tool.definition.description).toContain('fullstack');
        expect(tool.definition.description).toContain('frontend');
        expect(tool.definition.description).toContain('backend');
      });

      it('should have projectPath as required parameter', () => {
        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        const projectPathParam = tool.definition.parameters.find(
          (p) => p.name === 'projectPath'
        );
        expect(projectPathParam).toBeDefined();
        expect(projectPathParam?.required).toBe(true);
      });

      it('should have port parameters as optional', () => {
        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        const backendPort = tool.definition.parameters.find(
          (p) => p.name === 'backendPort'
        );
        const frontendPort = tool.definition.parameters.find(
          (p) => p.name === 'frontendPort'
        );
        expect(backendPort?.required).toBe(false);
        expect(frontendPort?.required).toBe(false);
      });

      it('should be available to devops role', () => {
        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        expect(tool.roles).toContain('devops');
      });
    });

    describe('Fullstack File Generation', () => {
      beforeEach(async () => {
        // Create a mock fullstack project
        const projectDir = path.join(testWorkspace, 'todo-app');
        const backendDir = path.join(projectDir, 'backend');
        const frontendDir = path.join(projectDir, 'frontend');

        await fs.mkdir(backendDir, { recursive: true });
        await fs.mkdir(frontendDir, { recursive: true });

        await fs.writeFile(
          path.join(backendDir, 'package.json'),
          JSON.stringify({ name: 'backend', main: 'dist/index.js' })
        );
        await fs.writeFile(
          path.join(frontendDir, 'package.json'),
          JSON.stringify({ name: 'frontend' })
        );
      });

      it('should create backend Dockerfile', async () => {
        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        const result = await tool.execute({ projectPath: 'todo-app' });

        expect(result.success).toBe(true);
        const dockerfilePath = path.join(
          testWorkspace,
          'todo-app',
          'backend',
          'Dockerfile'
        );
        const content = await fs.readFile(dockerfilePath, 'utf-8');
        expect(content).toContain('FROM node:20-alpine');
      });

      it('should create frontend Dockerfile', async () => {
        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        await tool.execute({ projectPath: 'todo-app' });

        const dockerfilePath = path.join(
          testWorkspace,
          'todo-app',
          'frontend',
          'Dockerfile'
        );
        const content = await fs.readFile(dockerfilePath, 'utf-8');
        expect(content).toContain('nginx');
      });

      it('should create root docker-compose.yml', async () => {
        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        await tool.execute({ projectPath: 'todo-app' });

        const composePath = path.join(
          testWorkspace,
          'todo-app',
          'docker-compose.yml'
        );
        const content = await fs.readFile(composePath, 'utf-8');
        expect(content).toContain('backend:');
        expect(content).toContain('frontend:');
      });

      it('should use default ports (3001 backend, 3000 frontend)', async () => {
        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        await tool.execute({ projectPath: 'todo-app' });

        const composePath = path.join(
          testWorkspace,
          'todo-app',
          'docker-compose.yml'
        );
        const content = await fs.readFile(composePath, 'utf-8');
        expect(content).toContain('"3001:3001"');
        expect(content).toContain('"3000:3000"');
      });

      it('should use custom ports when specified', async () => {
        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        await tool.execute({
          projectPath: 'todo-app',
          backendPort: 8080,
          frontendPort: 80,
        });

        const composePath = path.join(
          testWorkspace,
          'todo-app',
          'docker-compose.yml'
        );
        const content = await fs.readFile(composePath, 'utf-8');
        expect(content).toContain('"8080:8080"');
        expect(content).toContain('"80:80"');
      });

      it('should fail when backend directory is missing', async () => {
        // Remove backend directory
        await fs.rm(path.join(testWorkspace, 'todo-app', 'backend'), {
          recursive: true,
        });

        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        const result = await tool.execute({ projectPath: 'todo-app' });

        expect(result.success).toBe(false);
      });

      it('should fail when frontend directory is missing', async () => {
        // Remove frontend directory
        await fs.rm(path.join(testWorkspace, 'todo-app', 'frontend'), {
          recursive: true,
        });

        const tool = new GenerateFullstackDeploymentTool(testWorkspace);
        const result = await tool.execute({ projectPath: 'todo-app' });

        expect(result.success).toBe(false);
      });
    });
  });

  describe('createDeploymentTemplateTools', () => {
    it('should return array of tools', () => {
      const tools = createDeploymentTemplateTools(testWorkspace);
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(2);
    });

    it('should include GenerateDeploymentTool', () => {
      const tools = createDeploymentTemplateTools(testWorkspace);
      const generateDeployment = tools.find(
        (t) => t.definition.name === 'generate_deployment'
      );
      expect(generateDeployment).toBeDefined();
    });

    it('should include GenerateFullstackDeploymentTool', () => {
      const tools = createDeploymentTemplateTools(testWorkspace);
      const generateFullstack = tools.find(
        (t) => t.definition.name === 'generate_fullstack_deployment'
      );
      expect(generateFullstack).toBeDefined();
    });
  });
});
