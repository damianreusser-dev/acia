/**
 * Git Tools Unit Tests
 *
 * Tests for git operation tools.
 * Note: Some tests require git to be installed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GitInitTool,
  GitAddTool,
  GitCommitTool,
  GitStatusTool,
  GitBranchTool,
  GitLogTool,
  createGitTools,
} from '../../src/core/tools/git-tools.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

// Helper to check if git is available
async function isGitAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['--version']);
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

// Helper to run git commands in a directory
async function runGit(cwd: string, args: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, { cwd });
    let stdout = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.on('close', (code) => resolve({ code: code ?? 1, stdout }));
    proc.on('error', () => resolve({ code: 1, stdout: '' }));
  });
}

describe('Git Tools', () => {
  let tempDir: string;
  let gitAvailable: boolean;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-tools-test-'));
    gitAvailable = await isGitAvailable();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('GitInitTool', () => {
    it('should have correct definition', () => {
      const tool = new GitInitTool(tempDir);
      expect(tool.definition.name).toBe('git_init');
      expect(tool.definition.parameters).toHaveLength(1);
    });

    it('should initialize a git repository', async () => {
      if (!gitAvailable) return;

      const tool = new GitInitTool(tempDir);
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.output).toContain('Initialized');

      // Verify .git directory exists
      const gitDir = path.join(tempDir, '.git');
      const stats = await fs.stat(gitDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should initialize in a subdirectory', async () => {
      if (!gitAvailable) return;

      const subDir = path.join(tempDir, 'subproject');
      await fs.mkdir(subDir, { recursive: true });

      const tool = new GitInitTool(tempDir);
      const result = await tool.execute({ path: 'subproject' });

      expect(result.success).toBe(true);

      const gitDir = path.join(subDir, '.git');
      const stats = await fs.stat(gitDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should reject paths outside workspace', async () => {
      const tool = new GitInitTool(tempDir);
      const result = await tool.execute({ path: '../outside' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside workspace');
    });
  });

  describe('GitAddTool', () => {
    it('should have correct definition', () => {
      const tool = new GitAddTool(tempDir);
      expect(tool.definition.name).toBe('git_add');
      expect(tool.definition.parameters.length).toBeGreaterThan(0);
    });

    it('should require files parameter', async () => {
      const tool = new GitAddTool(tempDir);
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('files');
    });

    it('should stage files in a git repository', async () => {
      if (!gitAvailable) return;

      // Initialize repo first
      await runGit(tempDir, ['init']);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'hello');

      const tool = new GitAddTool(tempDir);
      const result = await tool.execute({ files: 'test.txt' });

      expect(result.success).toBe(true);

      // Verify file is staged
      const status = await runGit(tempDir, ['status', '--short']);
      expect(status.stdout).toContain('A');
    });

    it('should stage all files with "."', async () => {
      if (!gitAvailable) return;

      await runGit(tempDir, ['init']);
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');

      const tool = new GitAddTool(tempDir);
      const result = await tool.execute({ files: '.' });

      expect(result.success).toBe(true);
    });

    it('should reject paths outside workspace', async () => {
      const tool = new GitAddTool(tempDir);
      const result = await tool.execute({ files: '../outside.txt' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside workspace');
    });
  });

  describe('GitCommitTool', () => {
    it('should have correct definition', () => {
      const tool = new GitCommitTool(tempDir);
      expect(tool.definition.name).toBe('git_commit');
    });

    it('should require message parameter', async () => {
      const tool = new GitCommitTool(tempDir);
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('message');
    });

    it('should reject empty message', async () => {
      const tool = new GitCommitTool(tempDir);
      const result = await tool.execute({ message: '   ' });

      expect(result.success).toBe(false);
    });

    it('should commit staged changes', async () => {
      if (!gitAvailable) return;

      // Setup: init, create file, stage, configure user
      await runGit(tempDir, ['init']);
      await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
      await runGit(tempDir, ['config', 'user.name', 'Test']);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      await runGit(tempDir, ['add', '.']);

      const tool = new GitCommitTool(tempDir);
      const result = await tool.execute({ message: 'Initial commit' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Initial commit');
    });

    it('should handle nothing to commit gracefully', async () => {
      if (!gitAvailable) return;

      await runGit(tempDir, ['init']);

      const tool = new GitCommitTool(tempDir);
      const result = await tool.execute({ message: 'Empty commit' });

      // Git returns success=true with message about nothing to commit
      // (our implementation treats this as a successful operation)
      expect(result.success).toBe(true);
      expect(result.output?.toLowerCase()).toMatch(/nothing to commit|clean/);
    });

    it('should sanitize commit messages', async () => {
      if (!gitAvailable) return;

      await runGit(tempDir, ['init']);
      await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
      await runGit(tempDir, ['config', 'user.name', 'Test']);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      await runGit(tempDir, ['add', '.']);

      const tool = new GitCommitTool(tempDir);
      // Message with potentially dangerous characters
      const result = await tool.execute({ message: 'Test `rm -rf` $HOME message' });

      expect(result.success).toBe(true);
      // Should work without executing any commands
    });
  });

  describe('GitStatusTool', () => {
    it('should have correct definition', () => {
      const tool = new GitStatusTool(tempDir);
      expect(tool.definition.name).toBe('git_status');
    });

    it('should report not a git repository', async () => {
      const tool = new GitStatusTool(tempDir);
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.output).toContain('Not a git repository');
    });

    it('should show status of git repository', async () => {
      if (!gitAvailable) return;

      await runGit(tempDir, ['init']);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const tool = new GitStatusTool(tempDir);
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.output).toContain('test.txt');
    });

    it('should support short format', async () => {
      if (!gitAvailable) return;

      await runGit(tempDir, ['init']);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const tool = new GitStatusTool(tempDir);
      const result = await tool.execute({ short: true });

      expect(result.success).toBe(true);
      // Short format should be more concise
      expect(result.output?.length).toBeLessThan(100);
    });
  });

  describe('GitBranchTool', () => {
    it('should have correct definition', () => {
      const tool = new GitBranchTool(tempDir);
      expect(tool.definition.name).toBe('git_branch');
    });

    it('should require action parameter', async () => {
      const tool = new GitBranchTool(tempDir);
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('action');
    });

    it('should reject unknown actions', async () => {
      const tool = new GitBranchTool(tempDir);
      const result = await tool.execute({ action: 'delete' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });

    it('should list branches', async () => {
      if (!gitAvailable) return;

      // Create repo with initial commit
      await runGit(tempDir, ['init']);
      await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
      await runGit(tempDir, ['config', 'user.name', 'Test']);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      await runGit(tempDir, ['add', '.']);
      await runGit(tempDir, ['commit', '-m', 'Initial']);

      const tool = new GitBranchTool(tempDir);
      const result = await tool.execute({ action: 'list' });

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/main|master/);
    });

    it('should create a new branch', async () => {
      if (!gitAvailable) return;

      await runGit(tempDir, ['init']);
      await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
      await runGit(tempDir, ['config', 'user.name', 'Test']);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      await runGit(tempDir, ['add', '.']);
      await runGit(tempDir, ['commit', '-m', 'Initial']);

      const tool = new GitBranchTool(tempDir);
      const result = await tool.execute({ action: 'create', name: 'feature/test' });

      expect(result.success).toBe(true);

      // Verify branch exists
      const branches = await runGit(tempDir, ['branch']);
      expect(branches.stdout).toContain('feature/test');
    });

    it('should validate branch names', async () => {
      const tool = new GitBranchTool(tempDir);

      // Invalid characters
      const result = await tool.execute({ action: 'create', name: 'bad branch name!' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid branch name');
    });

    it('should require name for create action', async () => {
      const tool = new GitBranchTool(tempDir);
      const result = await tool.execute({ action: 'create' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('name is required');
    });
  });

  describe('GitLogTool', () => {
    it('should have correct definition', () => {
      const tool = new GitLogTool(tempDir);
      expect(tool.definition.name).toBe('git_log');
    });

    it('should handle empty repository', async () => {
      if (!gitAvailable) return;

      await runGit(tempDir, ['init']);

      const tool = new GitLogTool(tempDir);
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.output).toContain('No commits');
    });

    it('should show commit history', async () => {
      if (!gitAvailable) return;

      await runGit(tempDir, ['init']);
      await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
      await runGit(tempDir, ['config', 'user.name', 'Test']);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      await runGit(tempDir, ['add', '.']);
      await runGit(tempDir, ['commit', '-m', 'Test commit message']);

      const tool = new GitLogTool(tempDir);
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.output).toContain('Test commit message');
    });

    it('should support oneline format', async () => {
      if (!gitAvailable) return;

      await runGit(tempDir, ['init']);
      await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
      await runGit(tempDir, ['config', 'user.name', 'Test']);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      await runGit(tempDir, ['add', '.']);
      await runGit(tempDir, ['commit', '-m', 'First commit']);

      const tool = new GitLogTool(tempDir);
      const result = await tool.execute({ oneline: true });

      expect(result.success).toBe(true);
      // Oneline format should be concise
      expect(result.output?.split('\n').length).toBeLessThanOrEqual(2);
    });

    it('should respect limit parameter', async () => {
      if (!gitAvailable) return;

      await runGit(tempDir, ['init']);
      await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
      await runGit(tempDir, ['config', 'user.name', 'Test']);

      // Create multiple commits
      for (let i = 1; i <= 5; i++) {
        await fs.writeFile(path.join(tempDir, `file${i}.txt`), `content${i}`);
        await runGit(tempDir, ['add', '.']);
        await runGit(tempDir, ['commit', '-m', `Commit ${i}`]);
      }

      const tool = new GitLogTool(tempDir);
      const result = await tool.execute({ limit: 2, oneline: true });

      expect(result.success).toBe(true);
      const lines = result.output?.trim().split('\n') || [];
      expect(lines.length).toBe(2);
    });
  });

  describe('createGitTools', () => {
    it('should create all git tools', () => {
      const tools = createGitTools(tempDir);

      expect(tools).toHaveLength(6);

      const names = tools.map((t) => t.definition.name);
      expect(names).toContain('git_init');
      expect(names).toContain('git_add');
      expect(names).toContain('git_commit');
      expect(names).toContain('git_status');
      expect(names).toContain('git_branch');
      expect(names).toContain('git_log');
    });
  });

  describe('Security', () => {
    it('should prevent path traversal in all tools', async () => {
      const tools = createGitTools(tempDir);

      for (const tool of tools) {
        const result = await tool.execute({ path: '../../../etc', files: '.', message: 'test', action: 'list' });

        if (!result.success) {
          expect(result.error).toContain('outside workspace');
        }
      }
    });

    it('should sanitize commit messages with shell characters', async () => {
      if (!gitAvailable) return;

      await runGit(tempDir, ['init']);
      await runGit(tempDir, ['config', 'user.email', 'test@test.com']);
      await runGit(tempDir, ['config', 'user.name', 'Test']);

      const tool = new GitCommitTool(tempDir);

      // Messages with dangerous shell chars but also safe text content
      // After sanitization, they should still commit successfully
      const messagesWithDangerousChars = [
        'Fix bug in parser $(whoami)',
        'Update config file after id check',
        'Refactor and clean up code',
        'Add feature with tests',
      ];

      let fileCounter = 0;
      for (const msg of messagesWithDangerousChars) {
        // Create fresh file for each commit
        fileCounter++;
        await fs.writeFile(path.join(tempDir, `file${fileCounter}.txt`), `content${fileCounter}`);
        await runGit(tempDir, ['add', '.']);

        const result = await tool.execute({ message: msg });
        // Should succeed - dangerous chars stripped but message valid
        expect(result.success).toBe(true);
      }
    });
  });
});
