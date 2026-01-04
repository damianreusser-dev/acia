/**
 * Docker Templates Unit Tests
 *
 * Tests for Docker template generation functions.
 */

import { describe, it, expect } from 'vitest';
import {
  createNodeDockerfile,
  createNodeDockerfileWithBuild,
  createDockerignore,
  createDockerCompose,
  createSingleServiceCompose,
  createFullstackCompose,
} from '../../src/templates/docker';
import type {
  DockerTemplateOptions,
  ComposeTemplateOptions,
} from '../../src/templates/docker';

describe('Docker Templates', () => {
  describe('createNodeDockerfile', () => {
    const defaultOptions: DockerTemplateOptions = {
      projectName: 'test-app',
      port: 3001,
      healthPath: '/api/health',
      entryPoint: 'dist/index.js',
    };

    it('should include FROM instruction with default base image', () => {
      const dockerfile = createNodeDockerfile(defaultOptions);
      expect(dockerfile).toContain('FROM node:20-alpine');
    });

    it('should use custom base image when provided', () => {
      const dockerfile = createNodeDockerfile({
        ...defaultOptions,
        baseImage: 'node:18-alpine',
      });
      expect(dockerfile).toContain('FROM node:18-alpine');
    });

    it('should include WORKDIR instruction', () => {
      const dockerfile = createNodeDockerfile(defaultOptions);
      expect(dockerfile).toContain('WORKDIR /usr/src/app');
    });

    it('should copy package files before source', () => {
      const dockerfile = createNodeDockerfile(defaultOptions);
      const packageCopyIndex = dockerfile.indexOf('COPY package*.json');
      const distCopyIndex = dockerfile.indexOf('COPY dist/');
      expect(packageCopyIndex).toBeLessThan(distCopyIndex);
    });

    it('should include npm ci for production dependencies', () => {
      const dockerfile = createNodeDockerfile(defaultOptions);
      expect(dockerfile).toContain('npm ci --only=production');
    });

    it('should include EXPOSE instruction with correct port', () => {
      const dockerfile = createNodeDockerfile(defaultOptions);
      expect(dockerfile).toContain('EXPOSE 3001');
    });

    it('should include HEALTHCHECK instruction', () => {
      const dockerfile = createNodeDockerfile(defaultOptions);
      expect(dockerfile).toContain('HEALTHCHECK');
      expect(dockerfile).toContain('http://localhost:3001/api/health');
    });

    it('should include CMD instruction with correct entry point', () => {
      const dockerfile = createNodeDockerfile(defaultOptions);
      expect(dockerfile).toContain('CMD ["node", "dist/index.js"]');
    });

    it('should use custom health path', () => {
      const dockerfile = createNodeDockerfile({
        ...defaultOptions,
        healthPath: '/health',
      });
      expect(dockerfile).toContain('http://localhost:3001/health');
    });

    it('should use custom entry point', () => {
      const dockerfile = createNodeDockerfile({
        ...defaultOptions,
        entryPoint: 'dist/server.js',
      });
      expect(dockerfile).toContain('CMD ["node", "dist/server.js"]');
    });
  });

  describe('createNodeDockerfileWithBuild', () => {
    const defaultOptions: DockerTemplateOptions = {
      projectName: 'test-app',
      port: 3001,
      healthPath: '/api/health',
      entryPoint: 'dist/index.js',
    };

    it('should include multi-stage build with builder stage', () => {
      const dockerfile = createNodeDockerfileWithBuild(defaultOptions);
      expect(dockerfile).toContain('FROM node:20-alpine AS builder');
    });

    it('should include npm run build in builder stage', () => {
      const dockerfile = createNodeDockerfileWithBuild(defaultOptions);
      expect(dockerfile).toContain('RUN npm run build');
    });

    it('should copy from builder stage in production', () => {
      const dockerfile = createNodeDockerfileWithBuild(defaultOptions);
      expect(dockerfile).toContain('COPY --from=builder');
    });

    it('should include HEALTHCHECK in final stage', () => {
      const dockerfile = createNodeDockerfileWithBuild(defaultOptions);
      expect(dockerfile).toContain('HEALTHCHECK');
    });
  });

  describe('createDockerignore', () => {
    it('should exclude node_modules', () => {
      const dockerignore = createDockerignore();
      expect(dockerignore).toContain('node_modules');
    });

    it('should exclude .git directory', () => {
      const dockerignore = createDockerignore();
      expect(dockerignore).toContain('.git');
    });

    it('should exclude .env files', () => {
      const dockerignore = createDockerignore();
      expect(dockerignore).toContain('.env');
    });

    it('should exclude tests directory', () => {
      const dockerignore = createDockerignore();
      expect(dockerignore).toContain('tests/');
    });

    it('should exclude coverage directory', () => {
      const dockerignore = createDockerignore();
      expect(dockerignore).toContain('coverage/');
    });
  });
});

