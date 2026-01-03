/**
 * Docker Tools Unit Tests
 *
 * Tests for Docker tool definitions and role permissions.
 * Part of Phase 6b: Deployment & Operations
 *
 * Note: These tests verify tool definitions and role permissions.
 * Actual Docker execution is tested in E2E tests with Docker Desktop.
 */

import { describe, it, expect } from 'vitest';
import {
  DockerBuildTool,
  DockerRunTool,
  DockerComposeUpTool,
  DockerComposeDownTool,
  DockerLogsTool,
  DockerPsTool,
  DockerStopTool,
  DockerRemoveTool,
  createDockerTools,
} from '../../src/core/tools/docker-tools.js';
import { filterToolsByRole } from '../../src/core/tools/types.js';

describe('Docker Tools Definitions', () => {
  describe('DockerBuildTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DockerBuildTool();

      expect(tool.definition.name).toBe('docker_build');
      expect(tool.definition.description).toContain('Build');
      expect(tool.definition.description).toContain('Docker');
    });

    it('should have required context parameter', () => {
      const tool = new DockerBuildTool();
      const contextParam = tool.definition.parameters.find(p => p.name === 'context');

      expect(contextParam).toBeDefined();
      expect(contextParam?.required).toBe(true);
      expect(contextParam?.type).toBe('string');
    });

    it('should have required tag parameter', () => {
      const tool = new DockerBuildTool();
      const tagParam = tool.definition.parameters.find(p => p.name === 'tag');

      expect(tagParam).toBeDefined();
      expect(tagParam?.required).toBe(true);
      expect(tagParam?.type).toBe('string');
    });

    it('should have optional dockerfile parameter', () => {
      const tool = new DockerBuildTool();
      const dockerfileParam = tool.definition.parameters.find(p => p.name === 'dockerfile');

      expect(dockerfileParam).toBeDefined();
      expect(dockerfileParam?.required).toBe(false);
    });

    it('should have devops and ops roles', () => {
      const tool = new DockerBuildTool();

      expect(tool.roles).toContain('devops');
      expect(tool.roles).toContain('ops');
      expect(tool.roles).not.toContain('dev');
      expect(tool.roles).not.toContain('pm');
    });
  });

  describe('DockerRunTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DockerRunTool();

      expect(tool.definition.name).toBe('docker_run');
      expect(tool.definition.description).toContain('Run');
    });

    it('should have required image parameter', () => {
      const tool = new DockerRunTool();
      const imageParam = tool.definition.parameters.find(p => p.name === 'image');

      expect(imageParam).toBeDefined();
      expect(imageParam?.required).toBe(true);
    });

    it('should have optional port mapping parameter', () => {
      const tool = new DockerRunTool();
      const portsParam = tool.definition.parameters.find(p => p.name === 'ports');

      expect(portsParam).toBeDefined();
      expect(portsParam?.required).toBe(false);
    });

    it('should have optional detach parameter', () => {
      const tool = new DockerRunTool();
      const detachParam = tool.definition.parameters.find(p => p.name === 'detach');

      expect(detachParam).toBeDefined();
      expect(detachParam?.type).toBe('boolean');
    });
  });

  describe('DockerComposeUpTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DockerComposeUpTool();

      expect(tool.definition.name).toBe('docker_compose_up');
      expect(tool.definition.description).toContain('docker-compose');
    });

    it('should have required path parameter', () => {
      const tool = new DockerComposeUpTool();
      const pathParam = tool.definition.parameters.find(p => p.name === 'path');

      expect(pathParam).toBeDefined();
      expect(pathParam?.required).toBe(true);
    });

    it('should have optional build parameter', () => {
      const tool = new DockerComposeUpTool();
      const buildParam = tool.definition.parameters.find(p => p.name === 'build');

      expect(buildParam).toBeDefined();
      expect(buildParam?.required).toBe(false);
      expect(buildParam?.type).toBe('boolean');
    });
  });

  describe('DockerComposeDownTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DockerComposeDownTool();

      expect(tool.definition.name).toBe('docker_compose_down');
      expect(tool.definition.description).toContain('Stop');
    });

    it('should have optional volumes parameter', () => {
      const tool = new DockerComposeDownTool();
      const volumesParam = tool.definition.parameters.find(p => p.name === 'volumes');

      expect(volumesParam).toBeDefined();
      expect(volumesParam?.required).toBe(false);
      expect(volumesParam?.type).toBe('boolean');
    });
  });

  describe('DockerLogsTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DockerLogsTool();

      expect(tool.definition.name).toBe('docker_logs');
      expect(tool.definition.description).toContain('logs');
    });

    it('should have required container parameter', () => {
      const tool = new DockerLogsTool();
      const containerParam = tool.definition.parameters.find(p => p.name === 'container');

      expect(containerParam).toBeDefined();
      expect(containerParam?.required).toBe(true);
    });

    it('should have optional tail parameter', () => {
      const tool = new DockerLogsTool();
      const tailParam = tool.definition.parameters.find(p => p.name === 'tail');

      expect(tailParam).toBeDefined();
      expect(tailParam?.required).toBe(false);
      expect(tailParam?.type).toBe('number');
    });
  });

  describe('DockerPsTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DockerPsTool();

      expect(tool.definition.name).toBe('docker_ps');
      expect(tool.definition.description).toContain('List');
    });

    it('should have optional all parameter', () => {
      const tool = new DockerPsTool();
      const allParam = tool.definition.parameters.find(p => p.name === 'all');

      expect(allParam).toBeDefined();
      expect(allParam?.required).toBe(false);
      expect(allParam?.type).toBe('boolean');
    });
  });

  describe('DockerStopTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DockerStopTool();

      expect(tool.definition.name).toBe('docker_stop');
      expect(tool.definition.description).toContain('Stop');
    });

    it('should have required container parameter', () => {
      const tool = new DockerStopTool();
      const containerParam = tool.definition.parameters.find(p => p.name === 'container');

      expect(containerParam).toBeDefined();
      expect(containerParam?.required).toBe(true);
    });
  });

  describe('DockerRemoveTool', () => {
    it('should have correct tool definition', () => {
      const tool = new DockerRemoveTool();

      expect(tool.definition.name).toBe('docker_rm');
      expect(tool.definition.description).toContain('Remove');
    });

    it('should have optional force parameter', () => {
      const tool = new DockerRemoveTool();
      const forceParam = tool.definition.parameters.find(p => p.name === 'force');

      expect(forceParam).toBeDefined();
      expect(forceParam?.required).toBe(false);
      expect(forceParam?.type).toBe('boolean');
    });
  });
});

