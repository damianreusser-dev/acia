/**
 * Integration test for scaffold task detection and execution
 *
 * Verifies that when PM creates a scaffold task, the Dev agent
 * correctly uses the generate_project tool.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DevAgent } from '../../src/agents/dev/dev-agent.js';
import { PMAgent } from '../../src/agents/pm/pm-agent.js';
import { LLMClient, LLMProvider } from '../../src/core/llm/client.js';
import { createFileTools } from '../../src/core/tools/file-tools.js';
import { createTemplateTools } from '../../src/core/tools/template-tools.js';
import { createTask } from '../../src/core/tasks/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Only run if E2E tests are enabled (uses real LLM)
const describeE2E = describe.runIf(process.env.RUN_E2E_TESTS === 'true');

describeE2E('Scaffold Task Integration', () => {
  let workspace: string;
  let llmClient: LLMClient;

  beforeAll(async () => {
    // Create temp workspace
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-scaffold-test-'));

    // Create LLM client with provider config
    const provider = (process.env.LLM_PROVIDER ?? 'openai') as LLMProvider;
    const apiKey =
      provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY;
    llmClient = new LLMClient({
      provider,
      apiKey: apiKey ?? '',
    });
  });

  afterAll(async () => {
    // Cleanup
    await fs.rm(workspace, { recursive: true, force: true });
  });

  it('should detect fullstack application request as new project', async () => {
    const pmTools = createFileTools(workspace).filter(
      t => t.definition.name === 'read_file' || t.definition.name === 'list_directory'
    );

    const pmAgent = new PMAgent({
      llmClient,
      tools: pmTools,
      workspace,
    });

    const task = createTask({
      type: 'implement',
      title: 'Create a fullstack todo application',
      description: 'Create a fullstack todo application in the directory "todo-app"',
      createdBy: 'User',
    });

    // Plan the task
    const breakdown = await pmAgent.planTask(task);

    // First dev task should be about scaffolding
    expect(breakdown.devTasks.length).toBeGreaterThan(0);
    const firstTask = breakdown.devTasks[0];
    expect(firstTask).toBeDefined();

    // Check task mentions scaffolding or generate_project
    const firstTaskText = `${firstTask!.title} ${firstTask!.description}`.toLowerCase();
    const hasScaffoldKeyword =
      firstTaskText.includes('scaffold') ||
      firstTaskText.includes('generate_project') ||
      firstTaskText.includes('template');

    expect(hasScaffoldKeyword).toBe(true);
  }, 60000);

  it('should use generate_project tool when given scaffold task', async () => {
    const tools = [
      ...createFileTools(workspace),
      ...createTemplateTools(workspace),
    ];

    const devAgent = new DevAgent({
      llmClient,
      tools,
      workspace,
    });

    // Create a scaffold task with explicit instructions
    const scaffoldTask = createTask({
      type: 'implement',
      title: 'Scaffold Project',
      description: 'IMMEDIATELY call generate_project tool with template="fullstack" and projectName="test-app". Do NOT write files manually - the template creates everything.',
      createdBy: 'PMAgent',
    });

    // Execute the task
    const result = await devAgent.executeTask(scaffoldTask);

    // Check result
    expect(result.success).toBe(true);

    // Check that project was created
    const projectDir = path.join(workspace, 'test-app');
    const frontendDir = path.join(projectDir, 'frontend');
    const backendDir = path.join(projectDir, 'backend');

    // Verify directories exist
    const projectExists = await fs.access(projectDir).then(() => true).catch(() => false);
    const frontendExists = await fs.access(frontendDir).then(() => true).catch(() => false);
    const backendExists = await fs.access(backendDir).then(() => true).catch(() => false);

    expect(projectExists).toBe(true);
    expect(frontendExists).toBe(true);
    expect(backendExists).toBe(true);

    // Verify key files exist
    const backendPackageJson = path.join(backendDir, 'package.json');
    const frontendPackageJson = path.join(frontendDir, 'package.json');

    const backendPkgExists = await fs.access(backendPackageJson).then(() => true).catch(() => false);
    const frontendPkgExists = await fs.access(frontendPackageJson).then(() => true).catch(() => false);

    expect(backendPkgExists).toBe(true);
    expect(frontendPkgExists).toBe(true);
  }, 120000);
});
