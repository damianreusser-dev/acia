/**
 * ACIA Fullstack Capability Benchmark Tests
 *
 * These tests define success for Phase 5: Fullstack Capability
 * They will initially FAIL and serve as our benchmark to work towards.
 *
 * Run with: RUN_E2E_TESTS=true npm run test:e2e -- benchmarks/fullstack-capability.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JarvisAgent } from '../../../src/agents/executive/jarvis-agent';
import { WikiService } from '../../../src/core/wiki';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

// E2E tests run when RUN_E2E_TESTS=true
// API key is loaded from .env by tests/setup.ts
const describeE2E = describe.runIf(process.env.RUN_E2E_TESTS === 'true');

// Test workspace
const BENCHMARK_WORKSPACE = path.join(process.cwd(), 'test-workspaces', 'benchmark-fullstack');
const BENCHMARK_WIKI = path.join(BENCHMARK_WORKSPACE, '.wiki');

// Helper to check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Helper to read file safely
async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// Helper to run npm command in directory
async function runNpm(
  cwd: string,
  args: string[],
  timeout = 120000
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('npm', args, {
      cwd,
      shell: true,
      timeout,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => (stdout += data.toString()));
    proc.stderr?.on('data', (data) => (stderr += data.toString()));

    proc.on('close', (code) => {
      resolve({ success: code === 0, stdout, stderr });
    });

    proc.on('error', (err) => {
      resolve({ success: false, stdout, stderr: err.message });
    });
  });
}

// Helper to start server and wait for it
async function startServer(
  cwd: string,
  command: string,
  port: number,
  timeout = 30000
): Promise<{ process: ChildProcess; url: string } | null> {
  return new Promise((resolve) => {
    const proc = spawn('npm', ['run', command], {
      cwd,
      shell: true,
      detached: false,
    });

    const timeoutId = setTimeout(() => {
      proc.kill();
      resolve(null);
    }, timeout);

    // Wait for server to be ready
    const checkServer = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:${port}/api/health`);
        if (response.ok) {
          clearInterval(checkServer);
          clearTimeout(timeoutId);
          resolve({ process: proc, url: `http://localhost:${port}` });
        }
      } catch {
        // Server not ready yet
      }
    }, 1000);

    proc.on('error', () => {
      clearInterval(checkServer);
      clearTimeout(timeoutId);
      resolve(null);
    });
  });
}

describeE2E('ACIA Fullstack Capability Benchmarks', () => {
  let jarvis: JarvisAgent;
  let wiki: WikiService;

  beforeAll(async () => {
    // Clean up any previous test workspace
    await fs.rm(BENCHMARK_WORKSPACE, { recursive: true, force: true });
    await fs.mkdir(BENCHMARK_WORKSPACE, { recursive: true });

    wiki = new WikiService({ wikiRoot: BENCHMARK_WIKI });
    jarvis = new JarvisAgent({
      workspace: BENCHMARK_WORKSPACE,
      wikiService: wiki,
    });
  });

  afterAll(async () => {
    // Cleanup
    await fs.rm(BENCHMARK_WORKSPACE, { recursive: true, force: true });
  });

  describe('Phase 5a: Simple Fullstack Application', () => {
    /**
     * BENCHMARK TEST 1: Todo Application
     *
     * This is the primary benchmark for Phase 5.
     * ACIA should be able to create a complete, working todo application.
     */
    it(
      'should create a complete todo application from a single prompt',
      async () => {
        const projectDir = path.join(BENCHMARK_WORKSPACE, 'todo-app');

        // The request to ACIA
        const result = await jarvis.handleRequest(`
        Create a fullstack todo application in the directory "todo-app" with:

        BACKEND (Node.js + Express):
        - REST API with endpoints: GET /api/todos, POST /api/todos, PUT /api/todos/:id, DELETE /api/todos/:id
        - In-memory storage (array) for todos
        - Todo model: { id: string, title: string, completed: boolean, createdAt: Date }
        - Input validation
        - Error handling with proper HTTP status codes
        - Health check endpoint: GET /api/health
        - CORS enabled for localhost:3000
        - Server runs on port 3001

        FRONTEND (React + TypeScript):
        - Vite as build tool
        - Components: TodoList, TodoItem, AddTodo
        - Fetch todos from backend API
        - Add new todos
        - Toggle todo completion
        - Delete todos
        - Loading and error states
        - Runs on port 3000

        REQUIREMENTS:
        - TypeScript for both frontend and backend
        - package.json with all dependencies
        - npm scripts: "dev" for development, "build" for production, "test" for tests
        - At least 3 unit tests for backend API
        - README.md with setup instructions

        Create all files needed for a working application.
      `);

        // Verify the request was handled
        expect(result).toBeDefined();
        expect(result.status).not.toBe('failed');

        // ============================================
        // VERIFICATION 1: Project Structure Exists
        // ============================================

        // Backend files
        expect(await fileExists(path.join(projectDir, 'backend', 'package.json'))).toBe(true);
        expect(await fileExists(path.join(projectDir, 'backend', 'tsconfig.json'))).toBe(true);
        expect(await fileExists(path.join(projectDir, 'backend', 'src', 'index.ts'))).toBe(true);

        // Frontend files
        expect(await fileExists(path.join(projectDir, 'frontend', 'package.json'))).toBe(true);
        expect(await fileExists(path.join(projectDir, 'frontend', 'tsconfig.json'))).toBe(true);
        expect(await fileExists(path.join(projectDir, 'frontend', 'src', 'App.tsx'))).toBe(true);

        // README
        expect(await fileExists(path.join(projectDir, 'README.md'))).toBe(true);

        // ============================================
        // VERIFICATION 2: Backend Code Quality
        // ============================================

        // Install backend dependencies
        const backendInstall = await runNpm(path.join(projectDir, 'backend'), ['install']);
        expect(backendInstall.success).toBe(true);

        // TypeScript compiles without errors
        const backendTypecheck = await runNpm(path.join(projectDir, 'backend'), ['run', 'typecheck']);
        expect(backendTypecheck.success).toBe(true);

        // Tests pass
        const backendTests = await runNpm(path.join(projectDir, 'backend'), ['test']);
        expect(backendTests.success).toBe(true);
        expect(backendTests.stdout).toContain('passed'); // vitest outputs "X passed"

        // ============================================
        // VERIFICATION 3: Frontend Code Quality
        // ============================================

        // Install frontend dependencies
        const frontendInstall = await runNpm(path.join(projectDir, 'frontend'), ['install']);
        expect(frontendInstall.success).toBe(true);

        // TypeScript compiles without errors
        const frontendTypecheck = await runNpm(path.join(projectDir, 'frontend'), ['run', 'typecheck']);
        expect(frontendTypecheck.success).toBe(true);

        // Build succeeds
        const frontendBuild = await runNpm(path.join(projectDir, 'frontend'), ['run', 'build']);
        expect(frontendBuild.success).toBe(true);

        // ============================================
        // VERIFICATION 4: Backend API Works
        // ============================================

        // Start backend server
        const backend = await startServer(path.join(projectDir, 'backend'), 'dev', 3001);
        expect(backend).not.toBeNull();

        try {
          // Health check
          const healthResponse = await fetch(`${backend!.url}/api/health`);
          expect(healthResponse.ok).toBe(true);

          // Create a todo
          const createResponse = await fetch(`${backend!.url}/api/todos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Test todo from benchmark' }),
          });
          expect(createResponse.ok).toBe(true);
          const createdTodo = await createResponse.json();
          expect(createdTodo.id).toBeDefined();
          expect(createdTodo.title).toBe('Test todo from benchmark');
          expect(createdTodo.completed).toBe(false);

          // Get all todos
          const listResponse = await fetch(`${backend!.url}/api/todos`);
          expect(listResponse.ok).toBe(true);
          const todos = await listResponse.json();
          expect(Array.isArray(todos)).toBe(true);
          expect(todos.length).toBeGreaterThan(0);

          // Update todo
          const updateResponse = await fetch(`${backend!.url}/api/todos/${createdTodo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true }),
          });
          expect(updateResponse.ok).toBe(true);
          const updatedTodo = await updateResponse.json();
          expect(updatedTodo.completed).toBe(true);

          // Delete todo
          const deleteResponse = await fetch(`${backend!.url}/api/todos/${createdTodo.id}`, {
            method: 'DELETE',
          });
          expect(deleteResponse.ok).toBe(true);

          // Verify deleted
          const verifyResponse = await fetch(`${backend!.url}/api/todos`);
          const remainingTodos = await verifyResponse.json();
          expect(remainingTodos.find((t: { id: string }) => t.id === createdTodo.id)).toBeUndefined();
        } finally {
          // Clean up server
          backend!.process.kill();
        }
      },
      600000 // 10 minute timeout
    );

    /**
     * BENCHMARK TEST 2: Code Quality Metrics
     *
     * The generated code should meet quality standards.
     */
    it('should generate code that meets quality standards', async () => {
      const projectDir = path.join(BENCHMARK_WORKSPACE, 'todo-app');

      // Backend code should have proper structure
      const backendIndex = await readFileSafe(path.join(projectDir, 'backend', 'src', 'index.ts'));
      expect(backendIndex).not.toBeNull();

      // Check for Express in either index.ts or app.ts/app.js (modular structure is acceptable)
      const backendApp = await readFileSafe(path.join(projectDir, 'backend', 'src', 'app.ts')) ??
                         await readFileSafe(path.join(projectDir, 'backend', 'src', 'app.js'));
      const backendCode = `${backendIndex ?? ''}\n${backendApp ?? ''}`;

      // Should have Express app setup (in either file)
      expect(backendCode).toContain('express');

      // Should have proper error handling (in either file)
      expect(backendCode).toMatch(/catch|error|Error/i);

      // Should have CORS (in either file)
      expect(backendCode).toContain('cors');

      // Frontend should have React components
      const appComponent = await readFileSafe(path.join(projectDir, 'frontend', 'src', 'App.tsx'));
      expect(appComponent).not.toBeNull();
      expect(appComponent).toContain('useState');
      expect(appComponent).toContain('useEffect');

      // Should have proper TypeScript types (no 'any' without reason)
      const anyCount = (backendCode?.match(/: any/g) || []).length;
      expect(anyCount).toBeLessThan(5); // Allow minimal 'any' usage across all files
    });

    /**
     * BENCHMARK TEST 3: Documentation Quality
     *
     * Generated projects should have proper documentation.
     */
    it('should include proper documentation', async () => {
      const projectDir = path.join(BENCHMARK_WORKSPACE, 'todo-app');

      const readme = await readFileSafe(path.join(projectDir, 'README.md'));
      expect(readme).not.toBeNull();

      // README should have key sections
      expect(readme).toMatch(/install|setup|getting started/i);
      expect(readme).toMatch(/run|start|development/i);
      expect(readme).toMatch(/api|endpoint/i);
    });
  });

  describe('Phase 5b: Error Handling & Recovery', () => {
    /**
     * BENCHMARK TEST 4: Handle Ambiguous Requirements
     *
     * ACIA should ask clarifying questions or make reasonable defaults.
     */
    it('should handle ambiguous requirements gracefully', async () => {
      const result = await jarvis.handleRequest(`
        Build me an app
      `);

      // Should either:
      // 1. Ask clarifying questions
      // 2. Make reasonable assumptions and document them

      expect(result).toBeDefined();
      // Should not crash or return empty
      expect(result.status).not.toBe('failed');

      // Should communicate back what it understood or needs
      expect(result.response || result.escalation).toBeDefined();
    }, 60000); // 1 minute timeout for LLM call

    /**
     * BENCHMARK TEST 5: Recover from Errors
     *
     * When code doesn't compile, ACIA should fix it.
     */
    it('should recover when initial implementation has errors', async () => {
      const projectDir = path.join(BENCHMARK_WORKSPACE, 'recovery-test');

      const result = await jarvis.handleRequest(`
        Create a simple Node.js project in "recovery-test" with:
        - A function that calculates factorial
        - Unit tests for the function
        - The tests must pass

        Make sure to handle edge cases (0, negative numbers).
      `);

      expect(result).toBeDefined();

      // Tests should pass (ACIA should have iterated until they do)
      const testResult = await runNpm(projectDir, ['test']);
      expect(testResult.success).toBe(true);
    }, 300000);
  });

  describe('Phase 5c: Efficiency Metrics', () => {
    /**
     * BENCHMARK TEST 6: Token Efficiency
     *
     * Track token usage to establish baseline for optimization.
     */
    it('should track token usage for optimization baseline', async () => {
      // This test establishes metrics, doesn't assert strict limits yet
      const metricsStart = jarvis.getMetrics?.() || { tokensUsed: 0 };

      await jarvis.handleRequest(`
        Create a simple "hello world" Express server in "hello-server"
        with a single GET / endpoint that returns { message: "Hello, World!" }
      `);

      const metricsEnd = jarvis.getMetrics?.() || { tokensUsed: 0 };
      const tokensUsed = metricsEnd.tokensUsed - metricsStart.tokensUsed;

      // Log for baseline (we'll tighten this in later phases)
      console.log(`Tokens used for hello-world server: ${tokensUsed}`);

      // Sanity check - shouldn't use millions of tokens for hello world
      // Note: Limit is higher to account for multi-layer orchestration (Jarvis → CEO → Team)
      // and potential rate limit retries. Will be optimized in Phase 8.
      expect(tokensUsed).toBeLessThan(300000);
    }, 180000);
  });
});

describeE2E('Phase 6: Production Quality Benchmarks', () => {
  // These tests will be implemented as we progress

  it.skip('should create REST API with authentication', async () => {
    // TODO: Phase 6 benchmark
  });

  it.skip('should generate OpenAPI documentation', async () => {
    // TODO: Phase 6 benchmark
  });

  it.skip('should create Docker deployment', async () => {
    // TODO: Phase 6 benchmark
  });

  it.skip('should achieve 80%+ test coverage', async () => {
    // TODO: Phase 6 benchmark
  });
});

describeE2E('Phase 7: Self-Improvement Benchmarks', () => {
  it.skip('should add a new tool to itself', async () => {
    // TODO: Phase 7 benchmark
  });

  it.skip('should fix a bug in its own code', async () => {
    // TODO: Phase 7 benchmark
  });
});

describeE2E('Phase 8: Learning Benchmarks', () => {
  it.skip('should build similar projects faster over time', async () => {
    // TODO: Phase 8 benchmark
  });

  it.skip('should reuse patterns from previous projects', async () => {
    // TODO: Phase 8 benchmark
  });
});
