/**
 * Docker Compose Template
 *
 * Generates docker-compose.yml files for multi-service deployments.
 *
 * IMPORTANT: Generated compose files do NOT include volume mounts
 * that would overwrite the container's /usr/src/app directory.
 * This was identified as a root cause of deployment failures.
 */

import type { ComposeTemplateOptions, ServiceConfig } from './types.js';

/**
 * Create a docker-compose.yml file
 *
 * Features:
 * - Health checks for all services
 * - Restart policies
 * - Production environment variables
 * - NO problematic volume mounts
 */
export function createDockerCompose(options: ComposeTemplateOptions): string {
  const services = options.services
    .map((svc) => createServiceBlock(svc))
    .join('\n');

  return `version: "3.8"

services:
${services}
`;
}

/**
 * Create a single service block for docker-compose
 */
function createServiceBlock(svc: ServiceConfig): string {
  const healthPath = svc.healthPath || '/api/health';
  const dependsOnBlock = svc.dependsOn?.length
    ? createDependsOnBlock(svc.dependsOn)
    : '';

  const envBlock = svc.environment
    ? createEnvironmentBlock(svc.environment)
    : `    environment:
      - NODE_ENV=production
      - PORT=${svc.port}`;

  return `  ${svc.name}:
    build:
      context: ${svc.buildContext}
      dockerfile: Dockerfile
    ports:
      - "${svc.port}:${svc.port}"
${envBlock}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${svc.port}${healthPath}"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s${dependsOnBlock}
`;
}

/**
 * Create depends_on block with service_healthy condition
 */
function createDependsOnBlock(dependencies: string[]): string {
  const deps = dependencies
    .map(
      (dep) => `        ${dep}:
          condition: service_healthy`
    )
    .join('\n');

  return `
    depends_on:
${deps}`;
}

/**
 * Create environment block from key-value pairs
 */
function createEnvironmentBlock(env: Record<string, string>): string {
  const vars = Object.entries(env)
    .map(([key, value]) => `      - ${key}=${value}`)
    .join('\n');

  return `    environment:
${vars}`;
}

/**
 * Create a simple single-service compose file
 *
 * Convenience function for backend-only deployments
 */
export function createSingleServiceCompose(
  projectName: string,
  port: number,
  healthPath = '/api/health'
): string {
  return createDockerCompose({
    projectName,
    services: [
      {
        name: 'backend',
        buildContext: '.',
        port,
        healthPath,
      },
    ],
  });
}

/**
 * Create a fullstack compose file with frontend and backend
 *
 * Frontend depends on backend being healthy
 */
export function createFullstackCompose(
  projectName: string,
  backendPort = 3001,
  frontendPort = 3000,
  backendHealthPath = '/api/health'
): string {
  return createDockerCompose({
    projectName,
    services: [
      {
        name: 'backend',
        buildContext: './backend',
        port: backendPort,
        healthPath: backendHealthPath,
      },
      {
        name: 'frontend',
        buildContext: './frontend',
        port: frontendPort,
        dependsOn: ['backend'],
      },
    ],
  });
}
