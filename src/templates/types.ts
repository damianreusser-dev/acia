/**
 * Project Template Types
 *
 * Types for project scaffolding and templates.
 */

/**
 * Project template categories
 */
export type TemplateCategory = 'frontend' | 'backend' | 'fullstack' | 'infrastructure';

/**
 * File to be generated from a template
 */
export interface TemplateFile {
  path: string;
  content: string;
  description?: string;
}

/**
 * Project template definition
 */
export interface ProjectTemplate {
  name: string;
  description: string;
  category: TemplateCategory;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  files: TemplateFile[];
  scripts?: Record<string, string>;
}

/**
 * Template generation options
 */
export interface TemplateOptions {
  projectName: string;
  description?: string;
  author?: string;
  version?: string;
}

/**
 * Result of template generation
 */
export interface TemplateResult {
  success: boolean;
  filesCreated: string[];
  error?: string;
}
