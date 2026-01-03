/**
 * Tool System Types
 *
 * Defines the interface for tools that agents can use.
 * Tools are capabilities like reading files, writing files, running commands, etc.
 *
 * Phase 6a: Added AgentRole for role-based tool access control.
 */

/**
 * Agent roles for tool permission system
 *
 * Each role has access to a subset of tools based on their function.
 * This replaces string-based filtering with type-safe role-based filtering.
 */
export type AgentRole = 'pm' | 'dev' | 'qa' | 'devops' | 'ops' | 'content' | 'monitoring' | 'incident';

/**
 * All available agent roles (for runtime validation)
 */
export const AGENT_ROLES: AgentRole[] = ['pm', 'dev', 'qa', 'devops', 'ops', 'content', 'monitoring', 'incident'];

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

  /**
   * Roles that can use this tool.
   *
   * If undefined (backward compatibility), defaults to all roles.
   * If empty array, no roles can use it (disabled).
   *
   * @example
   * ```typescript
   * // Only devops and ops can use docker tools
   * roles: ['devops', 'ops']
   *
   * // Only PM can use read-only tools (explicitly)
   * roles: ['pm']
   *
   * // Legacy tool - available to all (undefined = all roles)
   * roles: undefined
   * ```
   */
  roles?: AgentRole[];
}

/**
 * Filter tools by agent role.
 *
 * Returns tools that are accessible to the given role.
 * Tools without a roles property are available to all roles (backward compatibility).
 *
 * @param tools - Array of tools to filter
 * @param role - Agent role to filter for
 * @returns Tools accessible to the role
 */
export function filterToolsByRole(tools: Tool[], role: AgentRole): Tool[] {
  return tools.filter(tool => {
    // Backward compatibility: tools without roles are available to all
    if (tool.roles === undefined) {
      return true;
    }
    // Empty roles means disabled
    if (tool.roles.length === 0) {
      return false;
    }
    // Check if role is in the allowed list
    return tool.roles.includes(role);
  });
}
