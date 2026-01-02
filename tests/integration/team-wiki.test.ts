/**
 * Integration tests for Team with Wiki support
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Team } from '../../src/team/team.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { WikiService } from '../../src/core/wiki/wiki-service.js';
import { createFileTools } from '../../src/core/tools/file-tools.js';

describe('Team with Wiki Integration', () => {
  let testWorkspace: string;
  let wikiRoot: string;
  let mockLLMClient: LLMClient;
  let wikiService: WikiService;

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-team-wiki-'));
    wikiRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-wiki-'));
    wikiService = new WikiService({ wikiRoot });
    await wikiService.initialize();
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
    await fs.rm(wikiRoot, { recursive: true, force: true });
  });

  it('should provide wiki tools to agents', async () => {
    const mockChat = vi.fn().mockResolvedValue({
      content: `DEV_TASKS:
1. [Create file] - Create a file

QA_TASKS:

EXECUTION_ORDER:
1. DEV:1`,
      stopReason: 'end_turn',
      usage: { inputTokens: 100, outputTokens: 200 },
    });

    mockLLMClient = { chat: mockChat } as unknown as LLMClient;

    const fileTools = createFileTools(testWorkspace);
    const team = new Team({
      workspace: testWorkspace,
      llmClient: mockLLMClient,
      tools: fileTools,
      wikiService,
    });

    // Dev agent should have wiki tools
    const devAgent = team.getDevAgent();
    expect(devAgent.hasTool('read_wiki')).toBe(true);
    expect(devAgent.hasTool('write_wiki')).toBe(true);
    expect(devAgent.hasTool('search_wiki')).toBe(true);

    // QA agent should have wiki tools
    const qaAgent = team.getQAAgent();
    expect(qaAgent.hasTool('read_wiki')).toBe(true);

    // PM agent should have read-only wiki tools
    const pmAgent = team.getPMAgent();
    expect(pmAgent.hasTool('read_wiki')).toBe(true);
    expect(pmAgent.hasTool('search_wiki')).toBe(true);
    // PM should NOT have write_wiki
    expect(pmAgent.hasTool('write_wiki')).toBe(false);
  });

  it('should log completed task to wiki', async () => {
    let callCount = 0;
    const mockChat = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          content: `DEV_TASKS:
1. [Create greeting] - Create greeting file

QA_TASKS:
1. [Verify greeting] - Check greeting exists

EXECUTION_ORDER:
1. DEV:1
2. QA:1`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        };
      }
      if (callCount === 2) {
        return {
          content: 'Created the greeting file successfully.',
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        };
      }
      return {
        content: 'Verification passed. All tests passed.',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      };
    });

    mockLLMClient = { chat: mockChat } as unknown as LLMClient;

    const fileTools = createFileTools(testWorkspace);
    const team = new Team({
      workspace: testWorkspace,
      llmClient: mockLLMClient,
      tools: fileTools,
      wikiService,
    });

    const result = await team.executeTask('Create a greeting module');

    // Log the completion
    await team.logTaskCompletion(result);

    // Check wiki for log entry
    const logPage = await wikiService.readPage('tasks/completed/log.md');
    expect(logPage).not.toBeNull();
    expect(logPage?.content).toContain('Create a greeting module');
    expect(logPage?.content).toContain('Success');
  });

  it('should work without wiki service (backward compatible)', async () => {
    const mockChat = vi.fn().mockResolvedValue({
      content: `DEV_TASKS:
1. [Task] - Do something

QA_TASKS:

EXECUTION_ORDER:
1. DEV:1`,
      stopReason: 'end_turn',
      usage: { inputTokens: 100, outputTokens: 200 },
    });

    mockLLMClient = { chat: mockChat } as unknown as LLMClient;

    const fileTools = createFileTools(testWorkspace);

    // Create team WITHOUT wiki service
    const team = new Team({
      workspace: testWorkspace,
      llmClient: mockLLMClient,
      tools: fileTools,
      // No wikiService provided
    });

    // Should not have wiki tools
    expect(team.getDevAgent().hasTool('read_wiki')).toBe(false);

    // getWikiService should return undefined
    expect(team.getWikiService()).toBeUndefined();

    // logTaskCompletion should not throw
    const result = await team.executeTask('Simple task');
    await expect(team.logTaskCompletion(result)).resolves.not.toThrow();
  });

  it('should be able to search wiki for context', async () => {
    // Pre-populate wiki with some context
    await wikiService.writePage('project/overview.md', {
      title: 'Project Overview',
      content: 'This project uses TypeScript and follows TDD practices.',
    });
    await wikiService.writePage('decisions/auth.md', {
      title: 'Auth Decision',
      content: 'We decided to use JWT tokens for authentication.',
    });

    const mockChat = vi.fn().mockResolvedValue({
      content: `DEV_TASKS:
1. [Add auth] - Add authentication

QA_TASKS:

EXECUTION_ORDER:
1. DEV:1`,
      stopReason: 'end_turn',
      usage: { inputTokens: 100, outputTokens: 200 },
    });

    mockLLMClient = { chat: mockChat } as unknown as LLMClient;

    const fileTools = createFileTools(testWorkspace);
    const team = new Team({
      workspace: testWorkspace,
      llmClient: mockLLMClient,
      tools: fileTools,
      wikiService,
    });

    // PM can search wiki
    expect(team.getPMAgent().hasTool('search_wiki')).toBe(true);

    // Use wikiService directly to verify search works
    const searchResults = await wikiService.search('JWT');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].title).toBe('Auth Decision');
    expect(searchResults[0].snippet).toContain('JWT');
  });
});
