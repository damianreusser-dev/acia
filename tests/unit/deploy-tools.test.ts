/**
 * Deploy Tools Unit Tests
 *
 * Tests for deployment tool definitions and role permissions.
 * Part of Phase 6b: Deployment & Operations
 *
 * Note: These tests verify tool definitions and role permissions.
 * Actual cloud deployments are tested in E2E tests with API tokens.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DeployToRailwayTool,
  DeployToVercelTool,
  GetDeploymentStatusTool,
  GetDeploymentLogsTool,
  RollbackDeploymentTool,
  DeleteDeploymentTool,
  HealthCheckTool,
  createDeployTools,
} from '../../src/core/tools/deploy-tools.js';
import { filterToolsByRole } from '../../src/core/tools/types.js';

describe('Deploy Tools Definitions', () => {
  describe('DeployToRailwayTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DeployToRailwayTool();

      expect(tool.definition.name).toBe('deploy_to_railway');
      expect(tool.definition.description).toContain('Railway');
    });

    it('should have required projectPath parameter', () => {
      const tool = new DeployToRailwayTool();
      const pathParam = tool.definition.parameters.find(p => p.name === 'projectPath');

      expect(pathParam).toBeDefined();
      expect(pathParam?.required).toBe(true);
      expect(pathParam?.type).toBe('string');
    });

    it('should have optional serviceName parameter', () => {
      const tool = new DeployToRailwayTool();
      const serviceParam = tool.definition.parameters.find(p => p.name === 'serviceName');

      expect(serviceParam).toBeDefined();
      expect(serviceParam?.required).toBe(false);
    });

    it('should have devops and ops roles', () => {
      const tool = new DeployToRailwayTool();

      expect(tool.roles).toContain('devops');
      expect(tool.roles).toContain('ops');
      expect(tool.roles).not.toContain('dev');
    });
  });

  describe('DeployToVercelTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DeployToVercelTool();

      expect(tool.definition.name).toBe('deploy_to_vercel');
      expect(tool.definition.description).toContain('Vercel');
    });

    it('should have required projectPath parameter', () => {
      const tool = new DeployToVercelTool();
      const pathParam = tool.definition.parameters.find(p => p.name === 'projectPath');

      expect(pathParam).toBeDefined();
      expect(pathParam?.required).toBe(true);
    });

    it('should have optional production parameter', () => {
      const tool = new DeployToVercelTool();
      const prodParam = tool.definition.parameters.find(p => p.name === 'production');

      expect(prodParam).toBeDefined();
      expect(prodParam?.required).toBe(false);
      expect(prodParam?.type).toBe('boolean');
    });
  });

  describe('GetDeploymentStatusTool', () => {
    it('should have correct tool definition', () => {
      const tool = new GetDeploymentStatusTool();

      expect(tool.definition.name).toBe('get_deployment_status');
      expect(tool.definition.description).toContain('status');
    });

    it('should have required platform parameter', () => {
      const tool = new GetDeploymentStatusTool();
      const platformParam = tool.definition.parameters.find(p => p.name === 'platform');

      expect(platformParam).toBeDefined();
      expect(platformParam?.required).toBe(true);
    });

    it('should have required projectPath parameter', () => {
      const tool = new GetDeploymentStatusTool();
      const pathParam = tool.definition.parameters.find(p => p.name === 'projectPath');

      expect(pathParam).toBeDefined();
      expect(pathParam?.required).toBe(true);
    });
  });

  describe('GetDeploymentLogsTool', () => {
    it('should have correct tool definition', () => {
      const tool = new GetDeploymentLogsTool();

      expect(tool.definition.name).toBe('get_deployment_logs');
      expect(tool.definition.description).toContain('logs');
    });

    it('should have optional lines parameter', () => {
      const tool = new GetDeploymentLogsTool();
      const linesParam = tool.definition.parameters.find(p => p.name === 'lines');

      expect(linesParam).toBeDefined();
      expect(linesParam?.required).toBe(false);
      expect(linesParam?.type).toBe('number');
    });
  });

  describe('RollbackDeploymentTool', () => {
    it('should have correct tool definition', () => {
      const tool = new RollbackDeploymentTool();

      expect(tool.definition.name).toBe('rollback_deployment');
      expect(tool.definition.description).toContain('Rollback');
    });

    it('should have required projectPath parameter', () => {
      const tool = new RollbackDeploymentTool();
      const pathParam = tool.definition.parameters.find(p => p.name === 'projectPath');

      expect(pathParam).toBeDefined();
      expect(pathParam?.required).toBe(true);
    });
  });

  describe('DeleteDeploymentTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DeleteDeploymentTool();

      expect(tool.definition.name).toBe('delete_deployment');
      expect(tool.definition.description).toContain('Delete');
    });

    it('should have required platform parameter', () => {
      const tool = new DeleteDeploymentTool();
      const platformParam = tool.definition.parameters.find(p => p.name === 'platform');

      expect(platformParam).toBeDefined();
      expect(platformParam?.required).toBe(true);
    });
  });

  describe('HealthCheckTool', () => {
    it('should have correct tool definition', () => {
      const tool = new HealthCheckTool();

      expect(tool.definition.name).toBe('health_check');
      expect(tool.definition.description).toContain('healthy');
    });

    it('should have required url parameter', () => {
      const tool = new HealthCheckTool();
      const urlParam = tool.definition.parameters.find(p => p.name === 'url');

      expect(urlParam).toBeDefined();
      expect(urlParam?.required).toBe(true);
      expect(urlParam?.type).toBe('string');
    });

    it('should have optional expectedStatus parameter', () => {
      const tool = new HealthCheckTool();
      const statusParam = tool.definition.parameters.find(p => p.name === 'expectedStatus');

      expect(statusParam).toBeDefined();
      expect(statusParam?.required).toBe(false);
      expect(statusParam?.type).toBe('number');
    });

    it('should be accessible to monitoring role', () => {
      const tool = new HealthCheckTool();

      expect(tool.roles).toContain('monitoring');
      expect(tool.roles).toContain('devops');
      expect(tool.roles).toContain('ops');
    });
  });
});

describe('createDeployTools', () => {
  it('should return all deploy tools', () => {
    const tools = createDeployTools();

    expect(tools.length).toBe(7);

    const toolNames = tools.map(t => t.definition.name);
    expect(toolNames).toContain('deploy_to_railway');
    expect(toolNames).toContain('deploy_to_vercel');
    expect(toolNames).toContain('get_deployment_status');
    expect(toolNames).toContain('get_deployment_logs');
    expect(toolNames).toContain('rollback_deployment');
    expect(toolNames).toContain('delete_deployment');
    expect(toolNames).toContain('health_check');
  });

  it('should return tools with execute functions', () => {
    const tools = createDeployTools();

    for (const tool of tools) {
      expect(typeof tool.execute).toBe('function');
    }
  });
});

describe('Deploy Tools Role Permissions', () => {
  it('should be accessible to devops role', () => {
    const tools = createDeployTools();
    const filteredTools = filterToolsByRole(tools, 'devops');

    expect(filteredTools.length).toBe(7);
  });

  it('should be accessible to ops role', () => {
    const tools = createDeployTools();
    const filteredTools = filterToolsByRole(tools, 'ops');

    expect(filteredTools.length).toBe(7);
  });

  it('should NOT be accessible to dev role', () => {
    const tools = createDeployTools();
    const filteredTools = filterToolsByRole(tools, 'dev');

    expect(filteredTools.length).toBe(0);
  });

  it('should NOT be accessible to pm role', () => {
    const tools = createDeployTools();
    const filteredTools = filterToolsByRole(tools, 'pm');

    expect(filteredTools.length).toBe(0);
  });

  it('should give monitoring role access to health_check only', () => {
    const tools = createDeployTools();
    const filteredTools = filterToolsByRole(tools, 'monitoring');

    expect(filteredTools.length).toBe(1);
    expect(filteredTools[0].definition.name).toBe('health_check');
  });
});

describe('Deploy Tools Parameter Validation', () => {
  describe('DeployToRailwayTool', () => {
    it('should reject non-string projectPath parameter', async () => {
      const tool = new DeployToRailwayTool();
      const result = await tool.execute({ projectPath: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('projectPath');
      expect(result.error).toContain('string');
    });
  });

  describe('DeployToVercelTool', () => {
    it('should reject non-string projectPath parameter', async () => {
      const tool = new DeployToVercelTool();
      const result = await tool.execute({ projectPath: null });

      expect(result.success).toBe(false);
      expect(result.error).toContain('projectPath');
    });
  });

  describe('GetDeploymentStatusTool', () => {
    it('should reject invalid platform parameter', async () => {
      const tool = new GetDeploymentStatusTool();
      const result = await tool.execute({ platform: 'invalid', projectPath: '/test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('platform');
    });

    it('should accept railway platform', async () => {
      const tool = new GetDeploymentStatusTool();
      // This will fail because Railway CLI isn't available in tests,
      // but it should pass parameter validation
      const result = await tool.execute({ platform: 'railway', projectPath: '/test' });

      // Should not fail on parameter validation
      expect(result.error).not.toContain('platform must be');
    });

    it('should accept vercel platform', async () => {
      const tool = new GetDeploymentStatusTool();
      const result = await tool.execute({ platform: 'vercel', projectPath: '/test' });

      expect(result.error).not.toContain('platform must be');
    });
  });

  describe('DeleteDeploymentTool', () => {
    it('should reject invalid platform parameter', async () => {
      const tool = new DeleteDeploymentTool();
      const result = await tool.execute({ platform: 'aws', projectPath: '/test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('platform');
    });
  });

  describe('HealthCheckTool', () => {
    it('should reject non-string url parameter', async () => {
      const tool = new HealthCheckTool();
      const result = await tool.execute({ url: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('url');
      expect(result.error).toContain('string');
    });
  });
});

describe('Deploy Tools Environment Variable Requirements', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('DeployToRailwayTool', () => {
    it('should require RAILWAY_TOKEN environment variable', async () => {
      delete process.env.RAILWAY_TOKEN;

      const tool = new DeployToRailwayTool();
      const result = await tool.execute({ projectPath: '/test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('RAILWAY_TOKEN');
    });
  });

  describe('DeployToVercelTool', () => {
    it('should require VERCEL_TOKEN environment variable', async () => {
      delete process.env.VERCEL_TOKEN;

      const tool = new DeployToVercelTool();
      const result = await tool.execute({ projectPath: '/test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('VERCEL_TOKEN');
    });
  });
});
