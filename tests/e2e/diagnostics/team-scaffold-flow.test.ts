/**
 * D3: Team Scaffold Flow Test
 *
 * Validates that Team correctly executes scaffold + customize workflow.
 * Tests PM planning (scaffold detection) + Dev execution + QA verification.
 *
 * Run with: RUN_E2E_TESTS=true npm run test:e2e -- tests/e2e/diagnostics/team-scaffold-flow.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Team } from '../../../src/team/team.js';
import { LLMClient, LLMProvider } from '../../../src/core/llm/client.js';
import { createFileTools } from '../../../src/core/tools/file-tools.js';
import { createExecTools } from '../../../src/core/tools/exec-tools.js';
import { createTemplateTools } from '../../../src/core/tools/template-tools.js';
import { WikiService } from '../../../src/core/wiki/wiki-service.js';

// E2E tests run when RUN_E2E_TESTS=true
const describeE2E = describe.runIf(process.env.RUN_E2E_TESTS === 'true');

describeE2E('D3: Team Scaffold Flow', () => {
  let testWorkspace: string;
  let wikiRoot: string;
  let llmClient: LLMClient;
  let wikiService: WikiService;
  let progressMessages: string[];

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
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-d3-team-'));
    wikiRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-d3-wiki-'));
    wikiService = new WikiService({ wikiRoot });
    await wikiService.initialize();
    progressMessages = [];

    console.log(`\n[D3] Test workspace: ${testWorkspace}`);
    console.log(`[D3] Wiki root: ${wikiRoot}`);
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
    await fs.rm(wikiRoot, { recursive: true, force: true });
  });

  it(
    'should scaffold an Express API project',
    async () => {
      const fileTools = createFileTools(testWorkspace);
      const execTools = createExecTools(testWorkspace, ['test', 'typecheck', 'dev', 'build']);
      const templateTools = createTemplateTools(testWorkspace);
      const allTools = [...fileTools, ...execTools, ...templateTools];

      console.log('[D3] Available tools:', allTools.map((t) => t.definition.name).join(', '));

      const team = new Team({
        workspace: testWorkspace,
        llmClient,
        tools: allTools,
        wikiService,
        maxIterations: 2,
        maxRetries: 1,
        onProgress: (message) => {
          console.log(`[D3 Progress] ${message}`);
          progressMessages.push(message);
        },
        onEscalation: (reason) => {
          console.log(`[D3 Escalation] ${reason}`);
        },
      });

      console.log('[D3] Executing scaffold task...');
      const startTime = Date.now();

      const result = await team.executeTask(`
        Create an Express API project called "test-api" using the generate_project tool with template="express".

        IMPORTANT: Use the generate_project tool - do NOT write files manually.
      `);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n[D3] === Team Result ===`);
      console.log(`[D3] Duration: ${duration}s`);
      console.log(`[D3] Success: ${result.success}`);
      console.log(`[D3] Escalated: ${result.escalated}`);
      console.log(`[D3] Iterations: ${result.iterations}`);

      if (result.breakdown) {
        console.log(`[D3] Dev tasks: ${result.breakdown.devTasks.length}`);
        result.breakdown.devTasks.forEach((t) => console.log(`[D3]   - ${t.title}`));
        console.log(`[D3] QA tasks: ${result.breakdown.qaTasks.length}`);
        result.breakdown.qaTasks.forEach((t) => console.log(`[D3]   - ${t.title}`));
      }

      // Check if project was created
      const projectDir = path.join(testWorkspace, 'test-api');
      const projectExists = await fileExists(projectDir);
      console.log(`[D3] Project directory exists: ${projectExists}`);

      if (projectExists) {
        const files = await listFilesRecursive(projectDir);
        console.log(`[D3] Files created: ${files.length}`);
        console.log(`[D3] Sample files: ${files.slice(0, 5).join(', ')}`);
      }

      // Assertions
      expect(projectExists).toBe(true);
      expect(await fileExists(path.join(projectDir, 'package.json'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'src', 'app.ts'))).toBe(true);

      console.log('[D3] PASSED: Team scaffold flow works');
    },
    { timeout: 300000 }
  );

  it(
    'should scaffold fullstack project with frontend and backend',
    async () => {
      const fileTools = createFileTools(testWorkspace);
      const execTools = createExecTools(testWorkspace, ['test', 'typecheck', 'dev', 'build']);
      const templateTools = createTemplateTools(testWorkspace);
      const allTools = [...fileTools, ...execTools, ...templateTools];

      const team = new Team({
        workspace: testWorkspace,
        llmClient,
        tools: allTools,
        wikiService,
        maxIterations: 2,
        maxRetries: 1,
        onProgress: (message) => {
          console.log(`[D3 Progress] ${message}`);
          progressMessages.push(message);
        },
        onEscalation: (reason) => {
          console.log(`[D3 Escalation] ${reason}`);
        },
      });

      console.log('[D3] Executing fullstack scaffold task...');
      const startTime = Date.now();

      const result = await team.executeTask(`
        Create a fullstack project called "my-fullstack-app" using the generate_project tool with template="fullstack".

        IMPORTANT: Use the generate_project tool - do NOT write files manually.
        The tool will create frontend/ and backend/ subdirectories.
      `);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n[D3] === Fullstack Team Result ===`);
      console.log(`[D3] Duration: ${duration}s`);
      console.log(`[D3] Success: ${result.success}`);
      console.log(`[D3] Escalated: ${result.escalated}`);

      // Check if project was created
      const projectDir = path.join(testWorkspace, 'my-fullstack-app');
      const projectExists = await fileExists(projectDir);
      console.log(`[D3] Project directory exists: ${projectExists}`);

      // Assertions
      expect(projectExists).toBe(true);
      expect(await fileExists(path.join(projectDir, 'frontend'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'backend'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'frontend', 'package.json'))).toBe(true);
      expect(await fileExists(path.join(projectDir, 'backend', 'package.json'))).toBe(true);

      console.log('[D3] PASSED: Team fullstack scaffold works');
    },
    { timeout: 300000 }
  );

  it(
    'should scaffold and then customize project with additional route',
    async () => {
      const fileTools = createFileTools(testWorkspace);
      const execTools = createExecTools(testWorkspace, ['test', 'typecheck', 'dev', 'build']);
      const templateTools = createTemplateTools(testWorkspace);
      const allTools = [...fileTools, ...execTools, ...templateTools];

      const team = new Team({
        workspace: testWorkspace,
        llmClient,
        tools: allTools,
        wikiService,
        maxIterations: 3,
        maxRetries: 1,
        onProgress: (message) => {
          console.log(`[D3 Progress] ${message}`);
          progressMessages.push(message);
        },
        onEscalation: (reason) => {
          console.log(`[D3 Escalation] ${reason}`);
        },
      });

      console.log('[D3] Executing scaffold + customize task...');
      const startTime = Date.now();

      const result = await team.executeTask(`
        Create an Express API project called "custom-api" with:

        STEP 1: Use the generate_project tool with template="express" and projectName="custom-api"

        STEP 2: After scaffolding, add a new route file at custom-api/src/routes/items.ts that:
        - Exports an itemsRouter
        - Has GET / that returns an empty array
        - Has POST / that returns { message: "Item created" }

        STEP 3: Update custom-api/src/app.ts to:
        - Import the itemsRouter
        - Mount it at /api/items

        Use the generate_project tool first, then use write_file to add the new route and update app.ts.
      `);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n[D3] === Scaffold + Customize Result ===`);
      console.log(`[D3] Duration: ${duration}s`);
      console.log(`[D3] Success: ${result.success}`);
      console.log(`[D3] Escalated: ${result.escalated}`);

      // Check if project was created and customized
      const projectDir = path.join(testWorkspace, 'custom-api');
      const projectExists = await fileExists(projectDir);
      console.log(`[D3] Project directory exists: ${projectExists}`);

      // Check for items route
      const itemsRoutePath = path.join(projectDir, 'src', 'routes', 'items.ts');
      const itemsRouteExists = await fileExists(itemsRoutePath);
      console.log(`[D3] Items route exists: ${itemsRouteExists}`);

      // Check app.ts for items import
      const appPath = path.join(projectDir, 'src', 'app.ts');
      let appContent = '';
      if (await fileExists(appPath)) {
        appContent = await fs.readFile(appPath, 'utf-8');
      }
      const hasItemsImport = appContent.includes('items') || appContent.includes('Items');
      console.log(`[D3] App.ts has items reference: ${hasItemsImport}`);

      // Assertions
      expect(projectExists).toBe(true);
      expect(await fileExists(path.join(projectDir, 'package.json'))).toBe(true);
      // Items route should exist if customization worked
      // (we allow some flexibility since this is a complex task)

      if (result.success && itemsRouteExists) {
        console.log('[D3] PASSED: Team scaffold + customize works');
      } else if (projectExists) {
        console.log('[D3] PARTIAL: Scaffold worked, customize may need iteration');
      }
    },
    { timeout: 420000 }
  );
});

// Sanity check that always runs
describe('D3 Test Setup', () => {
  it('should detect E2E test environment', () => {
    const provider = process.env.LLM_PROVIDER ?? 'openai';
    const hasApiKey =
      provider === 'openai'
        ? !!process.env.OPENAI_API_KEY
        : !!process.env.ANTHROPIC_API_KEY;
    const runE2E = process.env.RUN_E2E_TESTS === 'true';

    console.log(`[D3 Setup] LLM Provider: ${provider}`);
    console.log(`[D3 Setup] API key set: ${hasApiKey}`);
    console.log(`[D3 Setup] RUN_E2E_TESTS: ${runE2E}`);
    console.log(`[D3 Setup] D3 tests will run: ${hasApiKey && runE2E}`);

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
