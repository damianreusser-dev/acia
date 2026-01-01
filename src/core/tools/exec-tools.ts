/**
 * Execution Tools
 *
 * Provides sandboxed command execution for agents.
 * Commands are executed within a configured workspace directory.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { Tool, ToolDefinition, ToolResult } from './types.js';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a command with timeout
 */
async function execCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number = 30000
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      shell: true,
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

    const result = await execCommand(
      'npx',
      ['vitest', 'run', testFile, '--reporter=verbose'],
      this.workspacePath,
      60000 // 60 second timeout for tests
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

    // Security: prevent path traversal
    const resolvedPath = path.resolve(this.workspacePath, file);
    if (!resolvedPath.startsWith(path.normalize(this.workspacePath))) {
      return { success: false, error: 'Access denied: path is outside workspace' };
    }

    const result = await execCommand(
      'npx',
      ['tsx', file],
      this.workspacePath,
      30000 // 30 second timeout
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
