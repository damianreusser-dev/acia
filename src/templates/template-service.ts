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
 * Creates a single project directory with frontend/ and backend/ subdirectories
 */
export async function createFullstackProject(
  outputDir: string,
  options: TemplateOptions
): Promise<TemplateResult> {
  const filesCreated: string[] = [];
  const projectDir = path.join(outputDir, options.projectName);

  try {
    // Create project root directory
    await fs.mkdir(projectDir, { recursive: true });

    // Generate React template
    const reactGenerator = templateGenerators['react'];
    if (!reactGenerator) {
      return { success: false, filesCreated: [], error: 'React template not found' };
    }
    const reactTemplate = reactGenerator({
      ...options,
      projectName: options.projectName,
      description: `${options.description ?? options.projectName} - Frontend`,
    });

    // Write frontend files to frontend/ subdirectory
    const frontendDir = path.join(projectDir, 'frontend');
    await fs.mkdir(frontendDir, { recursive: true });

    for (const file of reactTemplate.files) {
      const filePath = path.join(frontendDir, file.path);
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
      filesCreated.push(`frontend/${file.path}`);
    }

    // Generate Express template
    const expressGenerator = templateGenerators['express'];
    if (!expressGenerator) {
      return { success: false, filesCreated: [], error: 'Express template not found' };
    }
    const expressTemplate = expressGenerator({
      ...options,
      projectName: options.projectName,
      description: `${options.description ?? options.projectName} - Backend API`,
    });

    // Write backend files to backend/ subdirectory
    const backendDir = path.join(projectDir, 'backend');
    await fs.mkdir(backendDir, { recursive: true });

    for (const file of expressTemplate.files) {
      const filePath = path.join(backendDir, file.path);
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
      filesCreated.push(`backend/${file.path}`);
    }

    // Create root README.md
    const readmeContent = `# ${options.projectName}

${options.description ?? 'A fullstack application with React frontend and Express backend'}

## Project Structure

\`\`\`
${options.projectName}/
├── frontend/     # React + TypeScript frontend
├── backend/      # Express + TypeScript API
└── README.md
\`\`\`

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

1. Install frontend dependencies:
   \`\`\`bash
   cd frontend
   npm install
   \`\`\`

2. Install backend dependencies:
   \`\`\`bash
   cd backend
   npm install
   \`\`\`

### Development

1. Start the backend server:
   \`\`\`bash
   cd backend
   npm run dev
   \`\`\`

2. In another terminal, start the frontend:
   \`\`\`bash
   cd frontend
   npm run dev
   \`\`\`

### API Endpoints

The backend runs on \`http://localhost:3001\` by default.

- \`GET /api/health\` - Health check endpoint

### Frontend

The frontend runs on \`http://localhost:3000\` by default.
`;

    await fs.writeFile(path.join(projectDir, 'README.md'), readmeContent, 'utf-8');
    filesCreated.push('README.md');

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
