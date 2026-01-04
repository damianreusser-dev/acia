/**
 * Docker Template Types
 *
 * Types for Docker deployment file generation.
 */

/**
 * Options for generating a Node.js Dockerfile
 */
export interface DockerTemplateOptions {
  projectName: string;
  port: number;
  healthPath: string; // e.g., '/api/health'
  entryPoint: string; // e.g., 'dist/index.js'
  baseImage?: string; // default: 'node:20-alpine'
}

/**
 * Options for generating docker-compose.yml
 */
export interface ComposeTemplateOptions {
  projectName: string;
  services: ServiceConfig[];
}

/**
 * Configuration for a single service in docker-compose
 */
export interface ServiceConfig {
  name: string; // 'backend', 'frontend'
  buildContext: string; // './backend'
  port: number;
  healthPath?: string; // default: '/api/health'
  dependsOn?: string[];
  environment?: Record<string, string>;
}

/**
 * Result of Docker file generation
 */
export interface DockerGenerationResult {
  success: boolean;
  filesCreated: string[];
  error?: string;
}
