/**
 * Docker Template
 *
 * Generates Dockerfiles for Node.js applications.
 */

import type { DockerTemplateOptions } from './types.js';

/**
 * Create a production-ready Dockerfile for a Node.js API
 *
 * Features:
 * - Uses Alpine for small image size
 * - Multi-stage build (copies only dist)
 * - Health check included
 * - Production-only dependencies
 */
export function createNodeDockerfile(options: DockerTemplateOptions): string {
  const baseImage = options.baseImage || 'node:20-alpine';

  return `FROM ${baseImage}

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/

# Expose port
EXPOSE ${options.port}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
  CMD curl -f http://localhost:${options.port}${options.healthPath} || exit 1

# Start the server
CMD ["node", "${options.entryPoint}"]
`;
}

/**
 * Create a multi-stage Dockerfile that includes the build step
 *
 * Use this when deploying from source (no pre-built dist folder)
 */
export function createNodeDockerfileWithBuild(options: DockerTemplateOptions): string {
  const baseImage = options.baseImage || 'node:20-alpine';

  return `FROM ${baseImage} AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM ${baseImage}

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /usr/src/app/dist ./dist

# Expose port
EXPOSE ${options.port}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
  CMD curl -f http://localhost:${options.port}${options.healthPath} || exit 1

# Start the server
CMD ["node", "${options.entryPoint}"]
`;
}

/**
 * Create a standard .dockerignore file
 */
export function createDockerignore(): string {
  return `# Dependencies
node_modules
npm-debug.log

# Version control
.git
.gitignore

# Environment files
.env
.env.*
!.env.example

# Documentation
*.md
docs/

# Tests
tests/
coverage/
.nyc_output/

# IDE
.vscode/
.idea/

# Build artifacts (we copy dist separately)
# dist/

# Misc
*.log
.DS_Store
`;
}
