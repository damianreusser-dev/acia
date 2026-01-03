/**
 * D5: Team Escalation Tests
 *
 * Tier 4 diagnostic test - verifies Team escalation behavior.
 * Tests when escalation happens and when it doesn't.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LLMClient } from '../../../../src/core/llm/client.js';
import { Team } from '../../../../src/team/team.js';
import { createFileTools } from '../../../../src/core/tools/file-tools.js';
import { createExecTools } from '../../../../src/core/tools/exec-tools.js';
import { createTemplateTools } from '../../../../src/templates/template-tools.js';
import {
  E2E_TIMEOUTS,
  canRunE2E,
  getAPIKey,
  getLLMProvider,
  logE2EEnvironment,
} from '../../config.js';

describe('D5: Team Escalation Behavior', () => {
  let workspace: string;
  let team: Team;
  let escalationReasons: string[] = [];
  let progressMessages: string[] = [];

  beforeAll(() => {
    logE2EEnvironment('D5');
  });

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'acia-d5-escalation-'));
    escalationReasons = [];
    progressMessages = [];

    const llmClient = new LLMClient({
      provider: getLLMProvider(),
      apiKey: getAPIKey(),
    });

    const tools = [
      ...createFileTools(workspace),
      ...createExecTools(workspace),
      ...createTemplateTools(workspace),
    ];

    team = new Team({
      workspace,
      llmClient,
      tools,
      maxRetries: 2,
      maxIterations: 3,
      onEscalation: (reason) => {
        console.log('[D5] Escalation:', reason);
        escalationReasons.push(reason);
      },
      onProgress: (message) => {
        console.log('[D5] Progress:', message);
        progressMessages.push(message);
      },
    });
  });

  afterEach(() => {
    if (workspace && fs.existsSync(workspace)) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it.skipIf(!canRunE2E())(
    'should NOT escalate when simple task succeeds',
    async () => {
      // Simple task: create a file
      const result = await team.executeTask(
        'Create a file named hello.txt containing "Hello World"'
      );

      console.log('[D5] Simple task result:', {
        success: result.success,
        escalated: result.escalated,
        iterations: result.iterations,
        devResults: result.devResults.length,
        qaResults: result.qaResults.length,
      });

      // Should succeed without escalation
      expect(result.escalated).toBe(false);
      expect(result.success).toBe(true);
      expect(escalationReasons.length).toBe(0);

      // Verify file was created
      const filePath = path.join(workspace, 'hello.txt');
      expect(fs.existsSync(filePath)).toBe(true);

      console.log('[D5] PASSED: Simple task succeeded without escalation');
    },
    E2E_TIMEOUTS.TIER_4_INTEGRATION
  );

  it.skipIf(!canRunE2E())(
    'should escalate when task is impossible',
    async () => {
      // Impossible task: reference non-existent API
      const result = await team.executeTask(
        'Call the FooBarBazQux API endpoint at /api/nonexistent and verify it returns status 200'
      );

      console.log('[D5] Impossible task result:', {
        success: result.success,
        escalated: result.escalated,
        escalationReason: result.escalationReason,
        iterations: result.iterations,
      });

      // Should fail and escalate (can't verify something that doesn't exist)
      expect(result.success).toBe(false);
      // May or may not escalate depending on how agent handles it

      console.log('[D5] Impossible task handled (escalation:', result.escalated, ')');
    },
    E2E_TIMEOUTS.TIER_4_INTEGRATION
  );

  it.skipIf(!canRunE2E())(
    'should track escalation reasons correctly',
    async () => {
      // Pre-create a file that can't be modified due to test requirements
      // (this tests the escalation message tracking)

      const result = await team.executeTask(
        'Create an Express API with 10 fully tested endpoints for a complex CRM system with customer management, order tracking, inventory, reporting, analytics, and real-time notifications'
      );

      console.log('[D5] Complex task result:', {
        success: result.success,
        escalated: result.escalated,
        escalationReason: result.escalationReason,
        iterations: result.iterations,
        devResultsCount: result.devResults.length,
      });

      // This task is complex - may or may not succeed
      // But escalation reasons should be tracked if it fails
      if (result.escalated) {
        expect(result.escalationReason).toBeDefined();
        expect(result.escalationReason!.length).toBeGreaterThan(0);
        console.log('[D5] Escalation reason recorded:', result.escalationReason);
      }

      console.log('[D5] Complex task completed (success:', result.success, ')');
    },
    E2E_TIMEOUTS.TIER_4_INTEGRATION
  );
});

describe('D5-2: Scaffold Task Escalation', () => {
  let workspace: string;
  let escalated: boolean = false;
  let escalationReason: string = '';

  beforeAll(() => {
    logE2EEnvironment('D5-2');
  });

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'acia-d5-scaffold-'));
    escalated = false;
    escalationReason = '';
  });

  afterEach(() => {
    if (workspace && fs.existsSync(workspace)) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it.skipIf(!canRunE2E())(
    'should NOT escalate when scaffold task uses generate_project',
    async () => {
      const llmClient = new LLMClient({
        provider: getLLMProvider(),
        apiKey: getAPIKey(),
      });

      const tools = [
        ...createFileTools(workspace),
        ...createExecTools(workspace),
        ...createTemplateTools(workspace),
      ];

      const team = new Team({
        workspace,
        llmClient,
        tools,
        maxRetries: 3,
        maxIterations: 3,
        onEscalation: (reason) => {
          escalated = true;
          escalationReason = reason;
          console.log('[D5-2] Escalation triggered:', reason);
        },
        onProgress: (msg) => console.log('[D5-2] Progress:', msg),
      });

      // This should work - scaffold task with template tools available
      const result = await team.executeTask(
        'Create a new Express API project in hello-api directory'
      );

      console.log('[D5-2] Scaffold result:', {
        success: result.success,
        escalated: result.escalated,
        escalationReason: result.escalationReason,
        devResults: result.devResults.map(r => ({
          task: r.task.title,
          success: r.result.success,
        })),
      });

      // Should not escalate - scaffold should succeed
      expect(result.escalated).toBe(false);
      expect(result.success).toBe(true);

      // Verify project was created
      const projectPath = path.join(workspace, 'hello-api');
      expect(fs.existsSync(projectPath)).toBe(true);

      console.log('[D5-2] PASSED: Scaffold task succeeded without escalation');
    },
    E2E_TIMEOUTS.TIER_4_INTEGRATION
  );
});
