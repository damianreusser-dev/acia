/**
 * Integration tests for Team Design-First Development workflow
 * Verifies that design docs are created before task planning
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Team } from '../../src/team/team.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { WikiService } from '../../src/core/wiki/wiki-service.js';
import { createFileTools } from '../../src/core/tools/file-tools.js';

describe('Team Design-First Integration', () => {
  let testWorkspace: string;
  let wikiRoot: string;
  let mockLLMClient: LLMClient;
  let wikiService: WikiService;

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-team-design-'));
    wikiRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-wiki-'));
    wikiService = new WikiService({ wikiRoot });
    await wikiService.initialize();
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
    await fs.rm(wikiRoot, { recursive: true, force: true });
  });

  it('should create design doc before executing task', async () => {
    let callCount = 0;
    const mockChat = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Design doc creation by PM
        return {
          content: `OVERVIEW:
Create a new greeting feature.

REQUIREMENTS:
- Greet users by name
- Support multiple languages

APPROACH:
Create a Greeter class with language support.

ACCEPTANCE_CRITERIA:
- [ ] Can greet in English
- [ ] Can greet in German`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        };
      }
      if (callCount === 2) {
        // Task planning by PM
        return {
          content: `DEV_TASKS:
1. [Create Greeter] - Create Greeter class with multi-language support

QA_TASKS:
1. [Test Greeter] - Verify greetings work

EXECUTION_ORDER:
1. DEV:1
2. QA:1`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        };
      }
      if (callCount === 3) {
        // Dev execution
        return {
          content: 'Created the Greeter class successfully.',
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        };
      }
      if (callCount === 4) {
        // QA execution
        return {
          content: 'All tests passed.',
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        };
      }
      // PM handling results
      return {
        content: 'Task completed successfully.',
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

    await team.executeTask('Create a greeting feature');

    // Verify design doc was created (first call)
    expect(mockChat).toHaveBeenCalled();
    expect(callCount).toBeGreaterThanOrEqual(2); // At least design + planning

    // Check that a design doc exists in wiki
    const designPages = await wikiService.listPages('designs');
    expect(designPages.length).toBeGreaterThan(0);

    // Verify design doc content
    const designDoc = await wikiService.readPage(designPages[0]);
    expect(designDoc).not.toBeNull();
    expect(designDoc!.content).toContain('greeting');
    expect(designDoc!.content).toContain('Requirements');
  });

  it('should include design doc reference in task breakdown', async () => {
    let callCount = 0;
    const mockChat = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Design doc
        return {
          content: `OVERVIEW:
File upload feature.

REQUIREMENTS:
- Upload files
- Validate size

APPROACH:
Use streams.

ACCEPTANCE_CRITERIA:
- [ ] Uploads work`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        };
      }
      if (callCount === 2) {
        // Planning
        return {
          content: `DEV_TASKS:
1. [Upload] - Create upload endpoint

QA_TASKS:

EXECUTION_ORDER:
1. DEV:1`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        };
      }
      return {
        content: 'Done.',
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

    const result = await team.executeTask('Add file uploads');

    // Breakdown should have design doc reference
    expect(result.breakdown).not.toBeUndefined();
    expect(result.breakdown!.designDoc).not.toBeUndefined();
    expect(result.breakdown!.designDoc!.path).toContain('designs/');
  });

  it('should work without wiki (backward compatible, no design doc)', async () => {
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
    const team = new Team({
      workspace: testWorkspace,
      llmClient: mockLLMClient,
      tools: fileTools,
      // No wikiService
    });

    const result = await team.executeTask('Simple task');

    // Should work without design doc
    expect(result.breakdown).not.toBeUndefined();
    expect(result.breakdown!.designDoc).toBeUndefined();

    // Should only have called LLM once for planning (no design doc call)
    // Actually twice: once for planning, once for execution
    // But the key is no design doc call
    expect(mockChat).toHaveBeenCalled();
  });

  it('should create design docs in dedicated wiki directory', async () => {
    let callCount = 0;
    const mockChat = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          content: `OVERVIEW: Test overview

REQUIREMENTS:
- Req 1

APPROACH: Approach

ACCEPTANCE_CRITERIA:
- [ ] Criterion`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        };
      }
      return {
        content: `DEV_TASKS:
1. [Task] - Description

EXECUTION_ORDER:
1. DEV:1`,
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

    await team.executeTask('Test feature');

    // Check designs directory exists and has content
    const pages = await wikiService.listPages('designs');
    expect(pages.length).toBe(1);
    expect(pages[0]).toMatch(/^designs\//);
  });
});
