/**
 * Wiki Tools - Tools for agents to interact with the wiki
 *
 * Provides read, write, search, and list capabilities for the wiki system.
 */

import { Tool, ToolDefinition, ToolResult } from '../tools/types.js';
import { WikiService } from './wiki-service.js';

/**
 * Tool for reading wiki pages
 */
class ReadWikiTool implements Tool {
  definition: ToolDefinition = {
    name: 'read_wiki',
    description:
      'Read a wiki page by path. Use this to access project knowledge, design docs, and learnings.',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description:
          'Path to the wiki page (e.g., "project/overview", "designs/auth-system")',
        required: true,
      },
    ],
  };

  constructor(private wikiService: WikiService) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const pagePath = params.path as string;

    if (!pagePath) {
      return { success: false, error: 'Path is required' };
    }

    try {
      const page = await this.wikiService.readPage(pagePath);

      if (!page) {
        return { success: false, error: `Wiki page not found: ${pagePath}` };
      }

      return {
        success: true,
        output: `# ${page.title}\n\nPath: ${page.path}\nLast Modified: ${page.lastModified.toISOString()}\n\n---\n\n${page.content}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read wiki page',
      };
    }
  }
}

/**
 * Tool for writing wiki pages
 */
class WriteWikiTool implements Tool {
  definition: ToolDefinition = {
    name: 'write_wiki',
    description:
      'Write or update a wiki page. Use this to document designs, decisions, and learnings.',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description:
          'Path for the wiki page (e.g., "designs/new-feature", "tasks/completed/task-123")',
        required: true,
      },
      {
        name: 'title',
        type: 'string',
        description: 'Title of the page (will be added as H1 header)',
        required: false,
      },
      {
        name: 'content',
        type: 'string',
        description: 'Markdown content for the page',
        required: true,
      },
    ],
  };

  constructor(private wikiService: WikiService) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const pagePath = params.path as string;
    const title = params.title as string | undefined;
    const content = params.content as string;

    if (!pagePath) {
      return { success: false, error: 'Path is required' };
    }

    if (!content) {
      return { success: false, error: 'Content is required' };
    }

    try {
      const page = await this.wikiService.writePage(pagePath, { title, content });

      return {
        success: true,
        output: `Successfully wrote wiki page: ${page.path}\nTitle: ${page.title}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write wiki page',
      };
    }
  }
}

/**
 * Tool for appending to wiki pages (useful for logs, learnings)
 */
class AppendWikiTool implements Tool {
  definition: ToolDefinition = {
    name: 'append_wiki',
    description:
      'Append content to an existing wiki page. Useful for adding learnings, logs, or updates.',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the wiki page',
        required: true,
      },
      {
        name: 'content',
        type: 'string',
        description: 'Content to append',
        required: true,
      },
    ],
  };

  constructor(private wikiService: WikiService) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const pagePath = params.path as string;
    const content = params.content as string;

    if (!pagePath || !content) {
      return { success: false, error: 'Path and content are required' };
    }

    try {
      const page = await this.wikiService.appendToPage(pagePath, content);

      return {
        success: true,
        output: `Successfully appended to wiki page: ${page.path}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to append to wiki page',
      };
    }
  }
}

/**
 * Tool for searching wiki content
 */
class SearchWikiTool implements Tool {
  definition: ToolDefinition = {
    name: 'search_wiki',
    description:
      'Search wiki content for a keyword or phrase. Returns matching pages with snippets.',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query (keyword or phrase)',
        required: true,
      },
      {
        name: 'directory',
        type: 'string',
        description: 'Optional directory to search within (e.g., "designs", "tasks")',
        required: false,
      },
    ],
  };

  constructor(private wikiService: WikiService) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const query = params.query as string;
    const directory = (params.directory as string) || '';

    if (!query) {
      return { success: false, error: 'Query is required' };
    }

    try {
      const results = await this.wikiService.search(query, directory);

      if (results.length === 0) {
        return {
          success: true,
          output: `No results found for: "${query}"`,
        };
      }

      const output = results
        .map(
          (r) =>
            `## ${r.title}\nPath: ${r.path} (line ${r.lineNumber})\n\`\`\`\n${r.snippet}\n\`\`\``
        )
        .join('\n\n');

      return {
        success: true,
        output: `Found ${results.length} result(s) for "${query}":\n\n${output}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search wiki',
      };
    }
  }
}

/**
 * Tool for listing wiki pages
 */
class ListWikiTool implements Tool {
  definition: ToolDefinition = {
    name: 'list_wiki',
    description: 'List all wiki pages, optionally within a specific directory.',
    parameters: [
      {
        name: 'directory',
        type: 'string',
        description:
          'Optional directory to list (e.g., "designs", "tasks/completed"). Empty for all.',
        required: false,
      },
    ],
  };

  constructor(private wikiService: WikiService) {}

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const directory = (params.directory as string) || '';

    try {
      const pages = await this.wikiService.listPages(directory);

      if (pages.length === 0) {
        return {
          success: true,
          output: directory
            ? `No pages found in: ${directory}`
            : 'No pages found in wiki',
        };
      }

      const output = pages.map((p) => `- ${p}`).join('\n');

      return {
        success: true,
        output: `Wiki pages${directory ? ` in ${directory}` : ''}:\n\n${output}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list wiki pages',
      };
    }
  }
}

/**
 * Create all wiki tools for an agent
 */
export function createWikiTools(wikiService: WikiService): Tool[] {
  return [
    new ReadWikiTool(wikiService),
    new WriteWikiTool(wikiService),
    new AppendWikiTool(wikiService),
    new SearchWikiTool(wikiService),
    new ListWikiTool(wikiService),
  ];
}
