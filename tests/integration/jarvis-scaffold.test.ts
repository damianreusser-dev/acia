/**
 * Integration test for Jarvis scaffold flow
 *
 * Tests the full flow: Jarvis → CEO → Team → Dev using generate_project
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JarvisAgent } from '../../src/agents/executive/jarvis-agent.js';
import { WikiService } from '../../src/core/wiki/wiki-service.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Only run if E2E tests are enabled (uses real LLM)
const describeE2E = describe.runIf(process.env.RUN_E2E_TESTS === 'true');

describeE2E('Jarvis Scaffold Flow', () => {
  let workspace: string;
  let wikiPath: string;
  let jarvis: JarvisAgent;

  beforeAll(async () => {
    // Create temp workspace
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-jarvis-scaffold-'));
    wikiPath = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-jarvis-wiki-'));

    const wiki = new WikiService({ wikiRoot: wikiPath });
    jarvis = new JarvisAgent({
      workspace,
      wikiService: wiki,
    });
  });

  afterAll(async () => {
    // Cleanup
    await fs.rm(workspace, { recursive: true, force: true });
    await fs.rm(wikiPath, { recursive: true, force: true });
  });

  it('should create a fullstack project using generate_project', async () => {
    const projectDir = path.join(workspace, 'test-app');

    console.log('=== Test Setup ===');
    console.log('Workspace:', workspace);
    console.log('JarvisWorkspace:', jarvis.getWorkspace?.());

    // Request to create a fullstack app
    const result = await jarvis.handleRequest(`
      Create a simple fullstack todo application in the directory "test-app" with:
      - React frontend
      - Express backend

      Use the generate_project tool with template="fullstack" to scaffold the project.
    `);

    console.log('=== Jarvis Result ===');
    console.log('Success:', result.success);
    console.log('Status:', result.status);
    console.log('Response preview:', result.response?.substring(0, 500));

    // Check if directories were created
    const frontendDir = path.join(projectDir, 'frontend');
    const backendDir = path.join(projectDir, 'backend');

    const frontendExists = await fs.access(frontendDir).then(() => true).catch(() => false);
    const backendExists = await fs.access(backendDir).then(() => true).catch(() => false);

    console.log('\n=== Directory Check ===');
    console.log('Project dir:', projectDir);
    console.log('Frontend exists:', frontendExists);
    console.log('Backend exists:', backendExists);

    // List workspace contents
    const workspaceContents = await fs.readdir(workspace).catch(() => []);
    console.log('Workspace contents:', workspaceContents);

    if (frontendExists || backendExists) {
      const frontendContents = await fs.readdir(frontendDir).catch(() => []);
      const backendContents = await fs.readdir(backendDir).catch(() => []);
      console.log('Frontend contents:', frontendContents);
      console.log('Backend contents:', backendContents);
    }

    // Expect either success OR that files were created (even if workflow had issues)
    const filesCreated = frontendExists && backendExists;

    if (!filesCreated) {
      console.log('\n=== Debug: Files not created ===');
      console.log('Full response:', result.response);
      console.log('Output:', result.output);
      console.log('Escalation:', result.escalation);
    }

    expect(filesCreated).toBe(true);
  }, 300000); // 5 minute timeout
});
