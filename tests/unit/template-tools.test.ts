/**
 * Template Tools Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  ListTemplatessTool,
  GenerateProjectTool,
  PreviewTemplateTool,
  createTemplateTools,
} from '../../src/core/tools/template-tools.js';

describe('Template Tools', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-template-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('ListTemplatessTool', () => {
    it('should list available templates', async () => {
      const tool = new ListTemplatessTool(testDir);

      expect(tool.definition.name).toBe('list_templates');

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.output).toContain('react');
      expect(result.output).toContain('express');
      expect(result.output).toContain('fullstack');
      expect(result.output).toContain('frontend');
      expect(result.output).toContain('backend');
    });
  });

  describe('GenerateProjectTool', () => {
    it('should generate a React project', async () => {
      const tool = new GenerateProjectTool(testDir);

      expect(tool.definition.name).toBe('generate_project');

      const result = await tool.execute({
        template: 'react',
        projectName: 'my-react-app',
        description: 'Test React App',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('my-react-app');
      expect(result.output).toContain('Successfully generated');

      // Verify files were created
      const packagePath = path.join(testDir, 'my-react-app', 'package.json');
      const exists = await fs.access(packagePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should generate an Express project', async () => {
      const tool = new GenerateProjectTool(testDir);

      const result = await tool.execute({
        template: 'express',
        projectName: 'my-api',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('my-api');

      // Verify server file was created
      const serverPath = path.join(testDir, 'my-api', 'src', 'server.ts');
      const exists = await fs.access(serverPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should generate a fullstack project', async () => {
      const tool = new GenerateProjectTool(testDir);

      const result = await tool.execute({
        template: 'fullstack',
        projectName: 'my-fullstack',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('fullstack');
      expect(result.output).toContain('my-fullstack-frontend');
      expect(result.output).toContain('my-fullstack-backend');

      // Verify both projects were created
      const frontendExists = await fs.access(
        path.join(testDir, 'my-fullstack-frontend', 'package.json')
      ).then(() => true).catch(() => false);
      const backendExists = await fs.access(
        path.join(testDir, 'my-fullstack-backend', 'package.json')
      ).then(() => true).catch(() => false);

      expect(frontendExists).toBe(true);
      expect(backendExists).toBe(true);
    });

    it('should fail for unknown template', async () => {
      const tool = new GenerateProjectTool(testDir);

      const result = await tool.execute({
        template: 'unknown',
        projectName: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.output).toContain('not found');
      expect(result.output).toContain('Available');
    });

    it('should fail for missing parameters', async () => {
      const tool = new GenerateProjectTool(testDir);

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.output).toContain('Missing required parameters');
    });
  });

  describe('PreviewTemplateTool', () => {
    it('should preview a React template', async () => {
      const tool = new PreviewTemplateTool(testDir);

      expect(tool.definition.name).toBe('preview_template');

      const result = await tool.execute({
        template: 'react',
        projectName: 'preview-app',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('react');
      expect(result.output).toContain('preview-app');
      expect(result.output).toContain('frontend');
      expect(result.output).toContain('package.json');
      expect(result.output).toContain('App.tsx');
      expect(result.output).toContain('Dependencies');
    });

    it('should preview an Express template', async () => {
      const tool = new PreviewTemplateTool(testDir);

      const result = await tool.execute({
        template: 'express',
        projectName: 'preview-api',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('express');
      expect(result.output).toContain('backend');
      expect(result.output).toContain('server.ts');
    });

    it('should fail for unknown template', async () => {
      const tool = new PreviewTemplateTool(testDir);

      const result = await tool.execute({
        template: 'unknown',
        projectName: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.output).toContain('not found');
    });

    it('should fail for missing parameters', async () => {
      const tool = new PreviewTemplateTool(testDir);

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.output).toContain('Missing required parameters');
    });
  });

  describe('createTemplateTools', () => {
    it('should create all template tools', () => {
      const tools = createTemplateTools(testDir);

      expect(tools.length).toBe(3);
      expect(tools.map((t) => t.definition.name)).toContain('list_templates');
      expect(tools.map((t) => t.definition.name)).toContain('generate_project');
      expect(tools.map((t) => t.definition.name)).toContain('preview_template');
    });
  });
});
