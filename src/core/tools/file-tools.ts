/**
 * File Operation Tools
 *
 * Provides sandboxed file operations for agents.
 * All operations are restricted to a configured workspace directory.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolDefinition, ToolResult } from './types.js';

export class FileToolsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileToolsError';
  }
}

/**
 * Validates and resolves a path within the workspace
 * Prevents directory traversal attacks
 */
function resolveSafePath(workspacePath: string, relativePath: string): string {
  const resolved = path.resolve(workspacePath, relativePath);
  const normalizedWorkspace = path.normalize(workspacePath);

  if (!resolved.startsWith(normalizedWorkspace)) {
    throw new FileToolsError(
      `Access denied: path "${relativePath}" is outside workspace`
    );
  }

  return resolved;
}

export class ReadFileTool implements Tool {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  get definition(): ToolDefinition {
    return {
      name: 'read_file',
      description: 'Read the contents of a file from the workspace',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Relative path to the file within the workspace',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const filePath = params['path'];

    if (typeof filePath !== 'string') {
      return { success: false, error: 'Parameter "path" must be a string' };
    }

    try {
      const safePath = resolveSafePath(this.workspacePath, filePath);
      const content = await fs.readFile(safePath, 'utf-8');
      return { success: true, output: content };
    } catch (error) {
      if (error instanceof FileToolsError) {
        return { success: false, error: error.message };
      }
      if (error instanceof Error && 'code' in error) {
        if (error.code === 'ENOENT') {
          return { success: false, error: `File not found: ${filePath}` };
        }
        if (error.code === 'EISDIR') {
          return { success: false, error: `Path is a directory: ${filePath}` };
        }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export class WriteFileTool implements Tool {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  get definition(): ToolDefinition {
    return {
      name: 'write_file',
      description: 'Write content to a file in the workspace. Creates parent directories if needed.',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Relative path to the file within the workspace',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'Content to write to the file',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const filePath = params['path'];
    const content = params['content'];

    if (typeof filePath !== 'string') {
      return { success: false, error: 'Parameter "path" must be a string' };
    }
    if (typeof content !== 'string') {
      return { success: false, error: 'Parameter "content" must be a string' };
    }

    try {
      const safePath = resolveSafePath(this.workspacePath, filePath);

      // Create parent directories if they don't exist
      const dir = path.dirname(safePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(safePath, content, 'utf-8');
      return { success: true, output: `File written: ${filePath}` };
    } catch (error) {
      if (error instanceof FileToolsError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export class ListDirectoryTool implements Tool {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  get definition(): ToolDefinition {
    return {
      name: 'list_directory',
      description: 'List files and directories in a workspace path',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Relative path to the directory within the workspace. Use "." for root.',
          required: true,
        },
      ],
    };
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = params['path'];

    if (typeof dirPath !== 'string') {
      return { success: false, error: 'Parameter "path" must be a string' };
    }

    try {
      const safePath = resolveSafePath(this.workspacePath, dirPath);
      const entries = await fs.readdir(safePath, { withFileTypes: true });

      const formatted = entries
        .map((entry) => {
          const type = entry.isDirectory() ? '[DIR]' : '[FILE]';
          return `${type} ${entry.name}`;
        })
        .join('\n');

      return { success: true, output: formatted || '(empty directory)' };
    } catch (error) {
      if (error instanceof FileToolsError) {
        return { success: false, error: error.message };
      }
      if (error instanceof Error && 'code' in error) {
        if (error.code === 'ENOENT') {
          return { success: false, error: `Directory not found: ${dirPath}` };
        }
        if (error.code === 'ENOTDIR') {
          return { success: false, error: `Path is not a directory: ${dirPath}` };
        }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Creates all file tools configured for a workspace
 */
export function createFileTools(workspacePath: string): Tool[] {
  return [
    new ReadFileTool(workspacePath),
    new WriteFileTool(workspacePath),
    new ListDirectoryTool(workspacePath),
  ];
}
