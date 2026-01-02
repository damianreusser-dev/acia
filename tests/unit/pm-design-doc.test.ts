/**
 * Unit tests for PMAgent Design-First Development
 * Tests the design doc creation functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PMAgent } from '../../src/agents/pm/pm-agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { WikiService } from '../../src/core/wiki/wiki-service.js';
import { createTask } from '../../src/core/tasks/types.js';

describe('PMAgent Design-First Development', () => {
  let testWorkspace: string;
  let wikiRoot: string;
  let mockLLMClient: LLMClient;
  let wikiService: WikiService;
  let pmAgent: PMAgent;

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-pm-design-'));
    wikiRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-wiki-design-'));
    wikiService = new WikiService({ wikiRoot });
    await wikiService.initialize();
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
    await fs.rm(wikiRoot, { recursive: true, force: true });
  });

  describe('createDesignDoc', () => {
    it('should create design doc when wiki service is available', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: `OVERVIEW:
Build an authentication system for user login.

REQUIREMENTS:
- Support email/password login
- Include password hashing
- Return JWT tokens

APPROACH:
Use bcrypt for password hashing and jsonwebtoken for JWT generation.

ACCEPTANCE_CRITERIA:
- [ ] Users can register with email/password
- [ ] Users can log in and receive JWT
- [ ] Passwords are securely hashed`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      mockLLMClient = { chat: mockChat } as unknown as LLMClient;

      pmAgent = new PMAgent({
        llmClient: mockLLMClient,
        tools: [],
        workspace: testWorkspace,
        wikiService,
      });

      const task = createTask({
        type: 'implement',
        title: 'User Authentication',
        description: 'Implement user login system',
        createdBy: 'Test',
        priority: 'high',
      });

      const designDoc = await pmAgent.createDesignDoc(task);

      expect(designDoc).not.toBeNull();
      expect(designDoc!.title).toBe('Design: User Authentication');
      expect(designDoc!.overview).toContain('authentication');
      expect(designDoc!.requirements.length).toBeGreaterThan(0);
      expect(designDoc!.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(designDoc!.path).toContain('designs/');
    });

    it('should return null when wiki service is not available', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: 'Some response',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      mockLLMClient = { chat: mockChat } as unknown as LLMClient;

      pmAgent = new PMAgent({
        llmClient: mockLLMClient,
        tools: [],
        workspace: testWorkspace,
        // No wikiService
      });

      const task = createTask({
        type: 'implement',
        title: 'Test Task',
        description: 'Test description',
        createdBy: 'Test',
        priority: 'medium',
      });

      const designDoc = await pmAgent.createDesignDoc(task);

      expect(designDoc).toBeNull();
      expect(mockChat).not.toHaveBeenCalled(); // Should not call LLM
    });

    it('should write design doc to wiki', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: `OVERVIEW:
Create a feature for file uploads.

REQUIREMENTS:
- Support multiple file types
- Limit file size to 10MB

APPROACH:
Use multer middleware for file handling.

ACCEPTANCE_CRITERIA:
- [ ] Files can be uploaded
- [ ] File size is validated`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      mockLLMClient = { chat: mockChat } as unknown as LLMClient;

      pmAgent = new PMAgent({
        llmClient: mockLLMClient,
        tools: [],
        workspace: testWorkspace,
        wikiService,
      });

      const task = createTask({
        type: 'implement',
        title: 'File Upload Feature',
        description: 'Add file upload capability',
        createdBy: 'Test',
        priority: 'medium',
      });

      const designDoc = await pmAgent.createDesignDoc(task);

      // Verify doc was written to wiki
      const wikiPage = await wikiService.readPage(designDoc!.path);
      expect(wikiPage).not.toBeNull();
      expect(wikiPage!.content).toContain('file uploads');
      expect(wikiPage!.content).toContain('Requirements');
      expect(wikiPage!.content).toContain('Acceptance Criteria');
    });

    it('should parse design doc with default values for missing sections', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: `Just some rambling text without proper sections...`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      mockLLMClient = { chat: mockChat } as unknown as LLMClient;

      pmAgent = new PMAgent({
        llmClient: mockLLMClient,
        tools: [],
        workspace: testWorkspace,
        wikiService,
      });

      const task = createTask({
        type: 'implement',
        title: 'Fallback Test',
        description: 'Testing default values',
        createdBy: 'Test',
        priority: 'low',
      });

      const designDoc = await pmAgent.createDesignDoc(task);

      expect(designDoc).not.toBeNull();
      // Should fall back to task description for requirements
      expect(designDoc!.requirements).toContain('Testing default values');
      // Should have default acceptance criteria
      expect(designDoc!.acceptanceCriteria).toContain('Implementation complete');
    });
  });

  describe('planTask with design doc', () => {
    it('should create design doc before planning when wiki is available', async () => {
      let callCount = 0;
      const mockChat = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Design doc creation
          return {
            content: `OVERVIEW:
Build a calculator module.

REQUIREMENTS:
- Support basic operations
- Handle edge cases

APPROACH:
Create separate functions for each operation.

ACCEPTANCE_CRITERIA:
- [ ] All operations work correctly`,
            stopReason: 'end_turn',
            usage: { inputTokens: 100, outputTokens: 200 },
          };
        }
        // Task planning
        return {
          content: `DEV_TASKS:
1. [Create calculator] - Implement basic operations

QA_TASKS:
1. [Test calculator] - Verify operations

EXECUTION_ORDER:
1. DEV:1
2. QA:1`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        };
      });

      mockLLMClient = { chat: mockChat } as unknown as LLMClient;

      pmAgent = new PMAgent({
        llmClient: mockLLMClient,
        tools: [],
        workspace: testWorkspace,
        wikiService,
      });

      const task = createTask({
        type: 'implement',
        title: 'Calculator Module',
        description: 'Build basic calculator',
        createdBy: 'Test',
        priority: 'medium',
      });

      const breakdown = await pmAgent.planTask(task);

      // Should have called LLM twice: once for design, once for planning
      expect(mockChat).toHaveBeenCalledTimes(2);

      // Should have design doc reference
      expect(breakdown.designDoc).not.toBeUndefined();
      expect(breakdown.designDoc!.title).toBe('Design: Calculator Module');

      // Should still have tasks
      expect(breakdown.devTasks.length).toBeGreaterThan(0);
      expect(breakdown.qaTasks.length).toBeGreaterThan(0);
    });

    it('should plan without design doc when wiki is not available', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: `DEV_TASKS:
1. [Simple task] - Do something simple

QA_TASKS:

EXECUTION_ORDER:
1. DEV:1`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      mockLLMClient = { chat: mockChat } as unknown as LLMClient;

      pmAgent = new PMAgent({
        llmClient: mockLLMClient,
        tools: [],
        workspace: testWorkspace,
        // No wikiService
      });

      const task = createTask({
        type: 'implement',
        title: 'Simple Task',
        description: 'Just a simple task',
        createdBy: 'Test',
        priority: 'low',
      });

      const breakdown = await pmAgent.planTask(task);

      // Should have called LLM only once (no design doc)
      expect(mockChat).toHaveBeenCalledTimes(1);

      // Should not have design doc reference
      expect(breakdown.designDoc).toBeUndefined();

      // Should still have tasks
      expect(breakdown.devTasks.length).toBeGreaterThan(0);
    });

    it('should include design doc reference in planning prompt', async () => {
      let capturedPrompt = '';
      let callCount = 0;
      const mockChat = vi.fn().mockImplementation((messages) => {
        callCount++;
        if (callCount === 2) {
          // Capture the planning prompt (second call)
          capturedPrompt = messages[messages.length - 1].content;
        }
        if (callCount === 1) {
          return {
            content: `OVERVIEW:
Test overview content.

REQUIREMENTS:
- Test requirement 1
- Test requirement 2

APPROACH:
Test approach content.

ACCEPTANCE_CRITERIA:
- [ ] Test criterion 1`,
            stopReason: 'end_turn',
            usage: { inputTokens: 100, outputTokens: 200 },
          };
        }
        return {
          content: `DEV_TASKS:
1. [Task] - Description

QA_TASKS:

EXECUTION_ORDER:
1. DEV:1`,
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 200 },
        };
      });

      mockLLMClient = { chat: mockChat } as unknown as LLMClient;

      pmAgent = new PMAgent({
        llmClient: mockLLMClient,
        tools: [],
        workspace: testWorkspace,
        wikiService,
      });

      const task = createTask({
        type: 'implement',
        title: 'Test Feature',
        description: 'Test description',
        createdBy: 'Test',
        priority: 'medium',
      });

      await pmAgent.planTask(task);

      // Planning prompt should include design doc info
      expect(capturedPrompt).toContain('Design Document');
      expect(capturedPrompt).toContain('Test overview content');
      expect(capturedPrompt).toContain('Test requirement 1');
      expect(capturedPrompt).toContain('Test approach content');
      expect(capturedPrompt).toContain('Test criterion 1');
    });
  });

  describe('parseDesignDoc edge cases', () => {
    it('should handle various bullet point formats', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: `OVERVIEW:
Test overview.

REQUIREMENTS:
- Dash requirement
* Star requirement

APPROACH:
Some approach.

ACCEPTANCE_CRITERIA:
- [ ] Unchecked criterion
- [x] Checked criterion
* Another criterion`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      mockLLMClient = { chat: mockChat } as unknown as LLMClient;

      pmAgent = new PMAgent({
        llmClient: mockLLMClient,
        tools: [],
        workspace: testWorkspace,
        wikiService,
      });

      const task = createTask({
        type: 'implement',
        title: 'Bullet Test',
        description: 'Test bullet parsing',
        createdBy: 'Test',
        priority: 'low',
      });

      const designDoc = await pmAgent.createDesignDoc(task);

      expect(designDoc!.requirements.length).toBe(2);
      expect(designDoc!.requirements).toContain('Dash requirement');
      expect(designDoc!.requirements).toContain('Star requirement');
      expect(designDoc!.acceptanceCriteria.length).toBe(3);
    });

    it('should generate safe filename from task title', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        content: `OVERVIEW: Test`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      mockLLMClient = { chat: mockChat } as unknown as LLMClient;

      pmAgent = new PMAgent({
        llmClient: mockLLMClient,
        tools: [],
        workspace: testWorkspace,
        wikiService,
      });

      const task = createTask({
        type: 'implement',
        title: 'This is a Very Long Title with Special Ch@r$cters!!!',
        description: 'Test',
        createdBy: 'Test',
        priority: 'low',
      });

      const designDoc = await pmAgent.createDesignDoc(task);

      // Path should be sanitized
      expect(designDoc!.path).toMatch(/^designs\/[a-z0-9-]+-\d+$/);
      expect(designDoc!.path).not.toContain('@');
      expect(designDoc!.path).not.toContain('$');
      expect(designDoc!.path).not.toContain('!');
    });
  });
});
