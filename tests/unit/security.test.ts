/**
 * Security Tests
 *
 * Tests for security-critical functionality:
 * - Path traversal prevention
 * - Shell injection prevention
 * - Input validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { RunTestFileTool, RunCodeTool, RunNpmScriptTool } from '../../src/core/tools/exec-tools.js';

describe('Security Tests', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-security-test-'));
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  describe('Path Traversal Prevention', () => {
    describe('RunTestFileTool', () => {
      it('should reject path traversal with ../', async () => {
        const tool = new RunTestFileTool(testWorkspace);
        const result = await tool.execute({
          testFile: '../../../etc/passwd.test.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('outside workspace');
      });

      it('should reject path traversal with multiple ../', async () => {
        const tool = new RunTestFileTool(testWorkspace);
        const result = await tool.execute({
          testFile: 'tests/../../../../../../etc/passwd.test.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('outside workspace');
      });

      it('should reject absolute paths on Unix', async () => {
        const tool = new RunTestFileTool(testWorkspace);
        const result = await tool.execute({
          testFile: '/etc/passwd.test.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Absolute paths are not allowed');
      });

      it('should reject absolute paths on Windows', async () => {
        const tool = new RunTestFileTool(testWorkspace);
        const result = await tool.execute({
          testFile: 'C:\\Windows\\system32\\test.test.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it(
        'should allow valid relative paths within workspace',
        async () => {
          const tool = new RunTestFileTool(testWorkspace);
          // Create a test file
          await fs.mkdir(path.join(testWorkspace, 'tests'), { recursive: true });
          await fs.writeFile(
            path.join(testWorkspace, 'tests', 'valid.test.ts'),
            'import { test } from "vitest"; test("pass", () => {});'
          );

          const result = await tool.execute({
            testFile: 'tests/valid.test.ts',
          });

          // May fail due to vitest not being installed, but shouldn't fail security check
          if (!result.success && result.error) {
            expect(result.error).not.toContain('outside workspace');
            expect(result.error).not.toContain('invalid characters');
          }
        },
        15000 // 15s timeout for vitest execution
      );
    });

    describe('RunCodeTool', () => {
      it('should reject path traversal with ../', async () => {
        const tool = new RunCodeTool(testWorkspace);
        const result = await tool.execute({
          file: '../../../etc/passwd.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('outside workspace');
      });

      it('should reject absolute paths', async () => {
        const tool = new RunCodeTool(testWorkspace);
        const result = await tool.execute({
          file: '/etc/passwd.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Absolute paths are not allowed');
      });
    });
  });

  describe('Shell Injection Prevention', () => {
    describe('RunTestFileTool', () => {
      // Test with valid extension format to verify sanitization works
      it('should reject shell metacharacters in path - semicolon', async () => {
        const tool = new RunTestFileTool(testWorkspace);
        const result = await tool.execute({
          testFile: 'foo;rm.test.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject shell metacharacters in path - pipe', async () => {
        const tool = new RunTestFileTool(testWorkspace);
        const result = await tool.execute({
          testFile: 'foo|cat.test.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject shell metacharacters in path - backticks', async () => {
        const tool = new RunTestFileTool(testWorkspace);
        const result = await tool.execute({
          testFile: 'foo`whoami`.test.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject shell metacharacters in path - $(...)', async () => {
        const tool = new RunTestFileTool(testWorkspace);
        const result = await tool.execute({
          testFile: '$(whoami).test.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject shell metacharacters in path - &&', async () => {
        const tool = new RunTestFileTool(testWorkspace);
        const result = await tool.execute({
          testFile: 'foo&&bar.test.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject null bytes in path', async () => {
        const tool = new RunTestFileTool(testWorkspace);
        const result = await tool.execute({
          testFile: 'test\0mal.test.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('null bytes');
      });

      // Multiple layers of defense - extension check is an additional security layer
      it('should reject injection attempts that fail extension check (defense in depth)', async () => {
        const tool = new RunTestFileTool(testWorkspace);
        const result = await tool.execute({
          testFile: 'test.test.ts; rm -rf /',
        });

        // Extension check fails, but this is still a valid security control
        expect(result.success).toBe(false);
      });
    });

    describe('RunCodeTool', () => {
      it('should reject shell metacharacters in path - semicolon', async () => {
        const tool = new RunCodeTool(testWorkspace);
        const result = await tool.execute({
          file: 'foo;bar.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject command substitution in path', async () => {
        const tool = new RunCodeTool(testWorkspace);
        const result = await tool.execute({
          file: '$(whoami).ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject pipe in path', async () => {
        const tool = new RunCodeTool(testWorkspace);
        const result = await tool.execute({
          file: 'foo|bar.ts',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('invalid characters');
      });
    });

    describe('RunNpmScriptTool', () => {
      it('should reject scripts not in allowlist', async () => {
        const tool = new RunNpmScriptTool(testWorkspace, ['test', 'build']);
        const result = await tool.execute({
          script: 'malicious-script',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not allowed');
      });

      it('should reject scripts with shell injection attempts', async () => {
        const tool = new RunNpmScriptTool(testWorkspace, ['test', 'build']);
        const result = await tool.execute({
          script: 'test; rm -rf /',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not allowed');
      });

      it('should allow only allowlisted scripts', async () => {
        const tool = new RunNpmScriptTool(testWorkspace, ['test', 'build']);

        // Test script should be allowed
        const testResult = await tool.execute({ script: 'test' });
        // May fail because no package.json, but not a security rejection
        if (!testResult.success && testResult.error) {
          expect(testResult.error).not.toContain('not allowed');
        }
      });
    });
  });

  describe('Input Validation', () => {
    it('should reject non-string testFile parameter', async () => {
      const tool = new RunTestFileTool(testWorkspace);
      const result = await tool.execute({
        testFile: 123 as unknown as string,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a string');
    });

    it('should reject non-string file parameter', async () => {
      const tool = new RunCodeTool(testWorkspace);
      const result = await tool.execute({
        file: { path: 'test.ts' } as unknown as string,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a string');
    });

    it('should reject files without .test.ts or .test.js extension for test tool', async () => {
      const tool = new RunTestFileTool(testWorkspace);
      const result = await tool.execute({
        testFile: 'src/main.ts',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('.test.ts or .test.js');
    });

    it('should reject files without .ts or .js extension for code tool', async () => {
      const tool = new RunCodeTool(testWorkspace);
      const result = await tool.execute({
        file: 'config.json',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('.ts or .js');
    });
  });
});
