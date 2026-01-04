/**
 * Azure Tools Unit Tests
 *
 * Tests for Azure deployment tool definitions and role permissions.
 * Part of Phase 6h: Azure Deployment + E2E Build-Deploy-Monitor Integration
 *
 * Note: These tests verify tool definitions and parameter validation.
 * Actual Azure deployments require credentials and are tested in E2E tests.
 */

import { describe, it, expect } from 'vitest';
import {
  DeployToAzureAppServiceTool,
  DeployToAzureStaticWebTool,
  DeployToAzureContainerAppsTool,
  GetAzureDeploymentStatusTool,
  GetAzureDeploymentLogsTool,
  DeleteAzureDeploymentTool,
  createAzureDeployTools,
} from '../../src/core/tools/azure-tools.js';
import { filterToolsByRole } from '../../src/core/tools/types.js';

describe('Azure Tools Definitions', () => {
  describe('DeployToAzureAppServiceTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DeployToAzureAppServiceTool();

      expect(tool.definition.name).toBe('deploy_to_azure_app_service');
      expect(tool.definition.description).toContain('Azure App Service');
      expect(tool.definition.description).toContain('Node.js');
    });

    it('should have required projectPath parameter', () => {
      const tool = new DeployToAzureAppServiceTool();
      const param = tool.definition.parameters.find((p) => p.name === 'projectPath');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
      expect(param?.type).toBe('string');
    });

    it('should have required resourceGroup parameter', () => {
      const tool = new DeployToAzureAppServiceTool();
      const param = tool.definition.parameters.find((p) => p.name === 'resourceGroup');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
      expect(param?.type).toBe('string');
    });

    it('should have required appName parameter', () => {
      const tool = new DeployToAzureAppServiceTool();
      const param = tool.definition.parameters.find((p) => p.name === 'appName');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
      expect(param?.type).toBe('string');
    });

    it('should have optional plan parameter', () => {
      const tool = new DeployToAzureAppServiceTool();
      const param = tool.definition.parameters.find((p) => p.name === 'plan');

      expect(param).toBeDefined();
      expect(param?.required).toBe(false);
      expect(param?.type).toBe('string');
    });

    it('should have devops and ops roles', () => {
      const tool = new DeployToAzureAppServiceTool();

      expect(tool.roles).toContain('devops');
      expect(tool.roles).toContain('ops');
      expect(tool.roles).not.toContain('dev');
      expect(tool.roles).not.toContain('pm');
    });
  });

  describe('DeployToAzureStaticWebTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DeployToAzureStaticWebTool();

      expect(tool.definition.name).toBe('deploy_to_azure_static_web');
      expect(tool.definition.description).toContain('Static Web Apps');
    });

    it('should have required projectPath parameter', () => {
      const tool = new DeployToAzureStaticWebTool();
      const param = tool.definition.parameters.find((p) => p.name === 'projectPath');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have required resourceGroup parameter', () => {
      const tool = new DeployToAzureStaticWebTool();
      const param = tool.definition.parameters.find((p) => p.name === 'resourceGroup');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have required appName parameter', () => {
      const tool = new DeployToAzureStaticWebTool();
      const param = tool.definition.parameters.find((p) => p.name === 'appName');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have optional buildFolder parameter', () => {
      const tool = new DeployToAzureStaticWebTool();
      const param = tool.definition.parameters.find((p) => p.name === 'buildFolder');

      expect(param).toBeDefined();
      expect(param?.required).toBe(false);
    });

    it('should have devops and ops roles', () => {
      const tool = new DeployToAzureStaticWebTool();

      expect(tool.roles).toContain('devops');
      expect(tool.roles).toContain('ops');
    });
  });

  describe('DeployToAzureContainerAppsTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DeployToAzureContainerAppsTool();

      expect(tool.definition.name).toBe('deploy_to_azure_container_apps');
      expect(tool.definition.description).toContain('Container Apps');
      expect(tool.definition.description).toContain('Docker');
    });

    it('should have required projectPath parameter', () => {
      const tool = new DeployToAzureContainerAppsTool();
      const param = tool.definition.parameters.find((p) => p.name === 'projectPath');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have required resourceGroup parameter', () => {
      const tool = new DeployToAzureContainerAppsTool();
      const param = tool.definition.parameters.find((p) => p.name === 'resourceGroup');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have required appName parameter', () => {
      const tool = new DeployToAzureContainerAppsTool();
      const param = tool.definition.parameters.find((p) => p.name === 'appName');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have optional registry parameter', () => {
      const tool = new DeployToAzureContainerAppsTool();
      const param = tool.definition.parameters.find((p) => p.name === 'registry');

      expect(param).toBeDefined();
      expect(param?.required).toBe(false);
    });

    it('should have optional port parameter', () => {
      const tool = new DeployToAzureContainerAppsTool();
      const param = tool.definition.parameters.find((p) => p.name === 'port');

      expect(param).toBeDefined();
      expect(param?.required).toBe(false);
      expect(param?.type).toBe('number');
    });

    it('should have devops and ops roles', () => {
      const tool = new DeployToAzureContainerAppsTool();

      expect(tool.roles).toContain('devops');
      expect(tool.roles).toContain('ops');
    });
  });

  describe('GetAzureDeploymentStatusTool', () => {
    it('should have correct tool definition', () => {
      const tool = new GetAzureDeploymentStatusTool();

      expect(tool.definition.name).toBe('get_azure_deployment_status');
      expect(tool.definition.description).toContain('status');
    });

    it('should have required resourceGroup parameter', () => {
      const tool = new GetAzureDeploymentStatusTool();
      const param = tool.definition.parameters.find((p) => p.name === 'resourceGroup');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have required appName parameter', () => {
      const tool = new GetAzureDeploymentStatusTool();
      const param = tool.definition.parameters.find((p) => p.name === 'appName');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have required resourceType parameter', () => {
      const tool = new GetAzureDeploymentStatusTool();
      const param = tool.definition.parameters.find((p) => p.name === 'resourceType');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have devops and ops roles', () => {
      const tool = new GetAzureDeploymentStatusTool();

      expect(tool.roles).toContain('devops');
      expect(tool.roles).toContain('ops');
    });
  });

  describe('GetAzureDeploymentLogsTool', () => {
    it('should have correct tool definition', () => {
      const tool = new GetAzureDeploymentLogsTool();

      expect(tool.definition.name).toBe('get_azure_deployment_logs');
      expect(tool.definition.description).toContain('logs');
    });

    it('should have required resourceGroup parameter', () => {
      const tool = new GetAzureDeploymentLogsTool();
      const param = tool.definition.parameters.find((p) => p.name === 'resourceGroup');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have required appName parameter', () => {
      const tool = new GetAzureDeploymentLogsTool();
      const param = tool.definition.parameters.find((p) => p.name === 'appName');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have required resourceType parameter', () => {
      const tool = new GetAzureDeploymentLogsTool();
      const param = tool.definition.parameters.find((p) => p.name === 'resourceType');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have optional lines parameter', () => {
      const tool = new GetAzureDeploymentLogsTool();
      const param = tool.definition.parameters.find((p) => p.name === 'lines');

      expect(param).toBeDefined();
      expect(param?.required).toBe(false);
      expect(param?.type).toBe('number');
    });

    it('should have devops and ops roles', () => {
      const tool = new GetAzureDeploymentLogsTool();

      expect(tool.roles).toContain('devops');
      expect(tool.roles).toContain('ops');
    });
  });

  describe('DeleteAzureDeploymentTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DeleteAzureDeploymentTool();

      expect(tool.definition.name).toBe('delete_azure_deployment');
      expect(tool.definition.description).toContain('Delete');
    });

    it('should have required resourceGroup parameter', () => {
      const tool = new DeleteAzureDeploymentTool();
      const param = tool.definition.parameters.find((p) => p.name === 'resourceGroup');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have required appName parameter', () => {
      const tool = new DeleteAzureDeploymentTool();
      const param = tool.definition.parameters.find((p) => p.name === 'appName');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have required resourceType parameter', () => {
      const tool = new DeleteAzureDeploymentTool();
      const param = tool.definition.parameters.find((p) => p.name === 'resourceType');

      expect(param).toBeDefined();
      expect(param?.required).toBe(true);
    });

    it('should have devops and ops roles', () => {
      const tool = new DeleteAzureDeploymentTool();

      expect(tool.roles).toContain('devops');
      expect(tool.roles).toContain('ops');
    });
  });
});

