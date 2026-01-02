/**
 * Unit tests for Wiki Tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WikiService } from '../../src/core/wiki/wiki-service.js';
import { createWikiTools } from '../../src/core/wiki/wiki-tools.js';
import { Tool } from '../../src/core/tools/types.js';

describe('Wiki Tools', () => {
  let wikiRoot: string;
  let wikiService: WikiService;
  let tools: Tool[];

  beforeEach(async () => {
    wikiRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-wiki-tools-'));
    wikiService = new WikiService({ wikiRoot });
    await wikiService.initialize();
    tools = createWikiTools(wikiService);
  });

  afterEach(async () => {
    await fs.rm(wikiRoot, { recursive: true, force: true });
  });

  function getTool(name: string): Tool {
    const tool = tools.find((t) => t.definition.name === name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool;
  }

  describe('createWikiTools', () => {
    it('should create all wiki tools', () => {
      expect(tools.length).toBe(5);
      expect(tools.map((t) => t.definition.name)).toEqual([
        'read_wiki',
        'write_wiki',
        'append_wiki',
        'search_wiki',
        'list_wiki',
      ]);
    });
  });

  describe('read_wiki', () => {
    const toolName = 'read_wiki';

    it('should read an existing page', async () => {
      await wikiService.writePage('test.md', {
        title: 'Test Page',
        content: 'Test content here',
      });

      const tool = getTool(toolName);
      const result = await tool.execute({ path: 'test.md' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Test Page');
      expect(result.output).toContain('Test content here');
    });

    it('should return error for non-existent page', async () => {
      const tool = getTool(toolName);
      const result = await tool.execute({ path: 'not-found.md' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should require path parameter', async () => {
      const tool = getTool(toolName);
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('write_wiki', () => {
    const toolName = 'write_wiki';

    it('should write a new page', async () => {
      const tool = getTool(toolName);
      const result = await tool.execute({
        path: 'new-page.md',
        title: 'New Page',
        content: 'Brand new content',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('new-page.md');

      const page = await wikiService.readPage('new-page.md');
      expect(page?.content).toContain('Brand new content');
    });

    it('should update existing page', async () => {
      await wikiService.writePage('existing.md', { content: 'Old content' });

      const tool = getTool(toolName);
      await tool.execute({
        path: 'existing.md',
        content: 'Updated content',
      });

      const page = await wikiService.readPage('existing.md');
      expect(page?.content).toContain('Updated content');
      expect(page?.content).not.toContain('Old content');
    });

    it('should require path and content', async () => {
      const tool = getTool(toolName);

      const noPath = await tool.execute({ content: 'stuff' });
      expect(noPath.success).toBe(false);

      const noContent = await tool.execute({ path: 'x.md' });
      expect(noContent.success).toBe(false);
    });
  });

  describe('append_wiki', () => {
    const toolName = 'append_wiki';

    it('should append to existing page', async () => {
      await wikiService.writePage('log.md', { content: 'Entry 1' });

      const tool = getTool(toolName);
      await tool.execute({
        path: 'log.md',
        content: 'Entry 2',
      });

      const page = await wikiService.readPage('log.md');
      expect(page?.content).toContain('Entry 1');
      expect(page?.content).toContain('Entry 2');
    });

    it('should create page if not exists', async () => {
      const tool = getTool(toolName);
      await tool.execute({
        path: 'new-log.md',
        content: 'First entry',
      });

      const page = await wikiService.readPage('new-log.md');
      expect(page).not.toBeNull();
      expect(page?.content).toContain('First entry');
    });
  });

  describe('search_wiki', () => {
    const toolName = 'search_wiki';

    beforeEach(async () => {
      await wikiService.writePage('doc1.md', {
        title: 'Auth Design',
        content: 'JWT authentication flow',
      });
      await wikiService.writePage('doc2.md', {
        title: 'API Design',
        content: 'REST endpoints for users',
      });
    });

    it('should find pages with matching content', async () => {
      const tool = getTool(toolName);
      const result = await tool.execute({ query: 'JWT' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Auth Design');
      expect(result.output).toContain('JWT');
    });

    it('should search within directory', async () => {
      await wikiService.writePage('designs/feature.md', {
        content: 'JWT tokens',
      });

      const tool = getTool(toolName);
      const result = await tool.execute({
        query: 'JWT',
        directory: 'designs',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('designs/feature.md');
      expect(result.output).not.toContain('doc1.md');
    });

    it('should return no results message when nothing found', async () => {
      const tool = getTool(toolName);
      const result = await tool.execute({ query: 'xyznonexistent' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('No results');
    });
  });

  describe('list_wiki', () => {
    const toolName = 'list_wiki';

    beforeEach(async () => {
      await wikiService.writePage('root.md', { content: 'Root' });
      await wikiService.writePage('designs/auth.md', { content: 'Auth' });
      await wikiService.writePage('designs/api.md', { content: 'API' });
    });

    it('should list all pages', async () => {
      const tool = getTool(toolName);
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.output).toContain('root.md');
      expect(result.output).toContain('designs/auth.md');
      expect(result.output).toContain('designs/api.md');
    });

    it('should list pages in specific directory', async () => {
      const tool = getTool(toolName);
      const result = await tool.execute({ directory: 'designs' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('designs/auth.md');
      expect(result.output).toContain('designs/api.md');
      expect(result.output).not.toContain('root.md');
    });

    it('should handle empty directory', async () => {
      const tool = getTool(toolName);
      const result = await tool.execute({ directory: 'empty-dir' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('No pages found');
    });
  });
});
