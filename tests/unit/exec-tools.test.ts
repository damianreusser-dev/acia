/**
 * Unit tests for Execution Tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  RunNpmScriptTool,
  RunTestFileTool,
  RunCodeTool,
  createExecTools,
} from '../../src/core/tools/exec-tools.js';

describe('Execution Tools', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-exec-test-'));
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  describe('RunNpmScriptTool', () => {
    it('should have correct definition', () => {
      const tool = new RunNpmScriptTool(testWorkspace, ['test', 'build']);
      const def = tool.definition;

      expect(def.name).toBe('run_npm_script');
      expect(def.description).toContain('test');
      expect(def.description).toContain('build');
    });

    it('should reject non-string script parameter', async () => {
      const tool = new RunNpmScriptTool(testWorkspace);

      const result = await tool.execute({ script: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a string');
    });

    it('should reject disallowed scripts', async () => {
      const tool = new RunNpmScriptTool(testWorkspace, ['test']);

      const result = await tool.execute({ script: 'dangerous-script' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });
  });

  describe('RunTestFileTool', () => {
    it('should have correct definition', () => {
      const tool = new RunTestFileTool(testWorkspace);
      const def = tool.definition;

      expect(def.name).toBe('run_test_file');
      expect(def.parameters).toHaveLength(1);
      expect(def.parameters[0]?.name).toBe('testFile');
    });

    it('should reject non-test files', async () => {
      const tool = new RunTestFileTool(testWorkspace);

      const result = await tool.execute({ testFile: 'src/main.ts' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('.test.ts or .test.js');
    });

    it('should reject non-string parameter', async () => {
      const tool = new RunTestFileTool(testWorkspace);

      const result = await tool.execute({ testFile: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a string');
    });
  });

  describe('RunCodeTool', () => {
    it('should have correct definition', () => {
      const tool = new RunCodeTool(testWorkspace);
      const def = tool.definition;

      expect(def.name).toBe('run_code');
      expect(def.parameters[0]?.name).toBe('file');
    });

    it('should reject non-ts/js files', async () => {
      const tool = new RunCodeTool(testWorkspace);

      const result = await tool.execute({ file: 'script.py' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('.ts or .js');
    });

    it('should prevent path traversal', async () => {
      const tool = new RunCodeTool(testWorkspace);

      const result = await tool.execute({ file: '../../../etc/passwd.ts' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside workspace');
    });

    it('should reject non-string parameter', async () => {
      const tool = new RunCodeTool(testWorkspace);

      const result = await tool.execute({ file: null });

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a string');
    });

    it('should execute a simple TypeScript file', async () => {
      const tool = new RunCodeTool(testWorkspace);

      // Create a simple TS file
      await fs.writeFile(
        path.join(testWorkspace, 'hello.ts'),
        'console.log("Hello from ACIA!");'
      );

      const result = await tool.execute({ file: 'hello.ts' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello from ACIA!');
    }, 15000); // tsx startup can be slow

    it('should capture errors from failing code', async () => {
      const tool = new RunCodeTool(testWorkspace);

      // Create a file with a runtime error
      await fs.writeFile(
        path.join(testWorkspace, 'error.ts'),
        'throw new Error("Intentional error");'
      );

      const result = await tool.execute({ file: 'error.ts' });

      expect(result.success).toBe(false);
      expect(result.output).toContain('Intentional error');
    }, 15000); // tsx startup can be slow
  });

  describe('createExecTools', () => {
    it('should create all three tools', () => {
      const tools = createExecTools(testWorkspace);

      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.definition.name)).toEqual([
        'run_npm_script',
        'run_test_file',
        'run_code',
      ]);
    });

    it('should allow custom npm scripts', () => {
      const tools = createExecTools(testWorkspace, ['custom', 'scripts']);
      const npmTool = tools.find((t) => t.definition.name === 'run_npm_script');

      expect(npmTool?.definition.description).toContain('custom');
      expect(npmTool?.definition.description).toContain('scripts');
    });
  });
});