describe('Azure Tool Role Filtering', () => {
  const allTools = createAzureDeployTools();

  it('should filter tools for devops role', () => {
    const filtered = filterToolsByRole(allTools, 'devops');

    expect(filtered.length).toBe(6);
    expect(filtered.some((t) => t.definition.name === 'deploy_to_azure_app_service')).toBe(true);
    expect(filtered.some((t) => t.definition.name === 'deploy_to_azure_static_web')).toBe(true);
    expect(filtered.some((t) => t.definition.name === 'deploy_to_azure_container_apps')).toBe(true);
    expect(filtered.some((t) => t.definition.name === 'get_azure_deployment_status')).toBe(true);
    expect(filtered.some((t) => t.definition.name === 'get_azure_deployment_logs')).toBe(true);
    expect(filtered.some((t) => t.definition.name === 'delete_azure_deployment')).toBe(true);
  });

  it('should filter tools for ops role', () => {
    const filtered = filterToolsByRole(allTools, 'ops');

    expect(filtered.length).toBe(6);
    expect(filtered.some((t) => t.definition.name === 'deploy_to_azure_app_service')).toBe(true);
  });

  it('should not include Azure tools for dev role', () => {
    const filtered = filterToolsByRole(allTools, 'dev');

    expect(filtered.length).toBe(0);
    expect(filtered.some((t) => t.definition.name === 'deploy_to_azure_app_service')).toBe(false);
  });

  it('should not include Azure tools for pm role', () => {
    const filtered = filterToolsByRole(allTools, 'pm');

    expect(filtered.length).toBe(0);
  });

  it('should not include Azure tools for qa role', () => {
    const filtered = filterToolsByRole(allTools, 'qa');

    expect(filtered.length).toBe(0);
  });
});

