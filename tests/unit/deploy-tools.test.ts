/**
 * Deploy Tools Unit Tests
 *
 * Tests for generic deployment tool definitions and role permissions.
 * Part of Phase 6b: Deployment & Operations
 * Updated in Phase 6h: Azure Deployment Integration
 *
 * Note: Platform-specific tools (Azure) are tested in azure-tools.test.ts
 */

import { describe, it, expect } from 'vitest';
import { HealthCheckTool, WaitForHealthTool, createDeployTools } from '../../src/core/tools/deploy-tools.js';
import { filterToolsByRole } from '../../src/core/tools/types.js';

describe('Deploy Tools Definitions', () => {
  describe('HealthCheckTool', () => {
    it('should have correct tool definition', () => {
      const tool = new HealthCheckTool();

      expect(tool.definition.name).toBe('health_check');
      expect(tool.definition.description).toContain('healthy');
    });

    it('should have required url parameter', () => {
      const tool = new HealthCheckTool();
      const urlParam = tool.definition.parameters.find((p) => p.name === 'url');

      expect(urlParam).toBeDefined();
      expect(urlParam?.required).toBe(true);
      expect(urlParam?.type).toBe('string');
    });

    it('should have optional expectedStatus parameter', () => {
      const tool = new HealthCheckTool();
      const statusParam = tool.definition.parameters.find((p) => p.name === 'expectedStatus');

      expect(statusParam).toBeDefined();
      expect(statusParam?.required).toBe(false);
      expect(statusParam?.type).toBe('number');
    });

    it('should have optional timeout parameter', () => {
      const tool = new HealthCheckTool();
      const timeoutParam = tool.definition.parameters.find((p) => p.name === 'timeout');

      expect(timeoutParam).toBeDefined();
      expect(timeoutParam?.required).toBe(false);
      expect(timeoutParam?.type).toBe('number');
    });

    it('should have devops, ops, and monitoring roles', () => {
      const tool = new HealthCheckTool();

      expect(tool.roles).toContain('devops');
      expect(tool.roles).toContain('ops');
      expect(tool.roles).toContain('monitoring');
      expect(tool.roles).not.toContain('dev');
    });
  });

  describe('WaitForHealthTool', () => {
    it('should have correct tool definition', () => {
      const tool = new WaitForHealthTool();

      expect(tool.definition.name).toBe('wait_for_health');
      expect(tool.definition.description).toContain('healthy');
      expect(tool.definition.description).toContain('retries');
    });

    it('should have required url parameter', () => {
      const tool = new WaitForHealthTool();
      const urlParam = tool.definition.parameters.find((p) => p.name === 'url');

      expect(urlParam).toBeDefined();
      expect(urlParam?.required).toBe(true);
      expect(urlParam?.type).toBe('string');
    });

    it('should have optional maxAttempts parameter', () => {
      const tool = new WaitForHealthTool();
      const param = tool.definition.parameters.find((p) => p.name === 'maxAttempts');

      expect(param).toBeDefined();
      expect(param?.required).toBe(false);
      expect(param?.type).toBe('number');
    });

    it('should have optional intervalSeconds parameter', () => {
      const tool = new WaitForHealthTool();
      const param = tool.definition.parameters.find((p) => p.name === 'intervalSeconds');

      expect(param).toBeDefined();
      expect(param?.required).toBe(false);
      expect(param?.type).toBe('number');
    });

    it('should have devops, ops, and monitoring roles', () => {
      const tool = new WaitForHealthTool();

      expect(tool.roles).toContain('devops');
      expect(tool.roles).toContain('ops');
      expect(tool.roles).toContain('monitoring');
    });
  });
});

describe('Tool Role Filtering', () => {
  const allTools = createDeployTools();

  it('should filter tools for devops role', () => {
    const filtered = filterToolsByRole(allTools, 'devops');

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((t) => t.definition.name === 'health_check')).toBe(true);
    expect(filtered.some((t) => t.definition.name === 'wait_for_health')).toBe(true);
  });

  it('should filter tools for ops role', () => {
    const filtered = filterToolsByRole(allTools, 'ops');

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((t) => t.definition.name === 'health_check')).toBe(true);
  });

  it('should filter tools for monitoring role', () => {
    const filtered = filterToolsByRole(allTools, 'monitoring');

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((t) => t.definition.name === 'health_check')).toBe(true);
    expect(filtered.some((t) => t.definition.name === 'wait_for_health')).toBe(true);
  });

  it('should not include deploy tools for dev role', () => {
    const filtered = filterToolsByRole(allTools, 'dev');

    expect(filtered.some((t) => t.definition.name === 'health_check')).toBe(false);
    expect(filtered.some((t) => t.definition.name === 'wait_for_health')).toBe(false);
  });
});

describe('createDeployTools', () => {
  it('should create all generic deploy tools', () => {
    const tools = createDeployTools();

    expect(tools.length).toBe(2);

    const names = tools.map((t) => t.definition.name);
    expect(names).toContain('health_check');
    expect(names).toContain('wait_for_health');
  });
});

describe('HealthCheckTool Validation', () => {
  it('should reject non-string url parameter', async () => {
    const tool = new HealthCheckTool();
    const result = await tool.execute({ url: 123 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('url');
    expect(result.error).toContain('string');
  });
});

describe('WaitForHealthTool Validation', () => {
  it('should reject non-string url parameter', async () => {
    const tool = new WaitForHealthTool();
    const result = await tool.execute({ url: 123 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('url');
    expect(result.error).toContain('string');
  });
});
