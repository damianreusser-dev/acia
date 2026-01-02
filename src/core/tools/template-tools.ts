/**
 * Template Tools
 *
 * Tools for agents to generate project scaffolds from templates.
 */

import { Tool, ToolDefinition, ToolResult } from './types.js';
import { TemplateService, createFullstackProject } from '../../templates/index.js';

/**
 * Tool to list available templates
 */
export class ListTemplatessTool implements Tool {
  private templateService: TemplateService;

  definition: ToolDefinition = {
    name: 'list_templates',
    description:
      'List all available project templates. Returns template names and their categories (frontend, backend, fullstack).',
    parameters: [],
  };

  constructor(workspace: string) {
    this.templateService = new TemplateService(workspace);
  }

  async execute(): Promise<ToolResult> {
    const templates = this.templateService.getAvailableTemplates();

    let output = 'Available templates:\n\n';
    for (const template of templates) {
      output += `- ${template.name} (${template.category})\n`;
    }
    output += '\n- fullstack (creates both React frontend and Express backend)\n';

    return {
      success: true,
      output,
    };
  }
}

/**
 * Tool to generate a project from a template
 */
export class GenerateProjectTool implements Tool {
  private templateService: TemplateService;
  private workspace: string;

  definition: ToolDefinition = {
    name: 'generate_project',
    description:
      'Generate a project scaffold from a template. Creates all necessary files for a working project. ' +
      'Available templates: react (frontend), express (backend), fullstack (both). ' +
      'The project will be created in a subdirectory with the given name.',
    parameters: [
      {
        name: 'template',
        type: 'string',
        description: 'Template to use: "react", "express", or "fullstack"',
        required: true,
      },
      {
        name: 'projectName',
        type: 'string',
        description: 'Name for the project (will be used as directory name)',
        required: true,
      },
      {
        name: 'description',
        type: 'string',
        description: 'Description of the project (optional)',
        required: false,
      },
    ],
  };

  constructor(workspace: string) {
    this.templateService = new TemplateService(workspace);
    this.workspace = workspace;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const template = params.template as string;
    const projectName = params.projectName as string;
    const description = (params.description as string) ?? projectName;

    if (!template || !projectName) {
      return {
        success: false,
        output: 'Missing required parameters: template and projectName',
        error: 'MISSING_PARAMS',
      };
    }

    // Handle fullstack template specially
    if (template === 'fullstack') {
      const result = await createFullstackProject(this.workspace, {
        projectName,
        description,
      });

      if (!result.success) {
        return {
          success: false,
          output: `Failed to generate fullstack project: ${result.error}`,
          error: result.error,
        };
      }

      return {
        success: true,
        output:
          `Successfully generated fullstack project "${projectName}"!\n\n` +
          `Created ${result.filesCreated.length} files:\n` +
          `Frontend: ${projectName}-frontend/\n` +
          `Backend: ${projectName}-backend/\n\n` +
          `Next steps:\n` +
          `1. cd ${projectName}-backend && npm install && npm run dev\n` +
          `2. cd ${projectName}-frontend && npm install && npm run dev\n`,
      };
    }

    // Check if template exists
    if (!this.templateService.hasTemplate(template)) {
      const available = this.templateService.getAvailableTemplates();
      return {
        success: false,
        output: `Template "${template}" not found. Available: ${available.map((t) => t.name).join(', ')}, fullstack`,
        error: 'TEMPLATE_NOT_FOUND',
      };
    }

    // Generate the project
    const result = await this.templateService.generate(template, {
      projectName,
      description,
    });

    if (!result.success) {
      return {
        success: false,
        output: `Failed to generate project: ${result.error}`,
        error: result.error,
      };
    }

    return {
      success: true,
      output:
        `Successfully generated ${template} project "${projectName}"!\n\n` +
        `Created ${result.filesCreated.length} files:\n` +
        result.filesCreated.map((f) => `  - ${f}`).join('\n') +
        `\n\nNext steps:\n` +
        `1. cd ${projectName}\n` +
        `2. npm install\n` +
        `3. npm run dev\n`,
    };
  }
}

/**
 * Tool to preview a template without generating files
 */
export class PreviewTemplateTool implements Tool {
  private templateService: TemplateService;

  definition: ToolDefinition = {
    name: 'preview_template',
    description:
      'Preview what files would be created by a template without actually creating them. ' +
      'Useful for understanding template structure before generation.',
    parameters: [
      {
        name: 'template',
        type: 'string',
        description: 'Template to preview: "react" or "express"',
        required: true,
      },
      {
        name: 'projectName',
        type: 'string',
        description: 'Name to use in the preview',
        required: true,
      },
    ],
  };

  constructor(workspace: string) {
    this.templateService = new TemplateService(workspace);
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const template = params.template as string;
    const projectName = params.projectName as string;

    if (!template || !projectName) {
      return {
        success: false,
        output: 'Missing required parameters: template and projectName',
        error: 'MISSING_PARAMS',
      };
    }

    const preview = this.templateService.preview(template, { projectName });

    if (!preview) {
      return {
        success: false,
        output: `Template "${template}" not found.`,
        error: 'TEMPLATE_NOT_FOUND',
      };
    }

    let output = `Template: ${template}\n`;
    output += `Project: ${preview.name}\n`;
    output += `Category: ${preview.category}\n\n`;
    output += `Files that would be created:\n`;
    for (const file of preview.files) {
      output += `  - ${file.path}\n`;
    }
    output += `\nDependencies:\n`;
    for (const [dep, version] of Object.entries(preview.dependencies ?? {})) {
      output += `  - ${dep}: ${version}\n`;
    }
    output += `\nDev Dependencies:\n`;
    for (const [dep, version] of Object.entries(preview.devDependencies ?? {})) {
      output += `  - ${dep}: ${version}\n`;
    }

    return {
      success: true,
      output,
    };
  }
}

/**
 * Create all template tools for a workspace
 */
export function createTemplateTools(workspace: string): Tool[] {
  return [
    new ListTemplatessTool(workspace),
    new GenerateProjectTool(workspace),
    new PreviewTemplateTool(workspace),
  ];
}
