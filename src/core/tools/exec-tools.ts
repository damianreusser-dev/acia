/**
 * Execution Tools
 *
 * Provides sandboxed command execution for agents.
 * Commands are executed within a configured workspace directory.
 *
 * SECURITY NOTES:
 * - shell: false is used to prevent shell injection attacks
 * - All paths are validated against the workspace boundary
 * - Only allowlisted commands and scripts are permitted
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { Tool, ToolDefinition, ToolResult } from './types.js';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Default timeout for command execution (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Timeout for test execution (60 seconds) */
const TEST_TIMEOUT_MS = 60_000;

/**
 * Validate that a path is within the workspace boundary.
 * Prevents path traversal attacks (e.g., "../../../etc/passwd").
 */
function isPathWithinWorkspace(workspacePath: string, filePath: string): boolean {
  const normalizedWorkspace = path.normalize(workspacePath);
  const resolvedPath = path.resolve(workspacePath, filePath);
  return resolvedPath.startsWith(normalizedWorkspace + path.sep) || resolvedPath === normalizedWorkspace;
}

/**
 * Sanitize a file path to prevent injection.
 * Rejects paths containing shell metacharacters.
 */
function sanitizePath(filePath: string): { valid: boolean; error?: string } {
  // Reject paths with shell metacharacters
  const dangerousChars = /[;&|`$(){}[\]<>!#*?\\'"]/;
  if (dangerousChars.test(filePath)) {
    return { valid: false, error: 'Path contains invalid characters' };
  }

  // Reject paths with null bytes
  if (filePath.includes('\0')) {
    return { valid: false, error: 'Path contains null bytes' };
  }

  // Reject absolute paths on Windows (drive letters) or Unix
  if (/^[a-zA-Z]:/.test(filePath) || filePath.startsWith('/')) {
    return { valid: false, error: 'Absolute paths are not allowed' };
  }

  return { valid: true };
}

/**
 * Determine if we're running on Windows.
 * Used to adjust command execution for platform differences.
 */
const IS_WINDOWS = process.platform === 'win32';

/**
 * Execute a command with timeout.
 *
 * SECURITY NOTES:
 * - On Unix: shell: false is used to prevent shell injection attacks
 * - On Windows: We must use shell: true for npm/npx commands (they are .cmd files)
 *   BUT we pre-validate all arguments through sanitizePath() before execution
 *   so no untrusted user input reaches the shell
 * - All file paths are validated against:
 *   1. Dangerous character blocklist (sanitizePath)
 *   2. Workspace boundary check (isPathWithinWorkspace)
 *   3. Extension allowlist (.ts, .js, .test.ts, .test.js)
 */
async function execCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ExecResult> {
  return new Promise((resolve) => {
    // On Windows, npm/npx are .cmd files that require shell to run
    // This is safe because we pre-validate all arguments through sanitizePath()
    // and isPathWithinWorkspace() before they reach this function
    const useShell = IS_WINDOWS && (command === 'npm' || command === 'npx');

    const proc = spawn(command, args, {
      cwd,
      shell: useShell,
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1,
      });
    });

    proc.on('error', (err) => {
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}

/**
 * Tool to run npm scripts in the workspace
 */
export class RunNpmScriptTool implements Tool {
  private workspacePath: string;
  private allowedScripts: Set<string>;

  constructor(workspacePath: string, allowedScripts: string[] = ['test', 'build', 'typecheck']) {
    this.workspacePath = workspacePath;
    this.allowedScripts = new Set(allowedScripts);
  }

  get definition(): ToolDefinition {
    const scripts = Array.from(this.allowedScripts).join(', ');
    return {
      name: 'run_npm_script',
      description: `Run an npm script in the workspace. Allowed scripts: ${scripts}`,
      parameters: [
        {
          name: 'script',
          type: 'string',
          description: 'The npm script to run (e.g., "test", "build")',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const script = params['script'];

    if (typeof script !== 'string') {
      return { success: false, error: 'Parameter "script" must be a string' };
    }

    if (!this.allowedScripts.has(script)) {
      return {
        success: false,
        error: `Script "${script}" is not allowed. Allowed scripts: ${Array.from(this.allowedScripts).join(', ')}`,
      };
    }

    const result = await execCommand('npm', ['run', script], this.workspacePath);

    const output = [
      result.stdout && `STDOUT:\n${result.stdout}`,
      result.stderr && `STDERR:\n${result.stderr}`,
      `Exit code: ${result.exitCode}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      success: result.exitCode === 0,
      output,
      error: result.exitCode !== 0 ? `Script failed with exit code ${result.exitCode}` : undefined,
    };
  }
}