describe('Docker Compose Templates', () => {
  describe('createDockerCompose', () => {
    it('should include version header', () => {
      const compose = createDockerCompose({
        projectName: 'test',
        services: [{ name: 'backend', buildContext: '.', port: 3001 }],
      });
      expect(compose).toContain('version: "3.8"');
    });

    it('should include services section', () => {
      const compose = createDockerCompose({
        projectName: 'test',
        services: [{ name: 'backend', buildContext: '.', port: 3001 }],
      });
      expect(compose).toContain('services:');
    });

    it('should create service with correct name', () => {
      const compose = createDockerCompose({
        projectName: 'test',
        services: [{ name: 'api', buildContext: './api', port: 8080 }],
      });
      expect(compose).toContain('api:');
    });

    it('should include build context', () => {
      const compose = createDockerCompose({
        projectName: 'test',
        services: [{ name: 'backend', buildContext: './backend', port: 3001 }],
      });
      expect(compose).toContain('context: ./backend');
    });

    it('should include correct port mapping', () => {
      const compose = createDockerCompose({
        projectName: 'test',
        services: [{ name: 'backend', buildContext: '.', port: 3001 }],
      });
      expect(compose).toContain('"3001:3001"');
    });

    it('should include healthcheck configuration', () => {
      const compose = createDockerCompose({
        projectName: 'test',
        services: [{ name: 'backend', buildContext: '.', port: 3001 }],
      });
      expect(compose).toContain('healthcheck:');
      expect(compose).toContain('test: ["CMD", "curl"');
    });

    it('should include restart policy', () => {
      const compose = createDockerCompose({
        projectName: 'test',
        services: [{ name: 'backend', buildContext: '.', port: 3001 }],
      });
      expect(compose).toContain('restart: unless-stopped');
    });

    it('should use custom health path', () => {
      const compose = createDockerCompose({
        projectName: 'test',
        services: [
          { name: 'backend', buildContext: '.', port: 3001, healthPath: '/health' },
        ],
      });
      expect(compose).toContain('http://localhost:3001/health');
    });

    it('should NOT include volume mounts to /usr/src/app', () => {
      const compose = createDockerCompose({
        projectName: 'test',
        services: [{ name: 'backend', buildContext: '.', port: 3001 }],
      });
      // This is critical - volume mounts that overwrite container files cause failures
      expect(compose).not.toContain('volumes:');
      expect(compose).not.toContain('/usr/src/app');
    });

    it('should include depends_on with service_healthy condition', () => {
      const compose = createDockerCompose({
        projectName: 'test',
        services: [
          { name: 'backend', buildContext: './backend', port: 3001 },
          {
            name: 'frontend',
            buildContext: './frontend',
            port: 3000,
            dependsOn: ['backend'],
          },
        ],
      });
      expect(compose).toContain('depends_on:');
      expect(compose).toContain('condition: service_healthy');
    });
  });

  describe('createSingleServiceCompose', () => {
    it('should create compose for single backend service', () => {
      const compose = createSingleServiceCompose('myapp', 3001);
      expect(compose).toContain('backend:');
      expect(compose).toContain('"3001:3001"');
    });

    it('should use default health path', () => {
      const compose = createSingleServiceCompose('myapp', 3001);
      expect(compose).toContain('/api/health');
    });

    it('should use custom health path', () => {
      const compose = createSingleServiceCompose('myapp', 3001, '/healthz');
      expect(compose).toContain('/healthz');
    });
  });

  describe('createFullstackCompose', () => {
    it('should create both backend and frontend services', () => {
      const compose = createFullstackCompose('myapp');
      expect(compose).toContain('backend:');
      expect(compose).toContain('frontend:');
    });

    it('should use default ports (3001 for backend, 3000 for frontend)', () => {
      const compose = createFullstackCompose('myapp');
      expect(compose).toContain('"3001:3001"');
      expect(compose).toContain('"3000:3000"');
    });

    it('should use custom ports', () => {
      const compose = createFullstackCompose('myapp', 8080, 80);
      expect(compose).toContain('"8080:8080"');
      expect(compose).toContain('"80:80"');
    });

    it('should have frontend depend on backend', () => {
      const compose = createFullstackCompose('myapp');
      expect(compose).toContain('depends_on:');
      expect(compose).toContain('backend:');
      expect(compose).toContain('condition: service_healthy');
    });

    it('should use correct build contexts', () => {
      const compose = createFullstackCompose('myapp');
      expect(compose).toContain('context: ./backend');
      expect(compose).toContain('context: ./frontend');
    });
  });
});

describe('Docker Template Integration', () => {
  it('should generate valid Dockerfile and compose pair', () => {
    const options: DockerTemplateOptions = {
      projectName: 'todo-api',
      port: 3001,
      healthPath: '/api/health',
      entryPoint: 'dist/index.js',
    };

    const dockerfile = createNodeDockerfile(options);
    const compose = createSingleServiceCompose(options.projectName, options.port);

    // Both should have consistent port
    expect(dockerfile).toContain('EXPOSE 3001');
    expect(compose).toContain('"3001:3001"');

    // Both should have consistent health path
    expect(dockerfile).toContain('/api/health');
    expect(compose).toContain('/api/health');
  });

  it('should generate production-ready configuration', () => {
    const dockerfile = createNodeDockerfile({
      projectName: 'prod-app',
      port: 3001,
      healthPath: '/api/health',
      entryPoint: 'dist/index.js',
    });
    const compose = createSingleServiceCompose('prod-app', 3001);

    // Dockerfile should use production dependencies
    expect(dockerfile).toContain('--only=production');

    // Compose should have restart policy
    expect(compose).toContain('restart: unless-stopped');

    // Both should have health checks
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(compose).toContain('healthcheck:');
  });
});
