/**
 * D1: Template Output Validation
 *
 * Validates that templates generate correct file structure WITHOUT LLM.
 * This is the foundation - if templates are broken, nothing else will work.
 *
 * Run with: npm test -- tests/e2e/diagnostics/template-output.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  TemplateService,
  createFullstackProject,
  createExpressTemplate,
  createReactTemplate,
} from '../../../src/templates/index.js';

describe('D1: Template Output Validation', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-d1-template-'));
    console.log(`\n[D1] Test directory: ${testDir}`);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Express Template', () => {
    it('should generate correct file structure', async () => {
      const service = new TemplateService(testDir);
      const result = await service.generate('express', {
        projectName: 'test-api',
        description: 'Test API project',
      });

      console.log(`[D1] Express template result: ${result.success}`);
      console.log(`[D1] Files created: ${result.filesCreated.length}`);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('tsconfig.json');
      expect(result.filesCreated).toContain('src/index.ts');
      expect(result.filesCreated).toContain('src/app.ts');
      expect(result.filesCreated).toContain('src/routes/health.ts');

      // Verify files actually exist
      const projectDir = path.join(testDir, 'test-api');
      expect(await fileExists(path.join(projectDir, 'package.json'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'src/app.ts'))).toBe(true);
    });

    it('should have /api/health endpoint path (not /health)', async () => {
      const template = createExpressTemplate({
        projectName: 'test-api',
        description: 'Test API',
      });

      // Find app.ts content
      const appFile = template.files.find((f) => f.path === 'src/app.ts');
      expect(appFile).toBeDefined();

      // CRITICAL: Verify the health endpoint is mounted at /api/health
      // The benchmark test's startServer() helper polls /api/health
      expect(appFile?.content).toContain("app.use('/api/health', healthRouter)");
      expect(appFile?.content).not.toContain("app.use('/health', healthRouter)");

      console.log('[D1] Health endpoint path: /api/health (CORRECT)');
    });

    it('should generate health test with correct endpoint path', async () => {
      const template = createExpressTemplate({
        projectName: 'test-api',
        description: 'Test API',
      });

      // Find health test content
      const testFile = template.files.find((f) => f.path === 'tests/health.test.ts');
      expect(testFile).toBeDefined();

      // Test must use /api/health path
      expect(testFile?.content).toContain(".get('/api/health')");
      expect(testFile?.content).not.toContain(".get('/health')");

      console.log('[D1] Health test endpoint path: /api/health (CORRECT)');
    });

    it('should have tsconfig that includes test files', async () => {
      const template = createExpressTemplate({
        projectName: 'test-api',
        description: 'Test API',
      });

      const tsconfigFile = template.files.find((f) => f.path === 'tsconfig.json');
      expect(tsconfigFile).toBeDefined();

      const tsconfig = JSON.parse(tsconfigFile!.content);

      // Should NOT exclude test files
      const excludes = tsconfig.exclude || [];
      const excludesTestFiles = excludes.some((e: string) => e.includes('.test.ts'));

      expect(excludesTestFiles).toBe(false);
      console.log('[D1] tsconfig excludes test files: NO (CORRECT)');
    });
  });

  describe('React Template', () => {
    it('should generate correct file structure', async () => {
      const service = new TemplateService(testDir);
      const result = await service.generate('react', {
        projectName: 'test-frontend',
        description: 'Test frontend project',
      });

      console.log(`[D1] React template result: ${result.success}`);
      console.log(`[D1] Files created: ${result.filesCreated.length}`);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('tsconfig.json');
      expect(result.filesCreated).toContain('src/App.tsx');
      expect(result.filesCreated).toContain('src/main.tsx');
      expect(result.filesCreated).toContain('index.html');
    });

    it('should have App.tsx with correct boilerplate', async () => {
      const template = createReactTemplate({
        projectName: 'test-frontend',
        description: 'Test frontend',
      });

      const appFile = template.files.find((f) => f.path === 'src/App.tsx');
      expect(appFile).toBeDefined();

      // Should have React imports
      expect(appFile?.content).toContain('import');
      expect(appFile?.content).toContain('useState');

      console.log('[D1] App.tsx has React imports: YES (CORRECT)');
    });
  });

  describe('Fullstack Template', () => {
    it('should create frontend/ and backend/ subdirectories', async () => {
      const result = await createFullstackProject(testDir, {
        projectName: 'test-fullstack',
        description: 'Test fullstack app',
      });

      console.log(`[D1] Fullstack template result: ${result.success}`);
      console.log(`[D1] Files created: ${result.filesCreated.length}`);
      console.log(`[D1] Sample files: ${result.filesCreated.slice(0, 5).join(', ')}`);

      expect(result.success).toBe(true);

      // Should have frontend files
      const frontendFiles = result.filesCreated.filter((f) => f.startsWith('frontend/'));
      expect(frontendFiles.length).toBeGreaterThan(0);
      expect(frontendFiles).toContain('frontend/package.json');
      expect(frontendFiles).toContain('frontend/src/App.tsx');

      // Should have backend files
      const backendFiles = result.filesCreated.filter((f) => f.startsWith('backend/'));
      expect(backendFiles.length).toBeGreaterThan(0);
      expect(backendFiles).toContain('backend/package.json');
      expect(backendFiles).toContain('backend/src/app.ts');

      // Should have root README
      expect(result.filesCreated).toContain('README.md');

      console.log(`[D1] Frontend files: ${frontendFiles.length}`);
      console.log(`[D1] Backend files: ${backendFiles.length}`);
    });

    it('should create correct directory structure on disk', async () => {
      await createFullstackProject(testDir, {
        projectName: 'test-fullstack',
        description: 'Test fullstack app',
      });

      const projectDir = path.join(testDir, 'test-fullstack');

      // Verify directory structure
      expect(await fileExists(projectDir)).toBe(true);
      expect(await fileExists(path.join(projectDir, 'frontend'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'backend'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'README.md'))).toBe(true);

      // Verify key files
      expect(await fileExists(path.join(projectDir, 'frontend', 'package.json'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'frontend', 'src', 'App.tsx'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'backend', 'package.json'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'backend', 'src', 'app.ts'))).toBe(true);

      console.log('[D1] Fullstack directory structure: CORRECT');
    });

    it('backend should have health endpoint at /api/health', async () => {
      await createFullstackProject(testDir, {
        projectName: 'test-fullstack',
        description: 'Test fullstack app',
      });

      const appTsPath = path.join(testDir, 'test-fullstack', 'backend', 'src', 'app.ts');
      const appContent = await fs.readFile(appTsPath, 'utf-8');

      // CRITICAL: Health endpoint must be at /api/health for benchmark
      expect(appContent).toContain("app.use('/api/health', healthRouter)");

      console.log('[D1] Fullstack backend health endpoint: /api/health (CORRECT)');
    });
  });
});

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
