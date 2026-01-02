/**
 * Template Service
 *
 * Service for generating projects from templates.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectTemplate, TemplateOptions, TemplateResult, TemplateCategory } from './types.js';
import { createReactTemplate } from './react-template.js';
import { createExpressTemplate } from './express-template.js';

/**
 * Available template generators
 */
const templateGenerators: Record<string, (options: TemplateOptions) => ProjectTemplate> = {
  react: createReactTemplate,
  express: createExpressTemplate,
};

/**
 * Template Service for generating project scaffolds
 */
export class TemplateService {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  /**
   * Get list of available templates
   */
  getAvailableTemplates(): Array<{ name: string; category: TemplateCategory }> {
    return [
      { name: 'react', category: 'frontend' },
      { name: 'express', category: 'backend' },
    ];
  }

  /**
   * Check if a template exists
   */
  hasTemplate(name: string): boolean {
    return name in templateGenerators;
  }

  /**
   * Generate a project from a template
   */
  async generate(
    templateName: string,
    options: TemplateOptions
  ): Promise<TemplateResult> {
    const generator = templateGenerators[templateName];

    if (!generator) {
      return {
        success: false,
        filesCreated: [],
        error: `Template "${templateName}" not found. Available: ${Object.keys(templateGenerators).join(', ')}`,
      };
    }

    try {
      const template = generator(options);
      const projectDir = path.join(this.outputDir, options.projectName);

      // Create project directory
      await fs.mkdir(projectDir, { recursive: true });

      const filesCreated: string[] = [];

      // Write all template files
      for (const file of template.files) {
        const filePath = path.join(projectDir, file.path);
        const fileDir = path.dirname(filePath);

        // Ensure directory exists
        await fs.mkdir(fileDir, { recursive: true });

        // Write file
        await fs.writeFile(filePath, file.content, 'utf-8');
        filesCreated.push(file.path);
      }

      return {
        success: true,
        filesCreated,
      };
    } catch (error) {
      return {
        success: false,
        filesCreated: [],
        error: error instanceof Error ? error.message : 'Unknown error during generation',
      };
    }
  }

  /**
   * Generate a template for review (without writing files)
   */
  preview(templateName: string, options: TemplateOptions): ProjectTemplate | null {
    const generator = templateGenerators[templateName];
    if (!generator) {
      return null;
    }
    return generator(options);
  }

  /**
   * Get output directory
   */
  getOutputDir(): string {
    return this.outputDir;
  }

  /**
   * Set output directory
   */
  setOutputDir(dir: string): void {
    this.outputDir = dir;
  }
}

/**
 * Create a fullstack project with both React frontend and Express backend
 */
export async function createFullstackProject(
  outputDir: string,
  options: TemplateOptions
): Promise<TemplateResult> {
  const service = new TemplateService(outputDir);
  const filesCreated: string[] = [];

  // Create frontend
  const frontendOptions: TemplateOptions = {
    ...options,
    projectName: `${options.projectName}-frontend`,
    description: `${options.description ?? options.projectName} - Frontend`,
  };

  const frontendResult = await service.generate('react', frontendOptions);
  if (!frontendResult.success) {
    return frontendResult;
  }
  filesCreated.push(...frontendResult.filesCreated.map((f) => `${frontendOptions.projectName}/${f}`));

  // Create backend
  const backendOptions: TemplateOptions = {
    ...options,
    projectName: `${options.projectName}-backend`,
    description: `${options.description ?? options.projectName} - Backend API`,
  };

  const backendResult = await service.generate('express', backendOptions);
  if (!backendResult.success) {
    return backendResult;
  }
  filesCreated.push(...backendResult.filesCreated.map((f) => `${backendOptions.projectName}/${f}`));

  return {
    success: true,
    filesCreated,
  };
}
