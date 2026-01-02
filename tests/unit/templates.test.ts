/**
 * Template System Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  TemplateService,
  createReactTemplate,
  createExpressTemplate,
  createFullstackProject,
} from '../../src/templates/index.js';

describe('React Template', () => {
  it('should create a React template with correct structure', () => {
    const template = createReactTemplate({
      projectName: 'my-app',
      description: 'My App',
    });

    expect(template.name).toBe('my-app');
    expect(template.category).toBe('frontend');
    expect(template.dependencies).toHaveProperty('react');
    expect(template.dependencies).toHaveProperty('react-dom');
    expect(template.devDependencies).toHaveProperty('typescript');
    expect(template.devDependencies).toHaveProperty('vite');
  });

  it('should include essential files', () => {
    const template = createReactTemplate({
      projectName: 'my-app',
    });

    const filePaths = template.files.map((f) => f.path);

    expect(filePaths).toContain('package.json');
    expect(filePaths).toContain('tsconfig.json');
    expect(filePaths).toContain('vite.config.ts');
    expect(filePaths).toContain('index.html');
    expect(filePaths).toContain('src/main.tsx');
    expect(filePaths).toContain('src/App.tsx');
    expect(filePaths).toContain('src/App.test.tsx');
  });

  it('should use project name in content', () => {
    const template = createReactTemplate({
      projectName: 'my-custom-app',
    });

    const appFile = template.files.find((f) => f.path === 'src/App.tsx');
    expect(appFile?.content).toContain('my-custom-app');
  });

  it('should include test setup', () => {
    const template = createReactTemplate({
      projectName: 'my-app',
    });

    const setupFile = template.files.find((f) => f.path === 'src/test/setup.ts');
    expect(setupFile).toBeDefined();
    expect(setupFile?.content).toContain('@testing-library/jest-dom');
  });
});

describe('Express Template', () => {
  it('should create an Express template with correct structure', () => {
    const template = createExpressTemplate({
      projectName: 'my-api',
      description: 'My API',
    });

    expect(template.name).toBe('my-api');
    expect(template.category).toBe('backend');
    expect(template.dependencies).toHaveProperty('express');
    expect(template.dependencies).toHaveProperty('cors');
    expect(template.dependencies).toHaveProperty('helmet');
    expect(template.devDependencies).toHaveProperty('typescript');
    expect(template.devDependencies).toHaveProperty('tsx');
  });

  it('should include essential files', () => {
    const template = createExpressTemplate({
      projectName: 'my-api',
    });

    const filePaths = template.files.map((f) => f.path);

    expect(filePaths).toContain('package.json');
    expect(filePaths).toContain('tsconfig.json');
    expect(filePaths).toContain('vitest.config.ts');
    expect(filePaths).toContain('src/server.ts');
    expect(filePaths).toContain('src/app.ts');
    expect(filePaths).toContain('src/routes/health.ts');
    expect(filePaths).toContain('src/middleware/error-handler.ts');
    expect(filePaths).toContain('tests/health.test.ts');
  });

  it('should include security middleware', () => {
    const template = createExpressTemplate({
      projectName: 'my-api',
    });

    const appFile = template.files.find((f) => f.path === 'src/app.ts');
    expect(appFile?.content).toContain('helmet');
    expect(appFile?.content).toContain('cors');
  });

  it('should include type definitions', () => {
    const template = createExpressTemplate({
      projectName: 'my-api',
    });

    const typesFile = template.files.find((f) => f.path === 'src/types/index.ts');
    expect(typesFile).toBeDefined();
    expect(typesFile?.content).toContain('ApiResponse');
    expect(typesFile?.content).toContain('PaginatedResponse');
  });
});

describe('TemplateService', () => {
  let testDir: string;
  let service: TemplateService;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-template-test-'));
    service = new TemplateService(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('getAvailableTemplates', () => {
    it('should list available templates', () => {
      const templates = service.getAvailableTemplates();

      expect(templates).toContainEqual({ name: 'react', category: 'frontend' });
      expect(templates).toContainEqual({ name: 'express', category: 'backend' });
    });
  });

  describe('hasTemplate', () => {
    it('should return true for existing templates', () => {
      expect(service.hasTemplate('react')).toBe(true);
      expect(service.hasTemplate('express')).toBe(true);
    });

    it('should return false for non-existing templates', () => {
      expect(service.hasTemplate('unknown')).toBe(false);
    });
  });

  describe('preview', () => {
    it('should return template without writing files', () => {
      const template = service.preview('react', { projectName: 'preview-app' });

      expect(template).toBeDefined();
      expect(template?.name).toBe('preview-app');
      expect(template?.files.length).toBeGreaterThan(0);
    });

    it('should return null for unknown template', () => {
      const template = service.preview('unknown', { projectName: 'test' });
      expect(template).toBeNull();
    });
  });

  describe('generate', () => {
    it('should generate a React project', async () => {
      const result = await service.generate('react', {
        projectName: 'test-react-app',
      });

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('src/App.tsx');

      // Verify files exist on disk
      const packagePath = path.join(testDir, 'test-react-app', 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const pkg = JSON.parse(packageContent);

      expect(pkg.name).toBe('test-react-app');
      expect(pkg.dependencies).toHaveProperty('react');
    });

    it('should generate an Express project', async () => {
      const result = await service.generate('express', {
        projectName: 'test-express-api',
      });

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('src/app.ts');
      expect(result.filesCreated).toContain('src/server.ts');

      // Verify files exist on disk
      const serverPath = path.join(testDir, 'test-express-api', 'src', 'server.ts');
      const exists = await fs.access(serverPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should fail for unknown template', async () => {
      const result = await service.generate('unknown', {
        projectName: 'test-app',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should create nested directories', async () => {
      const result = await service.generate('express', {
        projectName: 'nested-test',
      });

      expect(result.success).toBe(true);

      // Check nested directory was created
      const routesPath = path.join(testDir, 'nested-test', 'src', 'routes');
      const exists = await fs.access(routesPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });
});

describe('createFullstackProject', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-fullstack-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create both frontend and backend projects', async () => {
    const result = await createFullstackProject(testDir, {
      projectName: 'my-fullstack',
      description: 'Full Stack App',
    });

    expect(result.success).toBe(true);

    // Check frontend was created in frontend/ subdirectory
    expect(result.filesCreated.some((f) => f.startsWith('frontend/'))).toBe(true);
    expect(result.filesCreated.some((f) => f.includes('App.tsx'))).toBe(true);

    // Check backend was created in backend/ subdirectory
    expect(result.filesCreated.some((f) => f.startsWith('backend/'))).toBe(true);
    expect(result.filesCreated.some((f) => f.includes('index.ts'))).toBe(true);

    // Check root README was created
    expect(result.filesCreated.some((f) => f === 'README.md')).toBe(true);

    // Verify directories exist (project/frontend and project/backend structure)
    const frontendExists = await fs.access(path.join(testDir, 'my-fullstack', 'frontend')).then(() => true).catch(() => false);
    const backendExists = await fs.access(path.join(testDir, 'my-fullstack', 'backend')).then(() => true).catch(() => false);
    const readmeExists = await fs.access(path.join(testDir, 'my-fullstack', 'README.md')).then(() => true).catch(() => false);

    expect(frontendExists).toBe(true);
    expect(backendExists).toBe(true);
    expect(readmeExists).toBe(true);
  });
});
