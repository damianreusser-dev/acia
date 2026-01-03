/**
 * Tool Permissions Unit Tests
 *
 * Tests for role-based tool access control.
 * Part of Phase 6a: Coordination Layer Refactoring.
 */

import { describe, it, expect } from 'vitest';
import {
  Tool,
  AgentRole,
  AGENT_ROLES,
  filterToolsByRole,
} from '../../src/core/tools/types.js';

describe('AgentRole Type', () => {
  it('should define all expected roles', () => {
    const expectedRoles: AgentRole[] = ['pm', 'dev', 'qa', 'devops', 'ops', 'content', 'monitoring', 'incident'];

    for (const role of expectedRoles) {
      expect(AGENT_ROLES).toContain(role);
    }
  });

  it('should have AGENT_ROLES constant for runtime validation', () => {
    expect(Array.isArray(AGENT_ROLES)).toBe(true);
    expect(AGENT_ROLES.length).toBeGreaterThan(0);
    expect(AGENT_ROLES).toContain('pm');
    expect(AGENT_ROLES).toContain('devops');
  });
});

describe('filterToolsByRole', () => {
  const createMockTool = (name: string, roles?: AgentRole[]): Tool => ({
    definition: {
      name,
      description: `Mock ${name} tool`,
      parameters: [],
    },
    execute: async () => ({ success: true, output: 'ok' }),
    roles,
  });

  describe('Backward Compatibility', () => {
    it('should return tools without roles to all agents', () => {
      const legacyTool = createMockTool('legacy_tool'); // No roles defined

      const pmTools = filterToolsByRole([legacyTool], 'pm');
      const devTools = filterToolsByRole([legacyTool], 'dev');
      const devopsTools = filterToolsByRole([legacyTool], 'devops');

      expect(pmTools).toContain(legacyTool);
      expect(devTools).toContain(legacyTool);
      expect(devopsTools).toContain(legacyTool);
    });

    it('should handle mixed tools (some with roles, some without)', () => {
      const legacyTool = createMockTool('legacy_tool');
      const restrictedTool = createMockTool('restricted_tool', ['devops']);

      const pmTools = filterToolsByRole([legacyTool, restrictedTool], 'pm');
      const devopsTools = filterToolsByRole([legacyTool, restrictedTool], 'devops');

      expect(pmTools).toHaveLength(1);
      expect(pmTools).toContain(legacyTool);

      expect(devopsTools).toHaveLength(2);
      expect(devopsTools).toContain(legacyTool);
      expect(devopsTools).toContain(restrictedTool);
    });
  });

  describe('Role-Based Filtering', () => {
    it('should filter tools by single role', () => {
      const pmOnlyTool = createMockTool('pm_tool', ['pm']);
      const devOnlyTool = createMockTool('dev_tool', ['dev']);

      const pmTools = filterToolsByRole([pmOnlyTool, devOnlyTool], 'pm');
      const devTools = filterToolsByRole([pmOnlyTool, devOnlyTool], 'dev');

      expect(pmTools).toHaveLength(1);
      expect(pmTools).toContain(pmOnlyTool);

      expect(devTools).toHaveLength(1);
      expect(devTools).toContain(devOnlyTool);
    });

    it('should allow tools with multiple roles', () => {
      const sharedTool = createMockTool('shared_tool', ['pm', 'dev', 'qa']);

      const pmTools = filterToolsByRole([sharedTool], 'pm');
      const devTools = filterToolsByRole([sharedTool], 'dev');
      const qaTools = filterToolsByRole([sharedTool], 'qa');
      const devopsTools = filterToolsByRole([sharedTool], 'devops');

      expect(pmTools).toContain(sharedTool);
      expect(devTools).toContain(sharedTool);
      expect(qaTools).toContain(sharedTool);
      expect(devopsTools).not.toContain(sharedTool);
    });

    it('should exclude tools with empty roles array', () => {
      const disabledTool = createMockTool('disabled_tool', []);

      const pmTools = filterToolsByRole([disabledTool], 'pm');
      const devTools = filterToolsByRole([disabledTool], 'dev');

      expect(pmTools).toHaveLength(0);
      expect(devTools).toHaveLength(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should give PM read-only tools', () => {
      const readFileTool = createMockTool('read_file', ['pm', 'dev', 'qa', 'devops']);
      const writeFileTool = createMockTool('write_file', ['dev', 'qa', 'devops']);
      const runCodeTool = createMockTool('run_code', ['dev', 'qa']);

      const pmTools = filterToolsByRole([readFileTool, writeFileTool, runCodeTool], 'pm');

      expect(pmTools).toHaveLength(1);
      expect(pmTools[0].definition.name).toBe('read_file');
    });

    it('should give DevOps deployment tools', () => {
      const dockerBuildTool = createMockTool('docker_build', ['devops', 'ops']);
      const dockerRunTool = createMockTool('docker_run', ['devops', 'ops']);
      const deployTool = createMockTool('deploy_to_railway', ['devops']);
      const readFileTool = createMockTool('read_file'); // Legacy - all roles

      const devopsTools = filterToolsByRole(
        [dockerBuildTool, dockerRunTool, deployTool, readFileTool],
        'devops'
      );

      expect(devopsTools).toHaveLength(4);
      expect(devopsTools.map(t => t.definition.name)).toContain('docker_build');
      expect(devopsTools.map(t => t.definition.name)).toContain('deploy_to_railway');
    });

    it('should give QA testing tools but not deployment tools', () => {
      const runTestTool = createMockTool('run_test', ['dev', 'qa']);
      const readFileTool = createMockTool('read_file', ['pm', 'dev', 'qa', 'devops']);
      const deployTool = createMockTool('deploy_to_railway', ['devops']);

      const qaTools = filterToolsByRole([runTestTool, readFileTool, deployTool], 'qa');

      expect(qaTools).toHaveLength(2);
      expect(qaTools.map(t => t.definition.name)).toContain('run_test');
      expect(qaTools.map(t => t.definition.name)).toContain('read_file');
      expect(qaTools.map(t => t.definition.name)).not.toContain('deploy_to_railway');
    });

    it('should handle monitoring-specific tools', () => {
      const healthCheckTool = createMockTool('health_check', ['monitoring', 'ops']);
      const alertTool = createMockTool('create_alert', ['monitoring', 'incident']);

      const monitoringTools = filterToolsByRole([healthCheckTool, alertTool], 'monitoring');
      const incidentTools = filterToolsByRole([healthCheckTool, alertTool], 'incident');

      expect(monitoringTools).toHaveLength(2);
      expect(incidentTools).toHaveLength(1);
      expect(incidentTools[0].definition.name).toBe('create_alert');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tools array', () => {
      const result = filterToolsByRole([], 'pm');
      expect(result).toHaveLength(0);
    });

    it('should handle tools array with all roles excluded', () => {
      const tool1 = createMockTool('tool1', ['devops']);
      const tool2 = createMockTool('tool2', ['devops']);

      const pmTools = filterToolsByRole([tool1, tool2], 'pm');
      expect(pmTools).toHaveLength(0);
    });

    it('should preserve tool order', () => {
      const tool1 = createMockTool('tool1', ['dev']);
      const tool2 = createMockTool('tool2', ['dev']);
      const tool3 = createMockTool('tool3', ['dev']);

      const devTools = filterToolsByRole([tool1, tool2, tool3], 'dev');

      expect(devTools[0]).toBe(tool1);
      expect(devTools[1]).toBe(tool2);
      expect(devTools[2]).toBe(tool3);
    });

    it('should not mutate original tools array', () => {
      const tools = [
        createMockTool('tool1', ['pm']),
        createMockTool('tool2', ['dev']),
      ];
      const originalLength = tools.length;

      filterToolsByRole(tools, 'pm');

      expect(tools).toHaveLength(originalLength);
    });
  });
});

describe('Tool Interface with Roles', () => {
  it('should allow Tool without roles property', () => {
    const tool: Tool = {
      definition: {
        name: 'legacy_tool',
        description: 'A legacy tool',
        parameters: [],
      },
      execute: async () => ({ success: true }),
    };

    expect(tool.roles).toBeUndefined();
  });

  it('should allow Tool with roles property', () => {
    const tool: Tool = {
      definition: {
        name: 'new_tool',
        description: 'A new tool',
        parameters: [],
      },
      execute: async () => ({ success: true }),
      roles: ['dev', 'devops'],
    };

    expect(tool.roles).toEqual(['dev', 'devops']);
  });

  it('should type-check roles array values', () => {
    const validRoles: AgentRole[] = ['pm', 'dev', 'qa', 'devops', 'ops', 'content', 'monitoring', 'incident'];

    for (const role of validRoles) {
      const tool: Tool = {
        definition: { name: 'test', description: 'test', parameters: [] },
        execute: async () => ({ success: true }),
        roles: [role],
      };
      expect(tool.roles).toContain(role);
    }
  });
});
