/**
 * Integration tests for Agent with File Tools
 *
 * Tests that Agent can actually use file tools to read/write files.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Agent } from '../../src/agents/base/agent.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { createFileTools } from '../../src/core/tools/file-tools.js';

// Mock LLMClient for deterministic tests
vi.mock('../../src/core/llm/client.js', () => {
  return {
    LLMClient: vi.fn().mockImplementation(() => ({
      chat: vi.fn().mockResolvedValue({
        content: 'I acknowledge the file operation.',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20 },
      }),
    })),
  };
});

describe('Agent with File Tools Integration', () => {
  let testWorkspace: string;
  let agent: Agent;

  beforeEach(async () => {
    // Create a temporary workspace
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-integration-'));

    const mockLLMClient = new LLMClient({ apiKey: 'test-key' });
    const fileTools = createFileTools(testWorkspace);

    agent = new Agent({
      name: 'FileAgent',
      role: 'File Handler',
      systemPrompt: 'You are an agent that handles file operations.',
      llmClient: mockLLMClient,
      tools: fileTools,
    });
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  describe('tool availability', () => {
    it('should have all file tools available', () => {
      const tools = agent.getAvailableTools();

      expect(tools).toContain('read_file');
      expect(tools).toContain('write_file');
      expect(tools).toContain('list_directory');
      expect(tools).toHaveLength(3);
    });
  });

  describe('file operations', () => {
    it('should write and read a file', async () => {
      // Write a file
      const writeResult = await agent.executeTool('write_file', {
        path: 'test.txt',
        content: 'Hello from agent!',
      });

      expect(writeResult.success).toBe(true);

      // Read it back
      const readResult = await agent.executeTool('read_file', {
        path: 'test.txt',
      });

      expect(readResult.success).toBe(true);
      expect(readResult.output).toBe('Hello from agent!');
    });

    it('should list directory contents', async () => {
      // Create some files
      await fs.writeFile(path.join(testWorkspace, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testWorkspace, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(testWorkspace, 'subdir'));

      const result = await agent.executeTool('list_directory', {
        path: '.',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('[FILE] file1.txt');
      expect(result.output).toContain('[FILE] file2.txt');
      expect(result.output).toContain('[DIR] subdir');
    });

    it('should create nested directories when writing', async () => {
      const result = await agent.executeTool('write_file', {
        path: 'deep/nested/path/file.txt',
        content: 'Nested content',
      });

      expect(result.success).toBe(true);

      // Verify file exists
      const content = await fs.readFile(
        path.join(testWorkspace, 'deep/nested/path/file.txt'),
        'utf-8'
      );
      expect(content).toBe('Nested content');
    });

    it('should prevent access outside workspace', async () => {
      const readResult = await agent.executeTool('read_file', {
        path: '../../../etc/passwd',
      });

      expect(readResult.success).toBe(false);
      expect(readResult.error).toContain('outside workspace');

      const writeResult = await agent.executeTool('write_file', {
        path: '../outside.txt',
        content: 'malicious',
      });

      expect(writeResult.success).toBe(false);
      expect(writeResult.error).toContain('outside workspace');
    });
  });

  describe('agent info', () => {
    it('should report correct tool count', () => {
      const info = agent.getInfo();

      expect(info.toolCount).toBe(3);
      expect(info.name).toBe('FileAgent');
    });
  });
});
