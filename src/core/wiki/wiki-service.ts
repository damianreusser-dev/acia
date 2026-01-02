/**
 * Wiki Service - Persistent knowledge store for agents
 *
 * Provides a file-based wiki system using Markdown files.
 * Human-readable, git-trackable, and searchable.
 *
 * Structure:
 * wiki/
 * ├── project/          # Project-level docs
 * ├── designs/          # Design documents
 * ├── tasks/            # Task history and learnings
 * ├── decisions/        # Architecture Decision Records
 * └── context/          # Current sprint context
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface WikiPage {
  path: string; // Relative path within wiki (e.g., "project/overview.md")
  title: string;
  content: string;
  lastModified: Date;
}

export interface WikiSearchResult {
  path: string;
  title: string;
  snippet: string; // Matched content snippet
  lineNumber: number;
}

export interface WikiServiceConfig {
  wikiRoot: string; // Absolute path to wiki directory
}

export class WikiService {
  private wikiRoot: string;

  constructor(config: WikiServiceConfig) {
    this.wikiRoot = config.wikiRoot;
  }

  /**
   * Initialize wiki directory structure
   */
  async initialize(): Promise<void> {
    const directories = [
      '',
      'project',
      'designs',
      'tasks',
      'tasks/completed',
      'decisions',
      'context',
    ];

    for (const dir of directories) {
      const fullPath = path.join(this.wikiRoot, dir);
      await fs.mkdir(fullPath, { recursive: true });
    }

    // Create default overview if it doesn't exist
    const overviewPath = path.join(this.wikiRoot, 'project', 'overview.md');
    try {
      await fs.access(overviewPath);
    } catch {
      await this.writePage('project/overview.md', {
        title: 'Project Overview',
        content: '# Project Overview\n\nThis wiki contains project knowledge and documentation.\n',
      });
    }
  }

  /**
   * Read a wiki page by path
   */
  async readPage(pagePath: string): Promise<WikiPage | null> {
    const fullPath = this.resolvePath(pagePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);
      const title = this.extractTitle(content, pagePath);

      return {
        path: pagePath,
        title,
        content,
        lastModified: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * Write or update a wiki page
   */
  async writePage(
    pagePath: string,
    data: { title?: string; content: string }
  ): Promise<WikiPage> {
    const fullPath = this.resolvePath(pagePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Add title as H1 if not present and title provided
    let content = data.content;
    if (data.title && !content.startsWith('# ')) {
      content = `# ${data.title}\n\n${content}`;
    }

    await fs.writeFile(fullPath, content, 'utf-8');

    const stats = await fs.stat(fullPath);
    return {
      path: pagePath,
      title: data.title || this.extractTitle(content, pagePath),
      content,
      lastModified: stats.mtime,
    };
  }

  /**
   * Append content to an existing page (useful for logs, learnings)
   */
  async appendToPage(pagePath: string, content: string): Promise<WikiPage> {
    const existing = await this.readPage(pagePath);

    if (existing) {
      const newContent = existing.content.trimEnd() + '\n\n' + content;
      return this.writePage(pagePath, { content: newContent });
    } else {
      return this.writePage(pagePath, { content });
    }
  }

  /**
   * Delete a wiki page
   */
  async deletePage(pagePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(pagePath);

    try {
      await fs.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all pages in a directory
   */
  async listPages(directory: string = ''): Promise<string[]> {
    const fullPath = path.join(this.wikiRoot, directory);
    const pages: string[] = [];

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        const relativePath = directory ? `${directory}/${entry.name}` : entry.name;

        if (entry.isFile() && entry.name.endsWith('.md')) {
          pages.push(relativePath);
        } else if (entry.isDirectory()) {
          const subPages = await this.listPages(relativePath);
          pages.push(...subPages);
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return pages;
  }

  /**
   * Search wiki content for a pattern
   */
  async search(query: string, directory: string = ''): Promise<WikiSearchResult[]> {
    const pages = await this.listPages(directory);
    const results: WikiSearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const pagePath of pages) {
      const page = await this.readPage(pagePath);
      if (!page) continue;

      const lines = page.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && line.toLowerCase().includes(queryLower)) {
          // Create snippet with context
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length, i + 2);
          const snippet = lines.slice(start, end).join('\n');

          results.push({
            path: pagePath,
            title: page.title,
            snippet,
            lineNumber: i + 1,
          });

          // Only one result per page
          break;
        }
      }
    }

    return results;
  }

  /**
   * Check if a page exists
   */
  async exists(pagePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(pagePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get wiki root path
   */
  getWikiRoot(): string {
    return this.wikiRoot;
  }

  /**
   * Resolve a wiki path to an absolute path
   * Prevents directory traversal attacks
   */
  private resolvePath(pagePath: string): string {
    // Normalize and ensure .md extension
    let normalized = pagePath.replace(/\\/g, '/');
    if (!normalized.endsWith('.md')) {
      normalized += '.md';
    }

    // Prevent directory traversal
    const resolved = path.resolve(this.wikiRoot, normalized);
    if (!resolved.startsWith(this.wikiRoot)) {
      throw new Error('Invalid wiki path: directory traversal detected');
    }

    return resolved;
  }

  /**
   * Extract title from content (first H1) or generate from path
   */
  private extractTitle(content: string, pagePath: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    if (match && match[1]) {
      return match[1].trim();
    }

    // Generate from path
    const basename = path.basename(pagePath, '.md');
    return basename
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
