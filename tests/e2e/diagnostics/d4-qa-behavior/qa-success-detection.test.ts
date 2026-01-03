/**
 * D4-1: QA Success Detection Test
 *
 * Tier 3 diagnostic test - verifies QA agent correctly reports success/failure.
 * This test isolates QA behavior from the full Team workflow.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LLMClient } from '../../../../src/core/llm/client.js';
import { QAAgent } from '../../../../src/agents/qa/qa-agent.js';
import { createTask } from '../../../../src/core/tasks/types.js';
import { createFileTools } from '../../../../src/core/tools/file-tools.js';
import { createExecTools } from '../../../../src/core/tools/exec-tools.js';
import {
  E2E_TIMEOUTS,
  canRunE2E,
  getAPIKey,
  getLLMProvider,
  logE2EEnvironment,
} from '../../config.js';

describe('D4-1: QA Success Detection', () => {
  let workspace: string;
  let qaAgent: QAAgent;

  beforeAll(() => {
    logE2EEnvironment('D4-1');
  });

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'acia-d4-qa-'));

    const llmClient = new LLMClient({
      provider: getLLMProvider(),
      apiKey: getAPIKey(),
    });

    const tools = [
      ...createFileTools(workspace),
      ...createExecTools(workspace),
    ];

    qaAgent = new QAAgent({
      llmClient,
      tools,
      workspace,
    });
  });

  afterEach(() => {
    if (workspace && fs.existsSync(workspace)) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it.skipIf(!canRunE2E())(
    'should report success when code exists and works correctly',
    async () => {
      // Set up a working code file
      const srcDir = path.join(workspace, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, 'greeting.ts'),
        `export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`
      );

      // Create a QA task to verify the code
      const qaTask = createTask({
        type: 'test',
        title: 'Verify greeting function',
        description: `
Verify that src/greeting.ts exists and contains a greet function that:
1. Takes a name parameter
2. Returns a greeting string

Just read the file and verify these requirements are met. Report success if they are.
`,
        createdBy: 'D4-Test',
        priority: 'medium',
        maxAttempts: 1,
      });

      console.log('[D4-1] Executing QA task for existing code...');
      const result = await qaAgent.executeTask(qaTask);

      console.log('[D4-1] QA Result:', {
        success: result.success,
        output: result.output?.substring(0, 200),
        error: result.error,
      });

      // QA should report success for working code
      expect(result.success).toBe(true);
      console.log('[D4-1] PASSED: QA correctly reported success for working code');
    },
    E2E_TIMEOUTS.TIER_3_WORKFLOW
  );

  it.skipIf(!canRunE2E())(
    'should report failure when code is missing',
    async () => {
      // Don't create any files - workspace is empty

      const qaTask = createTask({
        type: 'test',
        title: 'Verify missing file',
        description: `
Verify that src/missing.ts exists and contains required code.
Report the actual status - if the file doesn't exist, report failure.
`,
        createdBy: 'D4-Test',
        priority: 'medium',
        maxAttempts: 1,
      });

      console.log('[D4-1] Executing QA task for missing code...');
      const result = await qaAgent.executeTask(qaTask);

      console.log('[D4-1] QA Result for missing code:', {
        success: result.success,
        output: result.output?.substring(0, 200),
        error: result.error,
      });

      // QA should report failure for missing code
      expect(result.success).toBe(false);
      console.log('[D4-1] PASSED: QA correctly reported failure for missing code');
    },
    E2E_TIMEOUTS.TIER_3_WORKFLOW
  );

  it.skipIf(!canRunE2E())(
    'should report failure when code has bugs',
    async () => {
      // Set up buggy code
      const srcDir = path.join(workspace, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, 'buggy.ts'),
        `export function divide(a: number, b: number): number {
  // Bug: no check for division by zero
  return a / b;
}
`
      );

      const qaTask = createTask({
        type: 'test',
        title: 'Verify divide function handles edge cases',
        description: `
Verify that src/buggy.ts exists and the divide function:
1. Handles division by zero properly (should throw an error or return a safe value)
2. Has proper error handling

Read the code and check if it handles these edge cases. Report failure if it doesn't.
`,
        createdBy: 'D4-Test',
        priority: 'medium',
        maxAttempts: 1,
      });

      console.log('[D4-1] Executing QA task for buggy code...');
      const result = await qaAgent.executeTask(qaTask);

      console.log('[D4-1] QA Result for buggy code:', {
        success: result.success,
        output: result.output?.substring(0, 200),
        error: result.error,
      });

      // QA should report failure for buggy code
      expect(result.success).toBe(false);
      console.log('[D4-1] PASSED: QA correctly reported failure for buggy code');
    },
    E2E_TIMEOUTS.TIER_3_WORKFLOW
  );
});
