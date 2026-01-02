/**
 * E2E Tests for Team Workflow
 *
 * These tests use the REAL Anthropic API to validate the full workflow.
 * They are skipped by default unless ANTHROPIC_API_KEY is set and
 * RUN_E2E_TESTS=true is set.
 *
 * To run: RUN_E2E_TESTS=true npm run test:e2e
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Team } from '../../src/team/team.js';
import { LLMClient, LLMProvider } from '../../src/core/llm/client.js';
import { DevAgent } from '../../src/agents/dev/dev-agent.js';
import { createFileTools } from '../../src/core/tools/file-tools.js';
import { createTask } from '../../src/core/tasks/types.js';
import { WikiService } from '../../src/core/wiki/wiki-service.js';

// E2E tests run when RUN_E2E_TESTS=true
// API key is loaded from .env by tests/setup.ts
const describeE2E = describe.runIf(process.env.RUN_E2E_TESTS === 'true');

describeE2E('Single Agent E2E (Real LLM)', () => {
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
      maxTokens: 2048,
    });
  });

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-e2e-'));
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  it(
    'DevAgent should create a simple file when asked',
    async () => {
      const fileTools = createFileTools(testWorkspace);

      const devAgent = new DevAgent({
        llmClient,
        tools: fileTools,
        workspace: testWorkspace,
      });

      const task = createTask({
        type: 'implement',
        title: 'Create greeting.ts',
        description:
          'Create a file called greeting.ts with a single exported function called greet that takes a name parameter and returns "Hello, {name}!"',
        createdBy: 'test',
      });

      console.log('\n=== Starting DevAgent E2E Test ===');
      console.log(`Workspace: ${testWorkspace}`);

      const result = await devAgent.executeTask(task);

      console.log(`\nResult: success=${result.success}`);
      console.log(`Output: ${result.output?.substring(0, 500)}`);

      // List files
      const files = await fs.readdir(testWorkspace);
      console.log(`Files created: ${files.join(', ') || 'none'}`);

      // Check if greeting.ts was created
      const greetingPath = path.join(testWorkspace, 'greeting.ts');
      const exists = await fs
        .access(greetingPath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        const content = await fs.readFile(greetingPath, 'utf-8');
        console.log(`\n=== greeting.ts ===\n${content}`);
        expect(content).toContain('greet');
      }

      expect(result.success).toBe(true);
      expect(exists).toBe(true);
    },
    { timeout: 60000 }
  );
});

describeE2E('Team E2E Tests (Real LLM)', () => {
  let testWorkspace: string;
  let llmClient: LLMClient;
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
      maxTokens: 2048,
    });
  });

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-e2e-'));
    progressMessages = [];
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  it(
    'Team should plan and execute a simple task',
    async () => {
      const fileTools = createFileTools(testWorkspace);

      const team = new Team({
        workspace: testWorkspace,
        llmClient,
        tools: fileTools,
        maxIterations: 2,
        maxRetries: 1,
        onProgress: (message) => {
          console.log(`[Progress] ${message}`);
          progressMessages.push(message);
        },
        onEscalation: (reason) => {
          console.log(`[Escalation] ${reason}`);
        },
      });

      // Simple task - just create a file
      const result = await team.executeTask(
        'Create a file called "hello.txt" containing the text "Hello World"'
      );

      console.log('\n=== Team E2E Test Result ===');
      console.log(`Success: ${result.success}`);
      console.log(`Escalated: ${result.escalated}`);
      console.log(`Iterations: ${result.iterations}`);

      if (result.breakdown) {
        console.log(`Dev tasks: ${result.breakdown.devTasks.length}`);
        console.log(`QA tasks: ${result.breakdown.qaTasks.length}`);
      }

      // List files created
      const files = await fs.readdir(testWorkspace);
      console.log(`Files created: ${files.join(', ') || 'none'}`);

      // Check for hello.txt
      const helloPath = path.join(testWorkspace, 'hello.txt');
      const exists = await fs
        .access(helloPath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        const content = await fs.readFile(helloPath, 'utf-8');
        console.log(`hello.txt content: "${content}"`);
      }

      // Assertions
      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages.some((m) => m.includes('Planning'))).toBe(true);

      // The task should have a breakdown (PM planned it)
      expect(result.breakdown).toBeDefined();

      console.log(`\nProgress messages:`);
      progressMessages.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));

      if (result.escalated) {
        console.log(`Escalation reason: ${result.escalationReason}`);
      }
    },
    { timeout: 180000 } // 3 minute timeout
  );
});

describeE2E('Design-First E2E Tests (Real LLM)', () => {
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
      maxTokens: 2048,
    });
  });

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-e2e-design-'));
    wikiRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-e2e-wiki-'));
    wikiService = new WikiService({ wikiRoot });
    await wikiService.initialize();
    progressMessages = [];
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
    await fs.rm(wikiRoot, { recursive: true, force: true });
  });

  it(
    'Team should create design doc before planning and executing',
    async () => {
      const fileTools = createFileTools(testWorkspace);

      const team = new Team({
        workspace: testWorkspace,
        llmClient,
        tools: fileTools,
        wikiService,
        maxIterations: 2,
        maxRetries: 1,
        onProgress: (message) => {
          console.log(`[Progress] ${message}`);
          progressMessages.push(message);
        },
        onEscalation: (reason) => {
          console.log(`[Escalation] ${reason}`);
        },
      });

      console.log('\n=== Starting Design-First E2E Test ===');
      console.log(`Workspace: ${testWorkspace}`);
      console.log(`Wiki: ${wikiRoot}`);

      // Simple task to validate design-first workflow (keep execution fast)
      const result = await team.executeTask(
        'Create a file called "config.json" with a JSON object containing name and version fields'
      );

      console.log('\n=== Design-First E2E Test Result ===');
      console.log(`Success: ${result.success}`);
      console.log(`Escalated: ${result.escalated}`);
      console.log(`Iterations: ${result.iterations}`);

      // Check for design doc
      const designPages = await wikiService.listPages('designs');
      console.log(`\nDesign docs created: ${designPages.length}`);
      designPages.forEach((p) => console.log(`  - ${p}`));

      if (result.breakdown?.designDoc) {
        console.log(`\nDesign doc path: ${result.breakdown.designDoc.path}`);
        console.log(`Overview: ${result.breakdown.designDoc.overview}`);
        console.log(`Requirements: ${result.breakdown.designDoc.requirements.join(', ')}`);
      }

      // Check breakdown
      if (result.breakdown) {
        console.log(`\nDev tasks: ${result.breakdown.devTasks.length}`);
        result.breakdown.devTasks.forEach((t) => console.log(`  - ${t.title}`));
        console.log(`QA tasks: ${result.breakdown.qaTasks.length}`);
        result.breakdown.qaTasks.forEach((t) => console.log(`  - ${t.title}`));
      }

      // List files created in workspace
      const files = await fs.readdir(testWorkspace);
      console.log(`\nFiles created: ${files.join(', ') || 'none'}`);

      // Assertions
      expect(progressMessages.length).toBeGreaterThan(0);
      expect(result.breakdown).toBeDefined();

      // Design doc should have been created
      expect(designPages.length).toBeGreaterThan(0);
      expect(result.breakdown?.designDoc).toBeDefined();

      console.log(`\nProgress messages:`);
      progressMessages.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));

      if (result.escalated) {
        console.log(`Escalation reason: ${result.escalationReason}`);
      }
    },
    { timeout: 240000 } // 4 minute timeout for design + plan + execute
  );
});

// Simple sanity check that always runs
describe('E2E Test Setup', () => {
  it('should detect E2E test environment correctly', () => {
    const provider = process.env.LLM_PROVIDER ?? 'openai';
    const hasApiKey =
      provider === 'openai'
        ? !!process.env.OPENAI_API_KEY
        : !!process.env.ANTHROPIC_API_KEY;
    const runE2E = process.env.RUN_E2E_TESTS === 'true';

    console.log(`LLM Provider: ${provider}`);
    console.log(`API key set: ${hasApiKey}`);
    console.log(`RUN_E2E_TESTS: ${runE2E}`);
    console.log(`E2E tests will run: ${hasApiKey && runE2E}`);

    // This test always passes - it's just informational
    expect(true).toBe(true);
  });
});
