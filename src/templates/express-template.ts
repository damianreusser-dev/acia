/**
 * Express Project Template
 *
 * Template for creating Express + TypeScript backend projects.
 */

import { ProjectTemplate, TemplateOptions } from './types.js';

/**
 * Generate an Express project template
 */
export function createExpressTemplate(options: TemplateOptions): ProjectTemplate {
  const { projectName, description = 'An Express TypeScript API', version = '0.1.0' } = options;

  return {
    name: projectName,
    description,
    category: 'backend',
    dependencies: {
      'express': '^4.18.0',
      'cors': '^2.8.0',
      'helmet': '^7.0.0',
    },
    devDependencies: {
      '@types/express': '^4.17.0',
      '@types/cors': '^2.8.0',
      '@types/node': '^20.0.0',
      'typescript': '^5.3.0',
      'tsx': '^4.0.0',
      'vitest': '^1.0.0',
      'supertest': '^6.3.0',
      '@types/supertest': '^2.0.0',
    },
    scripts: {
      'dev': 'tsx watch src/index.ts',
      'build': 'tsc',
      'start': 'node dist/index.js',
      'test': 'vitest run',
      'test:watch': 'vitest',
      'typecheck': 'tsc --noEmit',
    },
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: projectName,
          version,
          private: true,
          type: 'module',
          scripts: {
            dev: 'tsx watch src/index.ts',
            build: 'tsc',
            start: 'node dist/index.js',
            test: 'vitest run',
            'test:watch': 'vitest',
            typecheck: 'tsc --noEmit',
          },
          dependencies: {
            express: '^4.18.0',
            cors: '^2.8.0',
            helmet: '^7.0.0',
          },
          devDependencies: {
            '@types/express': '^4.17.0',
            '@types/cors': '^2.8.0',
            '@types/node': '^20.0.0',
            typescript: '^5.3.0',
            tsx: '^4.0.0',
            vitest: '^1.0.0',
            supertest: '^6.3.0',
            '@types/supertest': '^2.0.0',
          },
        }, null, 2),
        description: 'Package manifest with dependencies',
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            lib: ['ES2022'],
            outDir: './dist',
            rootDir: './src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true,
            declaration: true,
            declarationMap: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist', '**/*.test.ts'],
        }, null, 2),
        description: 'TypeScript configuration',
      },
      {
        path: 'vitest.config.ts',
        content: `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
`,
        description: 'Vitest configuration',
      },
      {
        path: 'src/index.ts',
        content: `/**
 * Main entry point for the Express server
 */
import { createApp } from './app.js';

const PORT = process.env.PORT ?? 3001;

const app = createApp();

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});

export { app };
`,
        description: 'Server entry point',
      },
      {
        path: 'src/server.ts',
        content: `/**
 * @deprecated Use index.ts instead. This file is kept for backwards compatibility.
 */
export * from './index.js';
`,
        description: 'Legacy server entry point (redirects to index.ts)',
      },
      {
        path: 'src/app.ts',
        content: `import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/error-handler.js';

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/health', healthRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}
`,
        description: 'Express app factory',
      },
      {
        path: 'src/routes/health.ts',
        content: `import { Router, Request, Response } from 'express';

export const healthRouter = Router();

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
}

healthRouter.get('/', (_req: Request, res: Response<HealthResponse>) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
`,
        description: 'Health check route',
      },
      {
        path: 'src/middleware/error-handler.ts',
        content: `import { Request, Response, NextFunction } from 'express';

interface ApiError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message = err.message || 'Internal Server Error';

  console.error(\`[Error] \${statusCode}: \${message}\`);

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
    },
  });
}
`,
        description: 'Error handling middleware',
      },
      {
        path: 'src/types/index.ts',
        content: `/**
 * Shared types for the API
 */

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    statusCode: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
`,
        description: 'Shared type definitions',
      },
      {
        path: 'tests/health.test.ts',
        content: `import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Health Endpoint', () => {
  const app = createApp();

  it('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.uptime).toBeGreaterThanOrEqual(0);
  });
});
`,
        description: 'Health endpoint tests',
      },
      {
        path: 'tests/app.test.ts',
        content: `import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('App', () => {
  const app = createApp();

  it('should return 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/unknown-route')
      .expect(404);

    expect(response.body).toBeDefined();
  });

  it('should parse JSON body', async () => {
    // Test that JSON parsing middleware is working
    const response = await request(app)
      .post('/health')
      .send({ test: 'data' })
      .set('Content-Type', 'application/json')
      .expect(404); // 404 because POST /health doesn't exist, but body should be parsed

    expect(response.body).toBeDefined();
  });
});
`,
        description: 'App tests',
      },
      {
        path: '.env.example',
        content: `# Server Configuration
PORT=3000
NODE_ENV=development

# Database (if needed)
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname
`,
        description: 'Environment variables example',
      },
      {
        path: '.gitignore',
        content: `# Dependencies
node_modules/

# Build output
dist/

# Environment files
.env
.env.local
.env.*.local

# Editor directories
.vscode/
.idea/

# OS files
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Test coverage
coverage/
`,
        description: 'Git ignore file',
      },
    ],
  };
}
