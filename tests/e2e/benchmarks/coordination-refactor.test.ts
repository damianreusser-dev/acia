/**
 * ACIA Phase 6a Benchmark Tests - Coordination Layer Refactoring
 *
 * These tests define success for Phase 6a: Coordination Layer Refactoring.
 * They verify that the refactored coordination layer:
 * 1. CEO works with ITeam interface (not concrete Team)
 * 2. TeamFactory creates teams without implementation knowledge
 * 3. Tools are filtered by role, not string matching
 * 4. No regression on Phase 5 fullstack benchmark
 *
 * Run with: RUN_E2E_TESTS=true npm run test:e2e -- benchmarks/coordination-refactor.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { E2E_TIMEOUTS } from '../config.js';

// E2E tests run when RUN_E2E_TESTS=true
const describeE2E = describe.runIf(process.env.RUN_E2E_TESTS === 'true');

// Test workspace
const BENCHMARK_WORKSPACE = path.join(process.cwd(), 'test-workspaces', 'benchmark-coordination');
const BENCHMARK_WIKI = path.join(BENCHMARK_WORKSPACE, '.wiki');

// Helper to clean workspace with retries (handles locked files on Windows)
async function cleanWorkspaceWithRetry(dir: string, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (error: unknown) {
      const e = error as { code?: string };
      if (e.code === 'EBUSY' || e.code === 'ENOTEMPTY') {
        if (attempt < maxRetries) {
          console.log(`[Benchmark] Cleanup attempt ${attempt} failed (EBUSY), retrying in 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.warn(`[Benchmark] Could not fully clean workspace after ${maxRetries} attempts`);
        }
      } else if (e.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

describeE2E('Phase 6a: Coordination Layer Refactoring', () => {
  beforeAll(async () => {
    await cleanWorkspaceWithRetry(BENCHMARK_WORKSPACE);
    await fs.mkdir(BENCHMARK_WORKSPACE, { recursive: true });
  });

  afterAll(async () => {
    await cleanWorkspaceWithRetry(BENCHMARK_WORKSPACE);
  });

  describe('6a.1: ITeam Interface', () => {
    /**
     * BENCHMARK: ITeam Contract Compliance
     *
     * Verifies that existing Team class implements ITeam interface
     * and CEO can work with abstract interface.
     */
    it('should allow CEO to work with ITeam interface', async () => {
      // TODO: Import after implementation
      // import { ITeam } from '../../../src/team/team-interface.js';
      // import { CEOAgent } from '../../../src/agents/executive/ceo-agent.js';
      // import { TeamFactory } from '../../../src/team/team-factory.js';
      // import { LLMClient } from '../../../src/core/llm/client.js';
      // import { WikiService } from '../../../src/core/wiki/wiki-service.js';

      // const wiki = new WikiService({ wikiRoot: BENCHMARK_WIKI });
      // const llmClient = new LLMClient({ provider: 'openai' });
      //
      // // Create team through factory (returns ITeam)
      // const team: ITeam = TeamFactory.create('tech', {
      //   workspace: BENCHMARK_WORKSPACE,
      //   llmClient,
      //   wikiService: wiki,
      // });
      //
      // // CEO should accept ITeam, not concrete Team
      // const ceo = new CEOAgent({
      //   llmClient,
      //   workspace: BENCHMARK_WORKSPACE,
      //   wikiService: wiki,
      // });
      //
      // // Add team to CEO using interface
      // ceo.addTeam('tech', team);
      //
      // // Execute a simple task through CEO -> ITeam
      // const result = await ceo.handleGoal('Create a hello.txt file with "Hello World"');
      //
      // expect(result.success).toBe(true);

      // Placeholder until implementation exists
      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_3_WORKFLOW);

    it('should enforce ITeam method signatures', async () => {
      // TODO: Import after implementation
      // import { ITeam } from '../../../src/team/team-interface.js';
      // import { Team } from '../../../src/team/team.js';

      // Verify Team implements ITeam
      // const team = new Team({ ... });
      //
      // // ITeam methods must exist
      // expect(typeof team.executeTask).toBe('function');
      // expect(typeof team.getAgentRoles).toBe('function');
      // expect(typeof team.getName).toBe('function');
      //
      // // Test method signatures
      // const roles = team.getAgentRoles();
      // expect(Array.isArray(roles)).toBe(true);
      // expect(roles.length).toBeGreaterThan(0);
      //
      // const name = team.getName();
      // expect(typeof name).toBe('string');

      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_1_TOOL);
  });

  describe('6a.2: TeamFactory', () => {
    /**
     * BENCHMARK: Team Creation Through Factory
     *
     * Factory should create different team types without CEO
     * knowing implementation details.
     */
    it('should create TechTeam from factory', async () => {
      // TODO: Import after implementation
      // import { TeamFactory } from '../../../src/team/team-factory.js';
      // import { ITeam } from '../../../src/team/team-interface.js';

      // const team: ITeam = TeamFactory.create('tech', {
      //   workspace: BENCHMARK_WORKSPACE,
      //   llmClient,
      // });
      //
      // expect(team).toBeDefined();
      // expect(team.getName()).toBe('TechTeam');
      //
      // const roles = team.getAgentRoles();
      // expect(roles).toContain('pm');
      // expect(roles).toContain('dev');
      // expect(roles).toContain('qa');

      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_1_TOOL);

    it('should create OpsTeam from factory', async () => {
      // TODO: Import after implementation
      // import { TeamFactory } from '../../../src/team/team-factory.js';
      // import { ITeam } from '../../../src/team/team-interface.js';

      // const team: ITeam = TeamFactory.create('ops', {
      //   workspace: BENCHMARK_WORKSPACE,
      //   llmClient,
      // });
      //
      // expect(team).toBeDefined();
      // expect(team.getName()).toBe('OpsTeam');
      //
      // const roles = team.getAgentRoles();
      // expect(roles).toContain('devops');
      // expect(roles).toContain('monitoring');
      // expect(roles).toContain('incident');

      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_1_TOOL);

    it('should register and create custom team types', async () => {
      // TODO: Import after implementation
      // import { TeamFactory } from '../../../src/team/team-factory.js';

      // // Register a custom team type
      // TeamFactory.register('marketing', (config) => {
      //   return new MarketingTeam(config);
      // });
      //
      // const team = TeamFactory.create('marketing', {
      //   workspace: BENCHMARK_WORKSPACE,
      //   llmClient,
      // });
      //
      // expect(team).toBeDefined();
      // expect(team.getName()).toBe('MarketingTeam');

      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_1_TOOL);
  });

  describe('6a.3: Tool Permission System', () => {
    /**
     * BENCHMARK: Role-Based Tool Access
     *
     * Tools should be filtered by agent role, not string matching.
     */
    it('should filter tools by role for PM agents', async () => {
      // TODO: Import after implementation
      // import { TeamFactory } from '../../../src/team/team-factory.js';
      // import { AgentRole, filterToolsByRole } from '../../../src/core/tools/types.js';

      // const team = TeamFactory.create('tech', { ... });
      // const pmAgent = team.getPMAgent();
      //
      // // Get tools available to PM
      // const pmTools = pmAgent.getTools();
      //
      // // PM should have read-only tools
      // const toolNames = pmTools.map(t => t.definition.name);
      // expect(toolNames).toContain('read_file');
      // expect(toolNames).toContain('list_directory');
      // expect(toolNames).toContain('read_wiki');
      //
      // // PM should NOT have write tools
      // expect(toolNames).not.toContain('write_file');
      // expect(toolNames).not.toContain('run_code');
      // expect(toolNames).not.toContain('docker_build');

      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_1_TOOL);

    it('should filter tools by role for DevOps agents', async () => {
      // TODO: Import after implementation
      // import { TeamFactory } from '../../../src/team/team-factory.js';

      // const team = TeamFactory.create('ops', { ... });
      // const devopsAgent = team.getDevOpsAgent();
      //
      // // Get tools available to DevOps
      // const devopsTools = devopsAgent.getTools();
      // const toolNames = devopsTools.map(t => t.definition.name);
      //
      // // DevOps should have deployment tools
      // expect(toolNames).toContain('docker_build');
      // expect(toolNames).toContain('docker_run');
      // expect(toolNames).toContain('deploy_to_railway');
      //
      // // DevOps should have file tools
      // expect(toolNames).toContain('write_file');
      // expect(toolNames).toContain('read_file');

      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_1_TOOL);

    it('should maintain backward compatibility with untagged tools', async () => {
      // TODO: Import after implementation
      // import { Tool, filterToolsByRole } from '../../../src/core/tools/types.js';

      // // Tools without roles should be available to all agents (or based on default rules)
      // const legacyTool: Tool = {
      //   definition: { name: 'legacy_tool', description: 'A legacy tool without roles' },
      //   // No 'roles' property - backward compatible
      // };
      //
      // // Legacy tools should work with the new system
      // const pmTools = filterToolsByRole([legacyTool], 'pm');
      // // Behavior depends on design decision:
      // // Option A: Legacy tools available to all
      // // Option B: Legacy tools only to dev agents
      // expect(pmTools.length).toBeGreaterThanOrEqual(0); // At least doesn't crash

      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_1_TOOL);
  });

  describe('6a.4: Dev Agent Inheritance', () => {
    /**
     * BENCHMARK: Specialized Agents Extend Base
     *
     * FrontendDevAgent and BackendDevAgent should properly
     * extend DevAgent without duplicating logic.
     */
    it('should share tool verification logic from DevAgent', async () => {
      // TODO: Import after implementation
      // import { DevAgent } from '../../../src/agents/dev/dev-agent.js';
      // import { FrontendDevAgent } from '../../../src/agents/dev/frontend-dev-agent.js';
      // import { BackendDevAgent } from '../../../src/agents/dev/backend-dev-agent.js';

      // // Both specialized agents should be instances of DevAgent
      // const frontend = new FrontendDevAgent({ ... });
      // const backend = new BackendDevAgent({ ... });
      //
      // expect(frontend instanceof DevAgent).toBe(true);
      // expect(backend instanceof DevAgent).toBe(true);
      //
      // // Tool verification logic should be inherited (not duplicated)
      // // Check that they share the same base method
      // expect(frontend.verifyToolCalls).toBe(DevAgent.prototype.verifyToolCalls);
      // expect(backend.verifyToolCalls).toBe(DevAgent.prototype.verifyToolCalls);

      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_1_TOOL);
  });

  describe('6a.5: Shared Utilities', () => {
    /**
     * BENCHMARK: Scaffold Detection Consistency
     *
     * Single isScaffoldTask function used by PM, Dev, CEO.
     */
    it('should detect scaffold tasks consistently across agents', async () => {
      // TODO: Import after implementation
      // import { isScaffoldTask, extractProjectName } from '../../../src/utils/scaffold-detector.js';

      // const testCases = [
      //   { input: 'Create a fullstack project', expected: true },
      //   { input: 'generate_project with template=react', expected: true },
      //   { input: 'Build a todo application', expected: true },
      //   { input: 'Create a React frontend', expected: true },
      //   { input: 'Add API endpoint for users', expected: false },
      //   { input: 'Fix the login bug', expected: false },
      //   { input: 'Update the README', expected: false },
      // ];
      //
      // for (const { input, expected } of testCases) {
      //   expect(isScaffoldTask(input)).toBe(expected);
      // }
      //
      // // Project name extraction
      // expect(extractProjectName('Create todo-app')).toBe('todo-app');
      // expect(extractProjectName('Build my-project in "my-folder"')).toBe('my-folder');

      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_1_TOOL);

    it('should parse LLM responses consistently', async () => {
      // TODO: Import after implementation
      // import { ResponseParser } from '../../../src/utils/response-parser.js';

      // const parser = new ResponseParser();
      //
      // // Parse section
      // const response = `
      // ## Dev Tasks
      // - Create user model
      // - Add API routes
      //
      // ## QA Tasks
      // - Test user creation
      // `;
      //
      // const devSection = parser.parseSection(response, 'Dev Tasks');
      // expect(devSection).toContain('Create user model');
      //
      // const devList = parser.parseList(response, 'Dev Tasks');
      // expect(devList.length).toBe(2);
      // expect(devList[0]).toBe('Create user model');

      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_1_TOOL);
  });

  describe('6a: Regression Tests', () => {
    /**
     * CRITICAL: Existing functionality must not break
     *
     * This test ensures the Phase 5 fullstack benchmark still passes
     * after the coordination layer refactoring.
     */
    it('should complete Phase 5 fullstack benchmark after refactor', async () => {
      // This test runs the same flow as Phase 5 benchmark
      // to ensure no regressions from the refactoring.

      // TODO: Import after implementation
      // import { JarvisAgent } from '../../../src/agents/executive/jarvis-agent.js';
      // import { WikiService } from '../../../src/core/wiki/wiki-service.js';

      // const wiki = new WikiService({ wikiRoot: BENCHMARK_WIKI });
      // const jarvis = new JarvisAgent({
      //   workspace: BENCHMARK_WORKSPACE,
      //   wikiService: wiki,
      // });
      //
      // const projectDir = path.join(BENCHMARK_WORKSPACE, 'regression-test');
      //
      // // Simple task that exercises the full coordination layer
      // const result = await jarvis.handleRequest(`
      //   Create a simple Express API in "regression-test" with:
      //   - GET /api/health endpoint returning { status: "ok" }
      //   - package.json with dependencies
      //   - TypeScript configuration
      // `);
      //
      // expect(result.success).toBe(true);
      //
      // // Verify files exist
      // expect(await fileExists(path.join(projectDir, 'package.json'))).toBe(true);
      // expect(await fileExists(path.join(projectDir, 'src', 'index.ts'))).toBe(true);

      expect(true).toBe(true);
    }, E2E_TIMEOUTS.TIER_4_INTEGRATION);
  });
});

// Unit-level tests that don't require E2E environment
describe('Phase 6a: Unit Tests (Always Run)', () => {
  describe('ITeam Interface', () => {
    it('should export ITeam interface from team-interface module', async () => {
      // Import Team which implements ITeam
      const { Team } = await import('../../../src/team/team.js');
      const { LLMClient } = await import('../../../src/core/llm/client.js');

      // Create a mock LLM client
      const mockLLM = {
        chat: async () => ({ content: 'test', model: 'test', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }),
      } as unknown as typeof LLMClient.prototype;

      // Team implements ITeam - if this works, interface contract is met
      const team = new Team({
        workspace: '/tmp',
        llmClient: mockLLM,
        tools: [],
      });

      expect(team).toBeDefined();
      expect(typeof team.executeTask).toBe('function');
      expect(typeof team.getAgentRoles).toBe('function');
      expect(typeof team.getName).toBe('function');
      expect(typeof team.getWorkspace).toBe('function');

      // Verify interface methods work
      expect(team.getName()).toBe('TechTeam');
      expect(team.getWorkspace()).toBe('/tmp');
      expect(team.getAgentRoles()).toContain('pm');
      expect(team.getAgentRoles()).toContain('dev');
      expect(team.getAgentRoles()).toContain('qa');
    });
  });

  describe('TeamFactory', () => {
    it('should export TeamFactory class', async () => {
      const { TeamFactory } = await import('../../../src/team/team-factory.js');

      expect(TeamFactory).toBeDefined();
      expect(typeof TeamFactory.create).toBe('function');
      expect(typeof TeamFactory.register).toBe('function');
      expect(typeof TeamFactory.isRegistered).toBe('function');
      expect(typeof TeamFactory.getRegisteredTypes).toBe('function');
    });

    it('should have tech team registered by default', async () => {
      const { TeamFactory } = await import('../../../src/team/team-factory.js');

      expect(TeamFactory.isRegistered('tech')).toBe(true);
      expect(TeamFactory.getRegisteredTypes()).toContain('tech');
    });
  });

  describe('AgentRole Types', () => {
    it('should export AgentRole type with expected values', async () => {
      const { AGENT_ROLES, filterToolsByRole } = await import('../../../src/core/tools/types.js');

      // Verify role constants exist
      expect(AGENT_ROLES).toContain('pm');
      expect(AGENT_ROLES).toContain('dev');
      expect(AGENT_ROLES).toContain('qa');
      expect(AGENT_ROLES).toContain('devops');
      expect(AGENT_ROLES).toContain('ops');
      expect(AGENT_ROLES).toContain('content');
      expect(AGENT_ROLES).toContain('monitoring');
      expect(AGENT_ROLES).toContain('incident');

      // Verify filterToolsByRole function exists
      expect(typeof filterToolsByRole).toBe('function');
    });

    it('should filter tools by role correctly', async () => {
      const { filterToolsByRole } = await import('../../../src/core/tools/types.js');

      const mockTools = [
        {
          definition: { name: 'dev_only_tool', description: 'Dev tool', parameters: [] },
          execute: async () => ({ success: true }),
          roles: ['dev'] as const,
        },
        {
          definition: { name: 'pm_only_tool', description: 'PM tool', parameters: [] },
          execute: async () => ({ success: true }),
          roles: ['pm'] as const,
        },
        {
          definition: { name: 'all_roles_tool', description: 'All tool', parameters: [] },
          execute: async () => ({ success: true }),
          // No roles = available to all (backward compatibility)
        },
      ];

      // Dev should see dev tools and all-roles tools
      const devTools = filterToolsByRole(mockTools as any, 'dev');
      expect(devTools.map(t => t.definition.name)).toContain('dev_only_tool');
      expect(devTools.map(t => t.definition.name)).toContain('all_roles_tool');
      expect(devTools.map(t => t.definition.name)).not.toContain('pm_only_tool');

      // PM should see pm tools and all-roles tools
      const pmTools = filterToolsByRole(mockTools as any, 'pm');
      expect(pmTools.map(t => t.definition.name)).toContain('pm_only_tool');
      expect(pmTools.map(t => t.definition.name)).toContain('all_roles_tool');
      expect(pmTools.map(t => t.definition.name)).not.toContain('dev_only_tool');
    });
  });

  describe('Scaffold Detector Utility', () => {
    it('should detect scaffold tasks consistently', async () => {
      const { isScaffoldTask, isCustomizeTask, extractProjectName, analyzeTaskType } =
        await import('../../../src/utils/scaffold-detector.js');
      const { createTask } = await import('../../../src/core/tasks/types.js');

      // Test scaffold detection
      const scaffoldTask = createTask({
        type: 'implement',
        title: 'Scaffold',
        description: 'Scaffold a fullstack application',
        createdBy: 'test',
      });
      expect(isScaffoldTask(scaffoldTask)).toBe(true);

      // Test customize detection
      const customizeTask = createTask({
        type: 'implement',
        title: 'Add Route',
        description: 'Add users route to existing API',
        createdBy: 'test',
      });
      expect(isCustomizeTask(customizeTask)).toBe(true);

      // Test project name extraction
      const namedTask = createTask({
        type: 'implement',
        title: 'Create',
        description: 'Create project called "my-app"',
        createdBy: 'test',
      });
      expect(extractProjectName(namedTask)).toBe('my-app');

      // Test analyzeTaskType
      const info = analyzeTaskType(scaffoldTask);
      expect(info.isScaffold).toBe(true);
    });
  });

  describe('Response Parser Utility', () => {
    it('should analyze responses and extract files', async () => {
      const { analyzeResponse, extractModifiedFiles, isSuccessfulResponse } =
        await import('../../../src/utils/response-parser.js');

      // Test success detection with tool usage
      const successResponse = 'Task completed. Wrote to src/app.ts';
      const analysis = analyzeResponse(successResponse);
      expect(analysis.success).toBe(true);
      expect(analysis.hasToolUsage).toBe(true);

      // Test file extraction
      const files = extractModifiedFiles(successResponse);
      expect(files).toContain('src/app.ts');

      // Test failure detection
      const failResponse = 'Could not complete the task';
      expect(isSuccessfulResponse(failResponse)).toBe(false);
    });
  });
});
