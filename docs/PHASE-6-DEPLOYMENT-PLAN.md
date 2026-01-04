# Phase 6: Deployment Capability Plan

**Goal**: Enable ACIA to reliably build a fullstack app, deploy it locally (Docker), and monitor it.

**Success Criteria**: User says "Create todo app and deploy locally" → gets working http://localhost:3001 URL

---

## Root Cause Analysis from E2E Testing

### What Went Wrong

| Issue | Root Cause | Evidence |
|-------|------------|----------|
| **Missing Dockerfile** | DevOpsAgent wrote compose.yml but not Dockerfile | Manual creation was needed |
| **Missing todos routes** | BackendDevAgent scaffolded app but didn't implement endpoints | Routes file didn't exist |
| **Container crash** | compose.yml had volume mount overwriting built `/dist` folder | `Cannot find module '/usr/src/app/dist/index.js'` |
| **15-min timeout** | Full agent hierarchy (Jarvis→CEO→PM→Dev→QA→DevOps) takes too long | Test timed out in QA phase |
| **Test skip bug** | `.skipIf(HAS_DOCKER)` evaluated at module load, not in `beforeAll` | Fixed with sync checks |

### Why Agents Failed

1. **No verification loop**: Agents create files but don't verify they work before moving on
2. **Poor context passing**: DevOps doesn't know what Backend created, so can't create correct Dockerfile
3. **Template gaps**: No Docker templates in the template system
4. **Single-shot mindset**: Agents try once and move on, even if incomplete

---

## Diagnostic Test Strategy (Like Phase 5)

Create hierarchical diagnostic tests that isolate each failure point.

### Deployment Diagnostic Tests (D1-D6)

```
D1: File Structure → D2: npm install → D3: TypeScript → D4: Unit Tests
                                                               ↓
                    D6: Health Check ← D5: Docker Build ← Dockerfile exists
```

| Level | Test | What It Verifies |
|-------|------|-----------------|
| D1 | File structure | Backend has: package.json, tsconfig.json, src/index.ts |
| D2 | Dependencies | `npm install` succeeds |
| D3 | Type safety | `npm run typecheck` succeeds |
| D4 | Unit tests | `npm test` passes |
| D5 | Docker build | `docker build` succeeds |
| D6 | Health check | `curl http://localhost:3001/api/health` returns 200 |

---

## Phase 6 Subphases

### Phase 6a: Diagnostic Infrastructure (FIRST)

**Files**: `tests/unit/deployment-diagnostics.test.ts`

Create fast unit tests that verify each component works in isolation:

```typescript
describe('Deployment Diagnostics', () => {
  describe('D1: DevOpsAgent Dockerfile Creation', () => {
    it('should create valid Dockerfile from package.json analysis');
    it('should include health check in Dockerfile');
    it('should use correct base image for TypeScript project');
  });

  describe('D2: DevOpsAgent docker-compose.yml Creation', () => {
    it('should NOT include volume mounts that overwrite dist/');
    it('should include health checks for services');
    it('should expose correct ports');
  });

  describe('D3: BackendDevAgent Route Creation', () => {
    it('should create route file AND update app.ts imports');
    it('should verify routes are accessible');
  });

  describe('D4: Agent Context Passing', () => {
    it('DevOpsAgent should receive list of files created by BackendDevAgent');
    it('DevOpsAgent should know the entry point from package.json');
  });
});
```

### Phase 6b: Docker Template System

**Files**: `src/templates/docker/`

Add Docker templates to the existing template system:

```
src/templates/
├── react/           # existing
├── express/         # existing
├── fullstack/       # existing
└── docker/          # NEW
    ├── node-dockerfile.template
    ├── docker-compose-single.template
    ├── docker-compose-fullstack.template
    └── .dockerignore.template
```

**Template content (node-dockerfile.template)**:
```dockerfile
FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE {{PORT}}
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:{{PORT}}/{{HEALTH_PATH}} || exit 1
CMD ["node", "dist/index.js"]
```

### Phase 6c: DevOpsAgent Improvements

**File**: `src/agents/devops/devops-agent.ts`

1. **Add template tool usage** to DevOpsAgent:
   ```typescript
   // Instead of generating Dockerfile from scratch, use template
   const dockerfileContent = await this.useTemplate('docker/node-dockerfile', {
     PORT: '3001',
     HEALTH_PATH: 'api/health',
   });
   ```

2. **Add verification step** after creating Docker files:
   ```typescript
   private async verifyDockerfiles(): Promise<boolean> {
     // Check Dockerfile exists and is valid
     // Check docker-compose.yml has no volume mounts to app directory
     // Check ports are correctly configured
   }
   ```

3. **Add compose.yml validation**:
   ```typescript
   private validateComposeYml(content: string): string[] {
     const errors: string[] = [];
     if (content.includes('volumes:') && content.includes('/usr/src/app')) {
       errors.push('Volume mount to /usr/src/app will overwrite container files');
     }
     return errors;
   }
   ```

### Phase 6d: Agent Context Sharing

**File**: `src/core/context/build-context.ts` (NEW)

Create a shared context object that flows through the agent hierarchy:

