/**
 * Tool System Types
 *
 * Defines the interface for tools that agents can use.
 * Tools are capabilities like reading files, writing files, running commands, etc.
 */

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface Tool {
  definition: ToolDefinition;
  execute(params: Record<string, unknown>): Promise<ToolResult>;
}
