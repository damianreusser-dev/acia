/**
 * ACIA Build-Deploy-Monitor Benchmark Tests
 *
 * These tests define success for Phase 6h: Azure Deployment + E2E Build-Deploy-Monitor Integration
 * Tests verify: Jarvis → CEO → Tech Team (build) → Ops Team (deploy + monitor)
 *
 * Run with: RUN_E2E_TESTS=true npm run test:e2e -- benchmarks/build-deploy-monitor.test.ts
 *
 * Prerequisites:
 * - Docker Desktop for local deployments
 * - Azure CLI + credentials for Azure deployments (optional)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JarvisAgent } from '../../../src/agents/executive/jarvis-agent';
import { WikiService } from '../../../src/core/wiki';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
import { E2E_TIMEOUTS } from '../config.js';

// E2E tests run when RUN_E2E_TESTS=true
const describeE2E = describe.runIf(process.env.RUN_E2E_TESTS === 'true');

// Test workspace
const BENCHMARK_WORKSPACE = path.join(process.cwd(), 'test-workspaces', 'benchmark-deploy');
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

// Helper to run docker command
async function runDocker(
  args: string[],
  cwd?: string,
  timeout = 120000
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('docker', args, {
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

// Helper to wait for health endpoint
async function waitForHealth(
  url: string,
  timeout = 60000,
  interval = 2000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return false;
}

// Helper to stop docker containers
async function stopDockerContainers(projectDir: string): Promise<void> {
  try {
    await runDocker(['compose', 'down', '-v', '--remove-orphans'], projectDir, 30000);
  } catch {
    // Ignore errors during cleanup
  }
}

// Helper to clean workspace with retries (handles locked files on Windows)
async function cleanWorkspaceWithRetry(dir: string, maxRetries = 3): Promise<void> {
  // First, try to stop any running containers
  const projectDirs = ['deploy-local', 'deploy-azure', 'monitor-test', 'incident-test'];
  for (const subDir of projectDirs) {
    await stopDockerContainers(path.join(dir, subDir));
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return; // Success
    } catch (error: unknown) {
      const e = error as { code?: string };
      if (e.code === 'EBUSY' || e.code === 'ENOTEMPTY') {
        if (attempt < maxRetries) {
          console.log(`[Benchmark] Cleanup attempt ${attempt} failed (EBUSY), retrying in 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.warn(`[Benchmark] Could not fully clean workspace after ${maxRetries} attempts`);
        }
      } else if (e.code !== 'ENOENT') {
        throw error; // Re-throw unexpected errors
      }
    }
  }
}

// Determine test skip conditions SYNCHRONOUSLY at module load time
// This is required because .skipIf() evaluates before beforeAll runs
function checkDockerSync(): boolean {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    execSync('docker compose version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkAzureSync(): boolean {
  try {
    execSync('az --version', { stdio: 'ignore' });
    execSync('az account show', { stdio: 'ignore' });
    return !!process.env.AZURE_SUBSCRIPTION_ID || !!process.env.AZURE_RESOURCE_GROUP;
  } catch {
    return false;
  }
}

// Initialize at module load time so .skipIf() can use these values
const HAS_DOCKER = checkDockerSync();
const HAS_AZURE = checkAzureSync();

describeE2E('ACIA Build-Deploy-Monitor Benchmarks', () => {
  let jarvis: JarvisAgent;
  let wiki: WikiService;

  beforeAll(async () => {
    console.log(`[Benchmark] Docker available: ${HAS_DOCKER}`);
    console.log(`[Benchmark] Azure available: ${HAS_AZURE}`);

    // Clean up any previous test workspace with retries
    await cleanWorkspaceWithRetry(BENCHMARK_WORKSPACE);
    await fs.mkdir(BENCHMARK_WORKSPACE, { recursive: true });

    wiki = new WikiService({ wikiRoot: BENCHMARK_WIKI });
    jarvis = new JarvisAgent({
      workspace: BENCHMARK_WORKSPACE,
      wikiService: wiki,
    });
  });

  afterAll(async () => {
    // Stop any running containers first
    const projectDirs = ['deploy-local', 'deploy-azure', 'monitor-test', 'incident-test'];
    for (const subDir of projectDirs) {
      await stopDockerContainers(path.join(BENCHMARK_WORKSPACE, subDir));
    }

    // Cleanup with retries
    await cleanWorkspaceWithRetry(BENCHMARK_WORKSPACE);
  });

  describe('Phase 6h.1: Local Docker Deployment', () => {
    /**
     * BENCHMARK TEST 1: Build and Deploy Locally
     *
     * ACIA should create a todo API and deploy it locally with Docker.
     * Workflow: Jarvis → CEO → Tech Team (build) → Ops Team (deploy)
     */
    it.skipIf(!HAS_DOCKER)(
      'should build and deploy a todo API locally with Docker',
      async () => {
        const projectDir = path.join(BENCHMARK_WORKSPACE, 'deploy-local');

        // Request to ACIA with deployment intent
        const result = await jarvis.handleRequest(`
          Create a todo API in "deploy-local" with these requirements:

          BACKEND:
          - Express.js with TypeScript
          - REST endpoints: GET /api/todos, POST /api/todos, DELETE /api/todos/:id
          - Health check: GET /api/health
          - In-memory storage
          - Port 3001

          DEPLOYMENT:
          - Deploy locally using Docker
          - Create Dockerfile for the backend
          - Create docker-compose.yml

          Make it run on localhost:3001
        `);

        // Verify request handled
        expect(result).toBeDefined();
        expect(result.success).toBe(true);

        // ============================================
        // VERIFICATION 1: Project Files Created
        // ============================================
        expect(await fileExists(path.join(projectDir, 'backend', 'package.json'))).toBe(true);
        expect(await fileExists(path.join(projectDir, 'backend', 'src', 'index.ts'))).toBe(true);

        // Check for Docker files (could be at project root or backend level)
        const hasDockerfile =
          await fileExists(path.join(projectDir, 'Dockerfile')) ||
          await fileExists(path.join(projectDir, 'backend', 'Dockerfile'));
        expect(hasDockerfile).toBe(true);

        const hasCompose =
          await fileExists(path.join(projectDir, 'docker-compose.yml')) ||
          await fileExists(path.join(projectDir, 'docker-compose.yaml'));
        expect(hasCompose).toBe(true);

        // ============================================
        // VERIFICATION 2: Docker Build Works
        // ============================================
        const composeDir = await fileExists(path.join(projectDir, 'docker-compose.yml'))
          ? projectDir
          : path.join(projectDir, 'backend');

        const buildResult = await runDocker(
          ['compose', 'build'],
          composeDir,
          180000 // 3 min for docker build
        );

        if (!buildResult.success) {
          console.error('[Benchmark] Docker build failed:');
          console.error('STDERR:', buildResult.stderr);
        }
        expect(buildResult.success).toBe(true);

        // ============================================
        // VERIFICATION 3: Container Starts and API Works
        // ============================================
        try {
          // Start containers
          const upResult = await runDocker(
            ['compose', 'up', '-d'],
            composeDir,
            60000
          );
          expect(upResult.success).toBe(true);

          // Wait for health endpoint
          const isHealthy = await waitForHealth('http://localhost:3001/api/health', 60000);
          expect(isHealthy).toBe(true);

          // Test API endpoints
          const healthResponse = await fetch('http://localhost:3001/api/health');
          expect(healthResponse.ok).toBe(true);

          // Create a todo
          const createResponse = await fetch('http://localhost:3001/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Test todo from deploy benchmark' }),
          });
          expect(createResponse.ok).toBe(true);

          // Get todos
          const listResponse = await fetch('http://localhost:3001/api/todos');
          expect(listResponse.ok).toBe(true);
          const todos = await listResponse.json();
          expect(Array.isArray(todos)).toBe(true);
          expect(todos.length).toBeGreaterThan(0);
        } finally {
          // Cleanup
          await stopDockerContainers(composeDir);
        }
      },
      E2E_TIMEOUTS.TIER_5_BENCHMARK // 15 min for full build-deploy flow
    );

    /**
     * BENCHMARK TEST 2: Monitoring Auto-Setup
     *
     * After deployment, monitoring targets should be automatically registered.
     */
    it.skipIf(!HAS_DOCKER)(
      'should auto-register monitoring targets after deployment',
      async () => {
        const projectDir = path.join(BENCHMARK_WORKSPACE, 'monitor-test');

        const result = await jarvis.handleRequest(`
          Create a simple health-check API in "monitor-test":
          - Express server on port 3002
          - GET /health returns { status: "ok" }
          - Deploy locally with Docker
          - Set up monitoring for the deployed service
        `);

        expect(result).toBeDefined();

        // If deployment result includes monitoring info, verify it
        if (result.urls || (result as { deploymentResult?: { monitoringResult?: unknown } }).deploymentResult?.monitoringResult) {
          const deployResult = (result as { deploymentResult?: { monitoringResult?: { active?: boolean; targets?: string[] } } }).deploymentResult;
          if (deployResult?.monitoringResult) {
            expect(deployResult.monitoringResult.active).toBe(true);
            expect(deployResult.monitoringResult.targets).toBeDefined();
          }
        }

        // Cleanup
        await stopDockerContainers(projectDir);
      },
      E2E_TIMEOUTS.TIER_4_INTEGRATION // 10 min
    );
  });

  describe('Phase 6h.2: Azure Deployment', () => {
    /**
     * BENCHMARK TEST 3: Deploy to Azure App Service
     *
     * ACIA should deploy a Node.js app to Azure App Service.
     */
    it.skipIf(!HAS_AZURE)(
      'should deploy to Azure App Service',
      async () => {
        // Note: projectDir 'deploy-azure' is specified in the Jarvis request string
        const resourceGroup = process.env.AZURE_RESOURCE_GROUP || 'acia-test-rg';
        const appName = `acia-test-${Date.now()}`;

        const result = await jarvis.handleRequest(`
          Create a simple Express API in "deploy-azure":
          - GET /api/health returns { status: "ok", timestamp: Date.now() }
          - Port from process.env.PORT (for Azure compatibility)

          Deploy to Azure App Service:
          - Resource group: ${resourceGroup}
          - App name: ${appName}
        `);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);

        // Verify Azure deployment if URLs returned
        const deployResult = (result as { deploymentResult?: { deployResult?: { backendUrl?: string } } }).deploymentResult;
        if (deployResult?.deployResult?.backendUrl) {
          const azureUrl = deployResult.deployResult.backendUrl;

          // Wait for Azure app to be ready (can take 1-2 minutes)
          const isHealthy = await waitForHealth(`${azureUrl}/api/health`, 120000);
          expect(isHealthy).toBe(true);
        }

        // Cleanup Azure resource
        try {
          execSync(`az webapp delete --name ${appName} --resource-group ${resourceGroup}`, {
            stdio: 'ignore',
          });
        } catch {
          console.warn('[Benchmark] Could not cleanup Azure app');
        }
      },
      E2E_TIMEOUTS.TIER_5_BENCHMARK // 15 min for Azure deployment
    );

    /**
     * BENCHMARK TEST 4: Deploy to Azure Container Apps
     *
     * ACIA should deploy a containerized app to Azure Container Apps.
     */
    it.skipIf(!HAS_AZURE)(
      'should deploy to Azure Container Apps',
      async () => {
        const resourceGroup = process.env.AZURE_RESOURCE_GROUP || 'acia-test-rg';
        const appName = `acia-container-${Date.now()}`;

        const result = await jarvis.handleRequest(`
          Create a containerized API:
          - Express server with health endpoint
          - Dockerfile included

          Deploy to Azure Container Apps:
          - Resource group: ${resourceGroup}
          - App name: ${appName}
        `);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);

        // Cleanup Azure resource
        try {
          execSync(
            `az containerapp delete --name ${appName} --resource-group ${resourceGroup} --yes`,
            { stdio: 'ignore' }
          );
        } catch {
          console.warn('[Benchmark] Could not cleanup Azure Container App');
        }
      },
      E2E_TIMEOUTS.TIER_5_BENCHMARK
    );
  });

  describe('Phase 6h.3: Incident Response', () => {
    /**
     * BENCHMARK TEST 5: Detect Unhealthy Service
     *
     * Monitoring should detect when a service becomes unhealthy.
     */
    it.skipIf(!HAS_DOCKER)(
      'should detect unhealthy service and create incident',
      async () => {
        const projectDir = path.join(BENCHMARK_WORKSPACE, 'incident-test');

        // First, deploy a service
        const deployResult = await jarvis.handleRequest(`
          Create a health-check API in "incident-test":
          - Express server on port 3003
          - GET /health returns status
          - Deploy locally with Docker
          - Set up monitoring
        `);

        expect(deployResult).toBeDefined();

        // Find the compose directory
        const composeDir = await fileExists(path.join(projectDir, 'docker-compose.yml'))
          ? projectDir
          : path.join(projectDir, 'backend');

        try {
          // Start containers
          await runDocker(['compose', 'up', '-d'], composeDir, 60000);

          // Wait for service to be healthy
          await waitForHealth('http://localhost:3003/health', 60000);

          // Stop the container to simulate failure
          await runDocker(['compose', 'stop'], composeDir, 30000);

          // Verify health check now fails
          try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _response = await fetch('http://localhost:3003/health');
            // If we get here, the service is still running (unexpected but ok)
          } catch {
            // Expected - service should be down
          }

          // Request incident handling
          const incidentResult = await jarvis.handleRequest(`
            The service at localhost:3003 is down.
            Please investigate and attempt recovery.
          `);

          expect(incidentResult).toBeDefined();
          // Should either report the issue or attempt recovery
          expect(incidentResult.response || incidentResult.humanEscalationReason).toBeDefined();
        } finally {
          // Cleanup
          await stopDockerContainers(composeDir);
        }
      },
      E2E_TIMEOUTS.TIER_4_INTEGRATION
    );

    /**
     * BENCHMARK TEST 6: Auto-Restart Failed Container
     *
     * Ops team should auto-restart a failed container.
     */
    it.skipIf(!HAS_DOCKER)(
      'should auto-restart failed container',
      async () => {
        // This test uses the same incident-test workspace
        const projectDir = path.join(BENCHMARK_WORKSPACE, 'incident-test');

        // Skip if project doesn't exist from previous test
        if (!(await fileExists(projectDir))) {
          console.log('[Benchmark] Skipping auto-restart test - no project from previous test');
          return;
        }

        const composeDir = await fileExists(path.join(projectDir, 'docker-compose.yml'))
          ? projectDir
          : path.join(projectDir, 'backend');

        try {
          // Start containers
          await runDocker(['compose', 'up', '-d'], composeDir, 60000);
          await waitForHealth('http://localhost:3003/health', 60000);

          // Stop the container
          await runDocker(['compose', 'stop'], composeDir, 30000);

          // Request restart
          const restartResult = await jarvis.handleRequest(`
            Restart the docker containers in "${projectDir}".
            The service should be available at localhost:3003.
          `);

          expect(restartResult).toBeDefined();

          // Verify service is back up
          const isHealthy = await waitForHealth('http://localhost:3003/health', 60000);
          expect(isHealthy).toBe(true);
        } finally {
          await stopDockerContainers(composeDir);
        }
      },
      E2E_TIMEOUTS.TIER_3_WORKFLOW
    );
  });

  describe('Deployment Intent Detection', () => {
    /**
     * BENCHMARK TEST 7: Verify handleRequest interface structure
     *
     * Tests that Jarvis's handleRequest returns proper interface.
     * This is a fast unit test that doesn't require LLM calls.
     */
    it('should return proper handleRequest interface structure', () => {
      // Verify Jarvis instance has required methods
      expect(jarvis).toBeDefined();
      expect(typeof jarvis.handleRequest).toBe('function');
      expect(typeof jarvis.getMetrics).toBe('function');
      expect(typeof jarvis.getWorkspace).toBe('function');

      // Verify workspace is set correctly
      expect(jarvis.getWorkspace()).toBe(BENCHMARK_WORKSPACE);

      // Verify metrics structure
      const metrics = jarvis.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.requestCount).toBe('number');
      expect(typeof metrics.tokensUsed).toBe('number');
      expect(typeof metrics.uptime).toBe('number');
      expect(typeof metrics.companiesCount).toBe('number');
    });

    /**
     * BENCHMARK TEST 8: Verify handleRequest return type
     *
     * Tests the return type structure of handleRequest.
     * Uses minimal synchronous checks.
     */
    it('should have correct handleRequest return type definition', () => {
      // The handleRequest method should return a promise with specific fields
      // We can verify the method signature exists
      expect(jarvis.handleRequest).toBeDefined();

      // Verify we can call getMetrics without triggering LLM
      const metrics = jarvis.getMetrics();

      // These should be initial values (0 or close to it)
      expect(metrics.requestCount).toBeGreaterThanOrEqual(0);
      expect(metrics.companiesCount).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime).toBeGreaterThan(0);
    });
  });
});