describe('createAzureDeployTools', () => {
  it('should create all 6 Azure deploy tools', () => {
    const tools = createAzureDeployTools();

    expect(tools.length).toBe(6);

    const names = tools.map((t) => t.definition.name);
    expect(names).toContain('deploy_to_azure_app_service');
    expect(names).toContain('deploy_to_azure_static_web');
    expect(names).toContain('deploy_to_azure_container_apps');
    expect(names).toContain('get_azure_deployment_status');
    expect(names).toContain('get_azure_deployment_logs');
    expect(names).toContain('delete_azure_deployment');
  });
});

describe('Azure Tool Parameter Validation', () => {
  describe('DeployToAzureAppServiceTool', () => {
    it('should reject non-string projectPath', async () => {
      const tool = new DeployToAzureAppServiceTool();
      const result = await tool.execute({
        projectPath: 123,
        resourceGroup: 'test-rg',
        appName: 'test-app',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('projectPath');
      expect(result.error).toContain('string');
    });

    it('should reject non-string resourceGroup', async () => {
      const tool = new DeployToAzureAppServiceTool();
      const result = await tool.execute({
        projectPath: '/path',
        resourceGroup: 123,
        appName: 'test-app',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('resourceGroup');
      expect(result.error).toContain('string');
    });

    it('should reject non-string appName', async () => {
      const tool = new DeployToAzureAppServiceTool();
      const result = await tool.execute({
        projectPath: '/path',
        resourceGroup: 'test-rg',
        appName: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('appName');
      expect(result.error).toContain('string');
    });
  });

  describe('DeployToAzureStaticWebTool', () => {
    it('should reject non-string projectPath', async () => {
      const tool = new DeployToAzureStaticWebTool();
      const result = await tool.execute({
        projectPath: 123,
        resourceGroup: 'test-rg',
        appName: 'test-app',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('projectPath');
    });

    it('should reject non-string resourceGroup', async () => {
      const tool = new DeployToAzureStaticWebTool();
      const result = await tool.execute({
        projectPath: '/path',
        resourceGroup: 123,
        appName: 'test-app',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('resourceGroup');
    });
  });

  describe('DeployToAzureContainerAppsTool', () => {
    it('should reject non-string projectPath', async () => {
      const tool = new DeployToAzureContainerAppsTool();
      const result = await tool.execute({
        projectPath: 123,
        resourceGroup: 'test-rg',
        appName: 'test-app',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('projectPath');
    });
  });

  describe('GetAzureDeploymentStatusTool', () => {
    it('should reject non-string resourceGroup', async () => {
      const tool = new GetAzureDeploymentStatusTool();
      const result = await tool.execute({
        resourceGroup: 123,
        appName: 'test-app',
        resourceType: 'appservice',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('resourceGroup');
    });

    it('should reject invalid resourceType', async () => {
      const tool = new GetAzureDeploymentStatusTool();
      const result = await tool.execute({
        resourceGroup: 'test-rg',
        appName: 'test-app',
        resourceType: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('resourceType');
    });

    // Valid resourceTypes are tested implicitly - if invalid is rejected, valid must be accepted
    // We don't test valid resourceTypes by calling execute() since that would require Azure CLI
  });

  describe('GetAzureDeploymentLogsTool', () => {
    it('should reject non-string resourceGroup', async () => {
      const tool = new GetAzureDeploymentLogsTool();
      const result = await tool.execute({
        resourceGroup: 123,
        appName: 'test-app',
        resourceType: 'appservice',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('resourceGroup');
    });

    it('should reject invalid resourceType', async () => {
      const tool = new GetAzureDeploymentLogsTool();
      const result = await tool.execute({
        resourceGroup: 'test-rg',
        appName: 'test-app',
        resourceType: 'staticwebapp', // Not valid for logs - only appservice or containerapp
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('resourceType');
    });
  });

  describe('DeleteAzureDeploymentTool', () => {
    it('should reject non-string resourceGroup', async () => {
      const tool = new DeleteAzureDeploymentTool();
      const result = await tool.execute({
        resourceGroup: 123,
        appName: 'test-app',
        resourceType: 'appservice',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('resourceGroup');
    });

    it('should reject invalid resourceType', async () => {
      const tool = new DeleteAzureDeploymentTool();
      const result = await tool.execute({
        resourceGroup: 'test-rg',
        appName: 'test-app',
        resourceType: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('resourceType');
    });
  });
});
