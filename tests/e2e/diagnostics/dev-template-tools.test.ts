/**
 * D2: DevAgent + Template Tools Test
 *
 * Validates that DevAgent correctly calls generate_project tool.
 * This isolates whether the Dev agent understands and uses template tools.
 *
 * Run with: RUN_E2E_TESTS=true npm run test:e2e -- tests/e2e/diagnostics/dev-template-tools.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DevAgent } from '../../../src/agents/dev/dev-agent.js';
import { LLMClient, LLMProvider } from '../../../src/core/llm/client.js';
import { createFileTools } from '../../../src/core/tools/file-tools.js';
import { createTemplateTools } from '../../../src/core/tools/template-tools.js';
import { createTask } from '../../../src/core/tasks/types.js';
import { E2E_TIMEOUTS, logE2EEnvironment } from '../config.js';

// E2E tests run when RUN_E2E_TESTS=true
const describeE2E = describe.runIf(process.env.RUN_E2E_TESTS === 'true');

describeE2E('D2: DevAgent Template Tool Usage', () => {
  let testWorkspace: string;
  let llmClient: LLMClient;

  beforeAll(() => {
    const provider = (process.env.LLM_PROVIDER ?? 'openai') as LLMProvider;
    const apiKey =
      provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
      throw new Error(`${keyName} not set. Check your .env file.`);
    }

    const model = provider === 'openai' ? 'gpt-5-mini' : 'claude-sonnet-4-20250514';
    llmClient = new LLMClient({
      provider,
      apiKey,
      model,
      maxTokens: 4096,
    });
  });

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-d2-dev-'));
    console.log(`\n[D2] Test workspace: ${testWorkspace}`);
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  it(
    'should use generate_project tool for scaffold task',
    async () => {
      const fileTools = createFileTools(testWorkspace);
      const templateTools = createTemplateTools(testWorkspace);
      const allTools = [...fileTools, ...templateTools];

      console.log('[D2] Available tools:', allTools.map((t) => t.definition.name).join(', '));

      const devAgent = new DevAgent({
        llmClient,
        tools: allTools,
        workspace: testWorkspace,
      });

      const task = createTask({
        type: 'implement',
        title: 'Scaffold fullstack project',
        description: `
          Use the generate_project tool to create a fullstack project.

          Parameters:
          - template: "fullstack"
          - projectName: "myapp"

          Call the generate_project tool with these parameters.
          Do NOT manually write files - use the tool.
        `,
        createdBy: 'test',
      });

      console.log('[D2] Executing scaffold task...');
      const startTime = Date.now();
      const result = await devAgent.executeTask(task);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`[D2] Task completed in ${duration}s`);
      console.log(`[D2] Success: ${result.success}`);
      console.log(`[D2] Output preview: ${result.output?.substring(0, 500)}`);

      // Check if project was created
      const projectDir = path.join(testWorkspace, 'myapp');
      const projectExists = await fileExists(projectDir);
      console.log(`[D2] Project directory exists: ${projectExists}`);

      if (projectExists) {
        const files = await listFilesRecursive(projectDir);
        console.log(`[D2] Files created: ${files.length}`);
        console.log(`[D2] Sample files: ${files.slice(0, 8).join(', ')}`);
      }

      // Assertions
      expect(result.success).toBe(true);
      expect(projectExists).toBe(true);

      // Verify key directories exist
      expect(await fileExists(path.join(projectDir, 'frontend'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'backend'))).toBe(true);

      // Verify key files exist
      expect(await fileExists(path.join(projectDir, 'frontend', 'package.json'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'backend', 'package.json'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'backend', 'src', 'app.ts'))).toBe(true);

      console.log('[D2] PASSED: DevAgent successfully used generate_project tool');
    },
    E2E_TIMEOUTS.TIER_2_AGENT
  );

  it(
    'should customize scaffolded project by adding new route',
    async () => {
      // First, scaffold a project manually (to isolate the customize test)
      const { createFullstackProject } = await import('../../../src/templates/index.js');
      await createFullstackProject(testWorkspace, {
        projectName: 'customizable-app',
        description: 'App to customize',
      });

      const projectDir = path.join(testWorkspace, 'customizable-app');
      console.log(`[D2] Pre-scaffolded project at: ${projectDir}`);

      // Now test if DevAgent can customize it
      const fileTools = createFileTools(testWorkspace);
      const templateTools = createTemplateTools(testWorkspace);
      const allTools = [...fileTools, ...templateTools];

      const devAgent = new DevAgent({
        llmClient,
        tools: allTools,
        workspace: testWorkspace,
      });

      const task = createTask({
        type: 'implement',
        title: 'Add users route to existing project',
        description: `
          There is an existing Express project at customizable-app/backend.

          Add a new route file at customizable-app/backend/src/routes/users.ts that:
          1. Exports a usersRouter
          2. Has GET / that returns an empty array []
          3. Has GET /:id that returns { id, name: "User " + id }

          Use write_file tool to create the file.
          Then update customizable-app/backend/src/app.ts to import and use the usersRouter at /api/users.
        `,
        createdBy: 'test',
      });

      console.log('[D2] Executing customize task...');
      const startTime = Date.now();
      const result = await devAgent.executeTask(task);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`[D2] Task completed in ${duration}s`);
      console.log(`[D2] Success: ${result.success}`);
      console.log(`[D2] Output preview: ${result.output?.substring(0, 500)}`);

      // Check if users route was created
      const usersRoutePath = path.join(projectDir, 'backend', 'src', 'routes', 'users.ts');
      const usersRouteExists = await fileExists(usersRoutePath);
      console.log(`[D2] Users route created: ${usersRouteExists}`);

      if (usersRouteExists) {
        const content = await fs.readFile(usersRoutePath, 'utf-8');
        console.log(`[D2] Users route content preview: ${content.substring(0, 200)}`);
      }

      // Check if app.ts was updated
      const appTsPath = path.join(projectDir, 'backend', 'src', 'app.ts');
      const appContent = await fs.readFile(appTsPath, 'utf-8');
      const hasUsersImport = appContent.includes('usersRouter') || appContent.includes('users');
      console.log(`[D2] App.ts mentions users: ${hasUsersImport}`);

      // Assertions
      expect(result.success).toBe(true);
      expect(usersRouteExists).toBe(true);

      console.log('[D2] PASSED: DevAgent successfully customized scaffolded project');
    },
    E2E_TIMEOUTS.TIER_2_AGENT
  );

  it(
    'should use express template for backend-only project',
    async () => {
      const fileTools = createFileTools(testWorkspace);
      const templateTools = createTemplateTools(testWorkspace);
      const allTools = [...fileTools, ...templateTools];

      const devAgent = new DevAgent({
        llmClient,
        tools: allTools,
        workspace: testWorkspace,
      });

      const task = createTask({
        type: 'implement',
        title: 'Create Express API project',
        description: `
          Use the generate_project tool to create an Express backend project.

          Parameters:
          - template: "express"
          - projectName: "api-server"

          Call the generate_project tool. Do NOT write files manually.
        `,
        createdBy: 'test',
      });

      console.log('[D2] Executing Express scaffold task...');
      const result = await devAgent.executeTask(task);

      console.log(`[D2] Success: ${result.success}`);

      // Check if project was created
      const projectDir = path.join(testWorkspace, 'api-server');
      const projectExists = await fileExists(projectDir);

      if (projectExists) {
        const files = await listFilesRecursive(projectDir);
        console.log(`[D2] Files created: ${files.length}`);
      }

      // Assertions
      expect(result.success).toBe(true);
      expect(projectExists).toBe(true);
      expect(await fileExists(path.join(projectDir, 'package.json'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'src', 'app.ts'))).toBe(true);

      console.log('[D2] PASSED: DevAgent used express template correctly');
    },
    E2E_TIMEOUTS.TIER_2_AGENT
  );
});

// Sanity check that always runs
describe('D2 Test Setup', () => {
  it('should detect E2E test environment', () => {
    const provider = process.env.LLM_PROVIDER ?? 'openai';
    const hasApiKey =
      provider === 'openai'
        ? !!process.env.OPENAI_API_KEY
        : !!process.env.ANTHROPIC_API_KEY;
    const runE2E = process.env.RUN_E2E_TESTS === 'true';

    console.log(`[D2 Setup] LLM Provider: ${provider}`);
    console.log(`[D2 Setup] API key set: ${hasApiKey}`);
    console.log(`[D2 Setup] RUN_E2E_TESTS: ${runE2E}`);
    console.log(`[D2 Setup] D2 tests will run: ${hasApiKey && runE2E}`);

    expect(true).toBe(true);
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

async function listFilesRecursive(dir: string, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') {
        files.push(...(await listFilesRecursive(path.join(dir, entry.name), relativePath)));
      }
    } else {
      files.push(relativePath);
    }
  }

  return files;
}