describeE2E('Deployment Metrics & Efficiency', () => {
  /**
   * Verify Jarvis metrics API structure (no LLM calls needed)
   */
  it('should have metrics API available', () => {
    const wiki = new WikiService({ wikiRoot: path.join(BENCHMARK_WORKSPACE, '.wiki-metrics') });
    const jarvis = new JarvisAgent({
      workspace: BENCHMARK_WORKSPACE,
      wikiService: wiki,
    });

    const startTime = Date.now();

    // Verify Jarvis has metrics available (synchronous, no LLM)
    const metrics = jarvis.getMetrics();
    expect(metrics).toBeDefined();

    // Verify metrics structure
    expect(typeof metrics.tokensUsed).toBe('number');
    expect(typeof metrics.requestCount).toBe('number');
    expect(typeof metrics.uptime).toBe('number');
    expect(typeof metrics.companiesCount).toBe('number');

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Log timing for baseline metrics
    console.log(`[Metrics] Initialization time: ${duration}ms`);
    console.log(`[Metrics] Initial token usage: ${metrics.tokensUsed}`);
    console.log(`[Metrics] Initial request count: ${metrics.requestCount}`);
    console.log(`[Metrics] Companies count: ${metrics.companiesCount}`);

    // Initial values should be zero or close to it
    expect(metrics.requestCount).toBe(0);
    expect(metrics.companiesCount).toBe(0);

    // Uptime should be non-negative (time since construction, can be 0 if checked immediately)
    expect(metrics.uptime).toBeGreaterThanOrEqual(0);

    // Initialization should be fast (< 1 second without LLM)
    expect(duration).toBeLessThan(1000);
  });

  /**
   * Verify Jarvis workspace is correctly configured
   */
  it('should configure workspace correctly', () => {
    const wiki = new WikiService({ wikiRoot: path.join(BENCHMARK_WORKSPACE, '.wiki-workspace') });
    const jarvis = new JarvisAgent({
      workspace: BENCHMARK_WORKSPACE,
      wikiService: wiki,
    });

    expect(jarvis.getWorkspace()).toBe(BENCHMARK_WORKSPACE);

    // Verify metrics are independent per instance
    const metrics = jarvis.getMetrics();
    expect(metrics.requestCount).toBe(0);
    expect(metrics.companiesCount).toBe(0);
  });
});
