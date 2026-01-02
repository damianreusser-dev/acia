/**
 * Git Operation Tools
 *
 * Provides sandboxed git operations for agents.
 * Operations are restricted to the configured workspace.
 *
 * Security considerations:
 * - No remote operations without explicit approval
 * - Path validation to prevent escaping workspace
 * - Input sanitization for commit messages
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { Tool, ToolDefinition, ToolResult } from './types.js';

export class GitToolsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitToolsError';
  }
}

/**
 * Validates that a path is within the workspace
 */
function validateWorkspacePath(workspacePath: string, targetPath: string): string {
  const resolved = path.resolve(workspacePath, targetPath);
  const normalizedWorkspace = path.normalize(workspacePath);

  if (!resolved.startsWith(normalizedWorkspace)) {
    throw new GitToolsError(
      `Access denied: path "${targetPath}" is outside workspace`
    );
  }

  return resolved;
}

/**
 * Sanitize string for git command arguments
 * Prevents shell injection when messages are used
 */
function sanitizeGitArg(input: string): string {
  // Remove potentially dangerous characters
  return input
    // eslint-disable-next-line no-control-regex -- intentionally removing control chars for security
    .replace(/[\x00-\x1f\x7f]/g, '') // Control characters
    .replace(/[`$\\]/g, '') // Shell special chars
    .trim();
}

/**
 * Execute a git command in the specified directory
 */
async function executeGitCommand(
  cwd: string,
  args: string[],
  timeout = 30000
): Promise<{ success: boolean; stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, {
      cwd,
      shell: false, // Security: avoid shell interpretation
      timeout,
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
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: code ?? 1,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        stdout: '',
        stderr: err.message,
        code: 1,
      });
    });
  });
}

/**
 * Initialize a git repository
 */
export class GitInitTool implements Tool {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  get definition(): ToolDefinition {
    return {
      name: 'git_init',
      description: 'Initialize a new git repository in a directory',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Relative path to the directory (default: workspace root)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const relativePath = params['path'];
    const targetPath = typeof relativePath === 'string' && relativePath
      ? relativePath
      : '.';

    try {
      const safePath = validateWorkspacePath(this.workspacePath, targetPath);
      const result = await executeGitCommand(safePath, ['init']);

      if (result.success) {
        return {
          success: true,
          output: result.stdout || `Initialized empty Git repository in ${safePath}`,
        };
      }

      return {
        success: false,
        error: result.stderr || 'Failed to initialize git repository',
      };
    } catch (error) {
      if (error instanceof GitToolsError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Stage files for commit
 */
export class GitAddTool implements Tool {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  get definition(): ToolDefinition {
    return {
      name: 'git_add',
      description: 'Stage files for commit',
      parameters: [
        {
          name: 'files',
          type: 'string',
          description: 'Files to stage (space-separated paths, or "." for all)',
          required: true,
        },
        {
          name: 'path',
          type: 'string',
          description: 'Repository path (default: workspace root)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const files = params['files'];
    const relativePath = params['path'];

    if (typeof files !== 'string' || !files.trim()) {
      return { success: false, error: 'Parameter "files" must be a non-empty string' };
    }

    const repoPath = typeof relativePath === 'string' && relativePath
      ? relativePath
      : '.';

    try {
      const safePath = validateWorkspacePath(this.workspacePath, repoPath);

      // Split files and validate each path
      const fileList = files.split(/\s+/).filter(f => f.trim());

      // Validate each file path (unless it's "." for all)
      for (const file of fileList) {
        if (file !== '.' && file !== '-A' && file !== '--all') {
          validateWorkspacePath(safePath, file);
        }
      }

      const result = await executeGitCommand(safePath, ['add', ...fileList]);

      if (result.success) {
        return {
          success: true,
          output: result.stdout || `Staged: ${files}`,
        };
      }

      return {
        success: false,
        error: result.stderr || 'Failed to stage files',
      };
    } catch (error) {
      if (error instanceof GitToolsError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Commit staged changes
 */
export class GitCommitTool implements Tool {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  get definition(): ToolDefinition {
    return {
      name: 'git_commit',
      description: 'Commit staged changes with a message',
      parameters: [
        {
          name: 'message',
          type: 'string',
          description: 'Commit message',
          required: true,
        },
        {
          name: 'path',
          type: 'string',
          description: 'Repository path (default: workspace root)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const message = params['message'];
    const relativePath = params['path'];

    if (typeof message !== 'string' || !message.trim()) {
      return { success: false, error: 'Parameter "message" must be a non-empty string' };
    }

    const repoPath = typeof relativePath === 'string' && relativePath
      ? relativePath
      : '.';

    try {
      const safePath = validateWorkspacePath(this.workspacePath, repoPath);
      const safeMessage = sanitizeGitArg(message);

      if (!safeMessage) {
        return { success: false, error: 'Commit message cannot be empty after sanitization' };
      }

      const result = await executeGitCommand(safePath, ['commit', '-m', safeMessage]);

      if (result.success) {
        return {
          success: true,
          output: result.stdout,
        };
      }

      // Handle common non-error cases (message can be in stdout or stderr)
      const combined = `${result.stdout} ${result.stderr}`.toLowerCase();
      if (combined.includes('nothing to commit') || combined.includes('working tree clean')) {
        return {
          success: true,
          output: 'Nothing to commit, working tree clean',
        };
      }

      return {
        success: false,
        error: result.stderr || 'Failed to commit',
      };
    } catch (error) {
      if (error instanceof GitToolsError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Get repository status
 */
export class GitStatusTool implements Tool {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  get definition(): ToolDefinition {
    return {
      name: 'git_status',
      description: 'Get the status of the git repository',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Repository path (default: workspace root)',
          required: false,
        },
        {
          name: 'short',
          type: 'boolean',
          description: 'Use short format output',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const relativePath = params['path'];
    const short = params['short'] === true;

    const repoPath = typeof relativePath === 'string' && relativePath
      ? relativePath
      : '.';

    try {
      const safePath = validateWorkspacePath(this.workspacePath, repoPath);
      const args = short ? ['status', '--short'] : ['status'];
      const result = await executeGitCommand(safePath, args);

      if (result.success) {
        return {
          success: true,
          output: result.stdout || 'Clean working directory',
        };
      }

      // Not a git repository is a valid status response
      if (result.stderr.includes('not a git repository')) {
        return {
          success: true,
          output: 'Not a git repository',
        };
      }

      return {
        success: false,
        error: result.stderr || 'Failed to get status',
      };
    } catch (error) {
      if (error instanceof GitToolsError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Create or switch branches
 */
export class GitBranchTool implements Tool {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  get definition(): ToolDefinition {
    return {
      name: 'git_branch',
      description: 'List, create, or switch git branches',
      parameters: [
        {
          name: 'action',
          type: 'string',
          description: 'Action: "list", "create", or "switch"',
          required: true,
        },
        {
          name: 'name',
          type: 'string',
          description: 'Branch name (required for create/switch)',
          required: false,
        },
        {
          name: 'path',
          type: 'string',
          description: 'Repository path (default: workspace root)',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = params['action'];
    const name = params['name'];
    const relativePath = params['path'];

    if (typeof action !== 'string') {
      return { success: false, error: 'Parameter "action" must be a string' };
    }

    const repoPath = typeof relativePath === 'string' && relativePath
      ? relativePath
      : '.';

    try {
      const safePath = validateWorkspacePath(this.workspacePath, repoPath);
      let args: string[];

      switch (action.toLowerCase()) {
        case 'list':
          args = ['branch', '-a'];
          break;

        case 'create':
          if (typeof name !== 'string' || !name.trim()) {
            return { success: false, error: 'Branch name is required for create action' };
          }
          // Validate branch name (no special chars)
          if (!/^[a-zA-Z0-9_/-]+$/.test(name)) {
            return { success: false, error: 'Invalid branch name. Use only letters, numbers, underscores, hyphens, and slashes.' };
          }
          args = ['branch', name];
          break;

        case 'switch':
        case 'checkout':
          if (typeof name !== 'string' || !name.trim()) {
            return { success: false, error: 'Branch name is required for switch action' };
          }
          if (!/^[a-zA-Z0-9_/-]+$/.test(name)) {
            return { success: false, error: 'Invalid branch name' };
          }
          args = ['checkout', name];
          break;

        default:
          return { success: false, error: `Unknown action: ${action}. Use "list", "create", or "switch".` };
      }

      const result = await executeGitCommand(safePath, args);

      if (result.success) {
        return {
          success: true,
          output: result.stdout || `Branch action "${action}" completed`,
        };
      }

      return {
        success: false,
        error: result.stderr || `Failed to ${action} branch`,
      };
    } catch (error) {
      if (error instanceof GitToolsError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Get git log (commit history)
 */
export class GitLogTool implements Tool {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  get definition(): ToolDefinition {
    return {
      name: 'git_log',
      description: 'Get commit history',
      parameters: [
        {
          name: 'limit',
          type: 'number',
          description: 'Number of commits to show (default: 10)',
          required: false,
        },
        {
          name: 'path',
          type: 'string',
          description: 'Repository path (default: workspace root)',
          required: false,
        },
        {
          name: 'oneline',
          type: 'boolean',
          description: 'Use one-line format',
          required: false,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const limit = typeof params['limit'] === 'number' ? params['limit'] : 10;
    const relativePath = params['path'];
    const oneline = params['oneline'] === true;

    const repoPath = typeof relativePath === 'string' && relativePath
      ? relativePath
      : '.';

    try {
      const safePath = validateWorkspacePath(this.workspacePath, repoPath);
      const args = ['log', `-${Math.min(limit, 100)}`]; // Cap at 100 for safety

      if (oneline) {
        args.push('--oneline');
      }

      const result = await executeGitCommand(safePath, args);

      if (result.success) {
        return {
          success: true,
          output: result.stdout || 'No commits yet',
        };
      }

      // Empty repo is not an error
      if (result.stderr.includes('does not have any commits')) {
        return {
          success: true,
          output: 'No commits yet',
        };
      }

      return {
        success: false,
        error: result.stderr || 'Failed to get log',
      };
    } catch (error) {
      if (error instanceof GitToolsError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Create all git tools for a workspace
 */
export function createGitTools(workspacePath: string): Tool[] {
  return [
    new GitInitTool(workspacePath),
    new GitAddTool(workspacePath),
    new GitCommitTool(workspacePath),
    new GitStatusTool(workspacePath),
    new GitBranchTool(workspacePath),
    new GitLogTool(workspacePath),
  ];
}
