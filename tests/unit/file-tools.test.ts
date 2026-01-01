/**
 * Unit tests for File Tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  ReadFileTool,
  WriteFileTool,
  ListDirectoryTool,
  createFileTools,
} from '../../src/core/tools/file-tools.js';

describe('File Tools', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    // Create a temporary workspace for each test
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-test-'));
  });

  afterEach(async () => {
    // Clean up temporary workspace
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  describe('ReadFileTool', () => {
    it('should read an existing file', async () => {
      const tool = new ReadFileTool(testWorkspace);
      const testFile = path.join(testWorkspace, 'test.txt');
      await fs.writeFile(testFile, 'Hello, World!');

      const result = await tool.execute({ path: 'test.txt' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!');
    });

    it('should return error for non-existent file', async () => {
      const tool = new ReadFileTool(testWorkspace);

      const result = await tool.execute({ path: 'nonexistent.txt' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should prevent directory traversal', async () => {
      const tool = new ReadFileTool(testWorkspace);

      const result = await tool.execute({ path: '../../../etc/passwd' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside workspace');
    });

    it('should handle nested paths', async () => {
      const tool = new ReadFileTool(testWorkspace);
      const nestedDir = path.join(testWorkspace, 'sub', 'dir');
      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(path.join(nestedDir, 'nested.txt'), 'Nested content');

      const result = await tool.execute({ path: 'sub/dir/nested.txt' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Nested content');
    });

    it('should return error for invalid path parameter', async () => {
      const tool = new ReadFileTool(testWorkspace);

      const result = await tool.execute({ path: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a string');
    });
  });

  describe('WriteFileTool', () => {
    it('should write a new file', async () => {
      const tool = new WriteFileTool(testWorkspace);

      const result = await tool.execute({
        path: 'newfile.txt',
        content: 'New content',
      });

      expect(result.success).toBe(true);
      const written = await fs.readFile(
        path.join(testWorkspace, 'newfile.txt'),
        'utf-8'
      );
      expect(written).toBe('New content');
    });

    it('should overwrite existing file', async () => {
      const tool = new WriteFileTool(testWorkspace);
      await fs.writeFile(path.join(testWorkspace, 'existing.txt'), 'Old');

      const result = await tool.execute({
        path: 'existing.txt',
        content: 'New',
      });

      expect(result.success).toBe(true);
      const written = await fs.readFile(
        path.join(testWorkspace, 'existing.txt'),
        'utf-8'
      );
      expect(written).toBe('New');
    });

    it('should create parent directories', async () => {
      const tool = new WriteFileTool(testWorkspace);

      const result = await tool.execute({
        path: 'deep/nested/dir/file.txt',
        content: 'Deep content',
      });

      expect(result.success).toBe(true);
      const written = await fs.readFile(
        path.join(testWorkspace, 'deep/nested/dir/file.txt'),
        'utf-8'
      );
      expect(written).toBe('Deep content');
    });

    it('should prevent directory traversal', async () => {
      const tool = new WriteFileTool(testWorkspace);

      const result = await tool.execute({
        path: '../outside.txt',
        content: 'Malicious',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside workspace');
    });

    it('should return error for missing content', async () => {
      const tool = new WriteFileTool(testWorkspace);

      const result = await tool.execute({ path: 'file.txt' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a string');
    });
  });

  describe('ListDirectoryTool', () => {
    it('should list files and directories', async () => {
      const tool = new ListDirectoryTool(testWorkspace);
      await fs.writeFile(path.join(testWorkspace, 'file1.txt'), '');
      await fs.writeFile(path.join(testWorkspace, 'file2.txt'), '');
      await fs.mkdir(path.join(testWorkspace, 'subdir'));

      const result = await tool.execute({ path: '.' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('[FILE] file1.txt');
      expect(result.output).toContain('[FILE] file2.txt');
      expect(result.output).toContain('[DIR] subdir');
    });

    it('should list nested directory', async () => {
      const tool = new ListDirectoryTool(testWorkspace);
      const subdir = path.join(testWorkspace, 'subdir');
      await fs.mkdir(subdir);
      await fs.writeFile(path.join(subdir, 'nested.txt'), '');

      const result = await tool.execute({ path: 'subdir' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('[FILE] nested.txt');
    });

    it('should handle empty directory', async () => {
      const tool = new ListDirectoryTool(testWorkspace);
      await fs.mkdir(path.join(testWorkspace, 'empty'));

      const result = await tool.execute({ path: 'empty' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('(empty directory)');
    });

    it('should return error for non-existent directory', async () => {
      const tool = new ListDirectoryTool(testWorkspace);

      const result = await tool.execute({ path: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Directory not found');
    });

    it('should prevent directory traversal', async () => {
      const tool = new ListDirectoryTool(testWorkspace);

      const result = await tool.execute({ path: '../..' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside workspace');
    });
  });

  describe('createFileTools', () => {
    it('should create all three tools', () => {
      const tools = createFileTools(testWorkspace);

      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.definition.name)).toEqual([
        'read_file',
        'write_file',
        'list_directory',
      ]);
    });
  });
});