```typescript
export interface BuildContext {
  projectPath: string;
  createdFiles: string[];
  entryPoint: string;        // e.g., "dist/index.js"
  port: number;
  healthPath: string;        // e.g., "/api/health"
  packageManager: 'npm' | 'yarn' | 'pnpm';
  buildCommand: string;      // e.g., "npm run build"
  startCommand: string;      // e.g., "npm run dev"
}
```

**Flow**:
1. BackendDevAgent creates files → populates BuildContext
2. PM passes BuildContext to DevOpsAgent
3. DevOpsAgent uses context to create accurate Dockerfile

### Phase 6e: Verification Loop

**File**: `src/agents/devops/devops-agent.ts`

Add post-creation verification:

```typescript
async executeTask(task: Task): Promise<TaskResult> {
  // 1. Create Docker files
  const createResult = await this.createDockerFiles(task);

  // 2. Verify Docker files
  const verifyResult = await this.verifyDockerSetup();
  if (!verifyResult.success) {
    // 3. Retry with fixes
    await this.fixDockerSetup(verifyResult.issues);
  }

  // 4. Build and test (if Docker available)
  if (await this.isDockerAvailable()) {
    const buildResult = await this.buildAndTest();
    if (!buildResult.success) {
      return { success: false, error: buildResult.error };
    }
  }

  return { success: true };
}
```

### Phase 6f: E2E Benchmark Update

**File**: `tests/e2e/benchmarks/build-deploy-monitor.test.ts`

Update benchmark with diagnostic assertions:

```typescript
it('should create deployable todo API', async () => {
  // Phase D1: Structure verification
  expect(await fileExists('backend/package.json')).toBe(true);
  expect(await fileExists('backend/Dockerfile')).toBe(true);

  // Phase D2: Install verification
  const installResult = await runNpm(projectDir, ['install']);
  expect(installResult.success).toBe(true);

  // Phase D3: Type safety
  const typecheckResult = await runNpm(projectDir, ['run', 'typecheck']);
  expect(typecheckResult.success).toBe(true);

  // Phase D4: Tests
  const testResult = await runNpm(projectDir, ['test']);
  expect(testResult.success).toBe(true);

  // Phase D5: Docker build
  const buildResult = await runDocker(['build', '.'], projectDir);
  expect(buildResult.success).toBe(true);

  // Phase D6: Health check
  await runDocker(['compose', 'up', '-d'], projectDir);
  const health = await waitForHealth('http://localhost:3001/api/health');
  expect(health).toBe(true);
});
```

---

## Implementation Order

### Sprint 1: Diagnostics & Templates (Unit Tests)

| Step | Task | Tests Added |
|------|------|-------------|
| 1 | Create `tests/unit/deployment-diagnostics.test.ts` | ~30 tests |
| 2 | Add Docker templates to `src/templates/docker/` | 5 template files |
| 3 | Add template tool for Docker | 3 tests |
| 4 | Run all unit tests | 885+ tests passing |

### Sprint 2: Agent Improvements (Integration)

| Step | Task | Tests Added |
|------|------|-------------|
| 1 | Add BuildContext interface | 5 tests |
| 2 | Update DevOpsAgent with template usage | 10 tests |
| 3 | Add compose.yml validation | 5 tests |
| 4 | Add verification loop to DevOpsAgent | 10 tests |

### Sprint 3: E2E Verification (Benchmark)

| Step | Task | Tests Added |
|------|------|-------------|
| 1 | Update benchmark with diagnostic assertions | - |
| 2 | Run full E2E benchmark | 1 test (15 min) |
| 3 | Document any remaining gaps | - |
| 4 | Update STATUS.md | - |

---

## Test Counts

| Category | Before | After |
|----------|--------|-------|
| Unit tests | 855 | ~920 |
| Deployment diagnostics | 0 | ~65 |
| E2E benchmarks | 8 | 8 |
| **TOTAL** | 863 | ~993 |

---

## Key Files to Create/Modify

### New Files (5)
```
tests/unit/deployment-diagnostics.test.ts
src/templates/docker/node-dockerfile.template
src/templates/docker/docker-compose-single.template
src/templates/docker/.dockerignore.template
src/core/context/build-context.ts
```

### Modified Files (4)
```
src/agents/devops/devops-agent.ts (add templates, verification)
src/core/tools/template-tools.ts (add Docker template support)
tests/e2e/benchmarks/build-deploy-monitor.test.ts (diagnostic assertions)
docs/STATUS.md (update progress)
```

---

## Verification Checklist

Before marking Phase 6 deployment as complete:

- [ ] Unit tests: 900+ passing
- [ ] Diagnostic tests: All D1-D6 categories passing
- [ ] DevOpsAgent creates valid Dockerfile without manual intervention
- [ ] DevOpsAgent creates compose.yml without volume mount bugs
- [ ] Docker build succeeds in E2E test
- [ ] Health check returns 200 in E2E test
- [ ] Full E2E benchmark passes in under 10 minutes

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Docker not available | Tests skip gracefully with `.skipIf(!HAS_DOCKER)` |
| Windows path issues | Use `path.posix` for Docker paths |
| Long test times | Increase timeout to 15 min, add progress logging |
| Template changes break existing | Keep templates backwards compatible |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| E2E deployment test pass rate | 100% |
| Time to deployable app | < 10 minutes |
| Human intervention required | 0 times |
| Files missing after generation | 0 |
| Docker build errors | 0 |
