/**
 * Unit tests for WikiService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WikiService } from '../../src/core/wiki/wiki-service.js';

describe('WikiService', () => {
  let wikiRoot: string;
  let wikiService: WikiService;

  beforeEach(async () => {
    wikiRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-wiki-test-'));
    wikiService = new WikiService({ wikiRoot });
  });

  afterEach(async () => {
    await fs.rm(wikiRoot, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should create wiki directory structure', async () => {
      await wikiService.initialize();

      const dirs = ['project', 'designs', 'tasks', 'tasks/completed', 'decisions', 'context'];

      for (const dir of dirs) {
        const fullPath = path.join(wikiRoot, dir);
        const stat = await fs.stat(fullPath);
        expect(stat.isDirectory()).toBe(true);
      }
    });

    it('should create default overview page', async () => {
      await wikiService.initialize();

      const page = await wikiService.readPage('project/overview.md');
      expect(page).not.toBeNull();
      expect(page?.title).toBe('Project Overview');
    });

    it('should not overwrite existing overview', async () => {
      await wikiService.initialize();
      await wikiService.writePage('project/overview.md', {
        title: 'Custom Title',
        content: 'Custom content',
      });

      await wikiService.initialize(); // Re-initialize

      const page = await wikiService.readPage('project/overview.md');
      expect(page?.content).toContain('Custom content');
    });
  });

  describe('writePage', () => {
    it('should write a new page', async () => {
      const page = await wikiService.writePage('test-page.md', {
        title: 'Test Page',
        content: 'This is test content.',
      });

      expect(page.path).toBe('test-page.md');
      expect(page.title).toBe('Test Page');
      expect(page.content).toContain('# Test Page');
      expect(page.content).toContain('This is test content.');
    });

    it('should create directories as needed', async () => {
      await wikiService.writePage('deep/nested/path/page.md', {
        content: 'Nested content',
      });

      const page = await wikiService.readPage('deep/nested/path/page.md');
      expect(page).not.toBeNull();
      expect(page?.content).toContain('Nested content');
    });

    it('should add .md extension if missing', async () => {
      await wikiService.writePage('no-extension', {
        content: 'Content without extension',
      });

      const page = await wikiService.readPage('no-extension');
      expect(page).not.toBeNull();
    });

    it('should not duplicate H1 if content already has it', async () => {
      const page = await wikiService.writePage('has-header.md', {
        title: 'Title',
        content: '# Existing Header\n\nContent',
      });

      // Should not have two H1s
      const h1Count = (page.content.match(/^# /gm) || []).length;
      expect(h1Count).toBe(1);
    });
  });

  describe('readPage', () => {
    it('should read an existing page', async () => {
      await wikiService.writePage('readable.md', {
        title: 'Readable',
        content: 'Read me',
      });

      const page = await wikiService.readPage('readable.md');

      expect(page).not.toBeNull();
      expect(page?.title).toBe('Readable');
      expect(page?.lastModified).toBeInstanceOf(Date);
    });

    it('should return null for non-existent page', async () => {
      const page = await wikiService.readPage('does-not-exist.md');
      expect(page).toBeNull();
    });

    it('should extract title from H1 header', async () => {
      await fs.mkdir(wikiRoot, { recursive: true });
      await fs.writeFile(
        path.join(wikiRoot, 'with-header.md'),
        '# My Custom Title\n\nSome content'
      );

      const page = await wikiService.readPage('with-header.md');
      expect(page?.title).toBe('My Custom Title');
    });

    it('should generate title from path if no H1', async () => {
      await fs.mkdir(wikiRoot, { recursive: true });
      await fs.writeFile(path.join(wikiRoot, 'my-page-name.md'), 'No header here');

      const page = await wikiService.readPage('my-page-name.md');
      expect(page?.title).toBe('My Page Name');
    });
  });

  describe('appendToPage', () => {
    it('should append to existing page', async () => {
      await wikiService.writePage('appendable.md', { content: 'Initial content' });

      await wikiService.appendToPage('appendable.md', 'Appended content');

      const page = await wikiService.readPage('appendable.md');
      expect(page?.content).toContain('Initial content');
      expect(page?.content).toContain('Appended content');
    });

    it('should create page if it does not exist', async () => {
      await wikiService.appendToPage('new-append.md', 'First append');

      const page = await wikiService.readPage('new-append.md');
      expect(page).not.toBeNull();
      expect(page?.content).toContain('First append');
    });
  });

  describe('deletePage', () => {
    it('should delete an existing page', async () => {
      await wikiService.writePage('to-delete.md', { content: 'Delete me' });

      const deleted = await wikiService.deletePage('to-delete.md');
      expect(deleted).toBe(true);

      const page = await wikiService.readPage('to-delete.md');
      expect(page).toBeNull();
    });

    it('should return false for non-existent page', async () => {
      const deleted = await wikiService.deletePage('not-here.md');
      expect(deleted).toBe(false);
    });
  });

  describe('listPages', () => {
    it('should list all pages in wiki', async () => {
      await wikiService.writePage('page1.md', { content: 'Page 1' });
      await wikiService.writePage('page2.md', { content: 'Page 2' });
      await wikiService.writePage('subdir/page3.md', { content: 'Page 3' });

      const pages = await wikiService.listPages();

      expect(pages).toContain('page1.md');
      expect(pages).toContain('page2.md');
      expect(pages).toContain('subdir/page3.md');
    });

    it('should list pages in a specific directory', async () => {
      await wikiService.writePage('root.md', { content: 'Root' });
      await wikiService.writePage('designs/design1.md', { content: 'Design 1' });
      await wikiService.writePage('designs/design2.md', { content: 'Design 2' });

      const pages = await wikiService.listPages('designs');

      expect(pages).toContain('designs/design1.md');
      expect(pages).toContain('designs/design2.md');
      expect(pages).not.toContain('root.md');
    });

    it('should return empty array for non-existent directory', async () => {
      const pages = await wikiService.listPages('not-a-directory');
      expect(pages).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await wikiService.writePage('searchable1.md', {
        title: 'First',
        content: 'This contains the keyword apple in it.',
      });
      await wikiService.writePage('searchable2.md', {
        title: 'Second',
        content: 'This contains the keyword banana in it.',
      });
      await wikiService.writePage('designs/feature.md', {
        title: 'Feature Design',
        content: 'This also has apple mentioned.',
      });
    });

    it('should find pages containing the query', async () => {
      const results = await wikiService.search('apple');

      expect(results.length).toBe(2);
      expect(results.some((r) => r.path === 'searchable1.md')).toBe(true);
      expect(results.some((r) => r.path === 'designs/feature.md')).toBe(true);
    });

    it('should be case-insensitive', async () => {
      const results = await wikiService.search('APPLE');
      expect(results.length).toBe(2);
    });

    it('should search within a directory', async () => {
      const results = await wikiService.search('apple', 'designs');

      expect(results.length).toBe(1);
      expect(results[0].path).toBe('designs/feature.md');
    });

    it('should return empty array for no matches', async () => {
      const results = await wikiService.search('nonexistent-term');
      expect(results).toEqual([]);
    });

    it('should include snippets with context', async () => {
      const results = await wikiService.search('banana');

      expect(results.length).toBe(1);
      expect(results[0].snippet).toContain('banana');
    });
  });

  describe('exists', () => {
    it('should return true for existing page', async () => {
      await wikiService.writePage('exists.md', { content: 'I exist' });

      const exists = await wikiService.exists('exists.md');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent page', async () => {
      const exists = await wikiService.exists('nope.md');
      expect(exists).toBe(false);
    });
  });

  describe('security', () => {
    it('should prevent directory traversal', async () => {
      await expect(
        wikiService.writePage('../../../etc/passwd', { content: 'hack' })
      ).rejects.toThrow('directory traversal');
    });

    it('should prevent traversal with backslashes on Windows', async () => {
      await expect(
        wikiService.writePage('..\\..\\..\\etc\\passwd', { content: 'hack' })
      ).rejects.toThrow('directory traversal');
    });
  });
});