describe('createDockerTools', () => {
  it('should return all Docker tools', () => {
    const tools = createDockerTools();

    expect(tools.length).toBe(8);

    const toolNames = tools.map(t => t.definition.name);
    expect(toolNames).toContain('docker_build');
    expect(toolNames).toContain('docker_run');
    expect(toolNames).toContain('docker_compose_up');
    expect(toolNames).toContain('docker_compose_down');
    expect(toolNames).toContain('docker_logs');
    expect(toolNames).toContain('docker_ps');
    expect(toolNames).toContain('docker_stop');
    expect(toolNames).toContain('docker_rm');
  });

  it('should return tools with execute functions', () => {
    const tools = createDockerTools();

    for (const tool of tools) {
      expect(typeof tool.execute).toBe('function');
    }
  });
});

describe('Docker Tools Role Permissions', () => {
  it('should be accessible to devops role', () => {
    const tools = createDockerTools();
    const filteredTools = filterToolsByRole(tools, 'devops');

    expect(filteredTools.length).toBe(8);
  });

  it('should be accessible to ops role', () => {
    const tools = createDockerTools();
    const filteredTools = filterToolsByRole(tools, 'ops');

    expect(filteredTools.length).toBe(8);
  });

  it('should NOT be accessible to dev role', () => {
    const tools = createDockerTools();
    const filteredTools = filterToolsByRole(tools, 'dev');

    expect(filteredTools.length).toBe(0);
  });

  it('should NOT be accessible to pm role', () => {
    const tools = createDockerTools();
    const filteredTools = filterToolsByRole(tools, 'pm');

    expect(filteredTools.length).toBe(0);
  });

  it('should NOT be accessible to qa role', () => {
    const tools = createDockerTools();
    const filteredTools = filterToolsByRole(tools, 'qa');

    expect(filteredTools.length).toBe(0);
  });
});

describe('Docker Tools Parameter Validation', () => {
  describe('DockerBuildTool', () => {
    it('should reject non-string context parameter', async () => {
      const tool = new DockerBuildTool();
      const result = await tool.execute({ context: 123, tag: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('context');
      expect(result.error).toContain('string');
    });

    it('should reject non-string tag parameter', async () => {
      const tool = new DockerBuildTool();
      const result = await tool.execute({ context: '.', tag: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('tag');
      expect(result.error).toContain('string');
    });
  });

  describe('DockerRunTool', () => {
    it('should reject non-string image parameter', async () => {
      const tool = new DockerRunTool();
      const result = await tool.execute({ image: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('image');
      expect(result.error).toContain('string');
    });
  });

  describe('DockerComposeUpTool', () => {
    it('should reject non-string path parameter', async () => {
      const tool = new DockerComposeUpTool();
      const result = await tool.execute({ path: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('path');
      expect(result.error).toContain('string');
    });
  });

  describe('DockerLogsTool', () => {
    it('should reject non-string container parameter', async () => {
      const tool = new DockerLogsTool();
      const result = await tool.execute({ container: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('container');
      expect(result.error).toContain('string');
    });
  });

  describe('DockerStopTool', () => {
    it('should reject non-string container parameter', async () => {
      const tool = new DockerStopTool();
      const result = await tool.execute({ container: null });

      expect(result.success).toBe(false);
      expect(result.error).toContain('container');
    });
  });

  describe('DockerRemoveTool', () => {
    it('should reject non-string container parameter', async () => {
      const tool = new DockerRemoveTool();
      const result = await tool.execute({ container: undefined });

      expect(result.success).toBe(false);
      expect(result.error).toContain('container');
    });
  });
});