/**
 * Tool to run a single test file
 */
export class RunTestFileTool implements Tool {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  get definition(): ToolDefinition {
    return {
      name: 'run_test_file',
      description: 'Run a specific test file using vitest',
      parameters: [
        {
          name: 'testFile',
          type: 'string',
          description: 'Relative path to the test file (e.g., "tests/unit/math.test.ts")',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const testFile = params['testFile'];

    if (typeof testFile !== 'string') {
      return { success: false, error: 'Parameter "testFile" must be a string' };
    }

    // Validate the test file path
    if (!testFile.endsWith('.test.ts') && !testFile.endsWith('.test.js')) {
      return { success: false, error: 'Test file must end with .test.ts or .test.js' };
    }

    // SECURITY: Sanitize path to prevent injection
    const sanitizeResult = sanitizePath(testFile);
    if (!sanitizeResult.valid) {
      return { success: false, error: `Invalid test file path: ${sanitizeResult.error}` };
    }

    // SECURITY: Prevent path traversal attacks
    if (!isPathWithinWorkspace(this.workspacePath, testFile)) {
      return { success: false, error: 'Access denied: test file path is outside workspace' };
    }

    const result = await execCommand(
      'npx',
      ['vitest', 'run', testFile, '--reporter=verbose'],
      this.workspacePath,
      TEST_TIMEOUT_MS
    );

    const output = [
      result.stdout && `STDOUT:\n${result.stdout}`,
      result.stderr && `STDERR:\n${result.stderr}`,
      `Exit code: ${result.exitCode}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      success: result.exitCode === 0,
      output,
      error: result.exitCode !== 0 ? 'Tests failed' : undefined,
    };
  }
}

/**
 * Tool to execute TypeScript/JavaScript code directly
 */
export class RunCodeTool implements Tool {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  get definition(): ToolDefinition {
    return {
      name: 'run_code',
      description: 'Execute a TypeScript or JavaScript file in the workspace',
      parameters: [
        {
          name: 'file',
          type: 'string',
          description: 'Relative path to the file to execute (e.g., "src/main.ts")',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const file = params['file'];

    if (typeof file !== 'string') {
      return { success: false, error: 'Parameter "file" must be a string' };
    }

    // Only allow .ts and .js files
    if (!file.endsWith('.ts') && !file.endsWith('.js')) {
      return { success: false, error: 'File must be a .ts or .js file' };
    }

    // SECURITY: Sanitize path to prevent injection
    const sanitizeResult = sanitizePath(file);
    if (!sanitizeResult.valid) {
      return { success: false, error: `Invalid file path: ${sanitizeResult.error}` };
    }

    // SECURITY: Prevent path traversal attacks
    if (!isPathWithinWorkspace(this.workspacePath, file)) {
      return { success: false, error: 'Access denied: path is outside workspace' };
    }

    const result = await execCommand(
      'npx',
      ['tsx', file],
      this.workspacePath,
      DEFAULT_TIMEOUT_MS
    );

    const output = [
      result.stdout && `STDOUT:\n${result.stdout}`,
      result.stderr && `STDERR:\n${result.stderr}`,
      `Exit code: ${result.exitCode}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      success: result.exitCode === 0,
      output,
      error: result.exitCode !== 0 ? `Execution failed with exit code ${result.exitCode}` : undefined,
    };
  }
}

/**
 * Creates all execution tools configured for a workspace
 */
export function createExecTools(
  workspacePath: string,
  allowedNpmScripts: string[] = ['test', 'build', 'typecheck']
): Tool[] {
  return [
    new RunNpmScriptTool(workspacePath, allowedNpmScripts),
    new RunTestFileTool(workspacePath),
    new RunCodeTool(workspacePath),
  ];
}
