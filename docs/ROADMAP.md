# ACIA Development Roadmap

**Created**: 2026-01-02
**Target**: Autonomous AI Software Factory

## Overview

This roadmap defines the path from current state (Phase 4 complete) to full autonomous software factory capability (Phase 8).

## Current State Summary

```
✅ Phase 1: Foundation (Complete)
✅ Phase 2: Basic Team (Complete)
✅ Phase 3: Company Structure (Complete)
✅ Phase 4: Production Hardening (Complete)
⬜ Phase 5: Fullstack Capability (Next)
⬜ Phase 6: Production Quality
⬜ Phase 7: Self-Improvement
⬜ Phase 8: Learning & Optimization
```

---

## Phase 5: Fullstack Capability

### Goal
ACIA can create complete fullstack applications from a single prompt.

### Benchmark
```
tests/e2e/benchmarks/fullstack-capability.test.ts
- Create todo app with React frontend + Express backend
- All code compiles, tests pass
- API endpoints work correctly
```

### 5a: Architecture Foundation

**New: ArchitectAgent**
```typescript
// src/agents/architect/architect-agent.ts
class ArchitectAgent extends Agent {
  // Creates technical design before any coding
  // Decides: tech stack, file structure, API design, data models
  // Outputs: Design document for other agents to follow
}
```

**Tasks:**
- [ ] Create ArchitectAgent class
- [ ] Add system design prompt template
- [ ] Add tech stack decision logic
- [ ] Add file structure planning
- [ ] Add API design capability
- [ ] Tests: 15+ unit tests

### 5b: Git Integration

**New: GitTools**
```typescript
// src/core/tools/git-tools.ts
export const gitTools = [
  {
    name: 'git_init',
    description: 'Initialize a git repository',
    // ...
  },
  {
    name: 'git_commit',
    description: 'Commit staged changes',
    // ...
  },
  {
    name: 'git_branch',
    description: 'Create or switch branches',
    // ...
  },
];
```

**Tasks:**
- [ ] Create git-tools.ts
- [ ] Implement: git_init, git_add, git_commit, git_status, git_branch
- [ ] Sandbox security (no remote operations without approval)
- [ ] Tests: 10+ unit tests

### 5c: Specialized Dev Agents

**Split DevAgent into specialists:**
```
src/agents/dev/
├── dev-agent.ts           # Base (existing, becomes abstract)
├── frontend-dev-agent.ts  # React, Vue, HTML/CSS
├── backend-dev-agent.ts   # Node, Express, APIs
└── database-dev-agent.ts  # SQL, migrations, models
```

**Tasks:**
- [ ] Create FrontendDevAgent (React/TypeScript focus)
- [ ] Create BackendDevAgent (Node/Express focus)
- [ ] Keep generic DevAgent for simple tasks
- [ ] Add agent selection logic to PM/Team
- [ ] Tests: 20+ unit tests

### 5d: Project Templates

**Templates for common patterns:**
```
src/templates/
├── index.ts              # Template loader
├── react-vite/           # React + Vite + TypeScript
│   ├── template.json     # Metadata
│   └── files/            # Template files
├── express-api/          # Express + TypeScript
│   ├── template.json
│   └── files/
└── fullstack/            # Combined frontend + backend
    ├── template.json
    └── files/
```

**Tasks:**
- [ ] Create template system
- [ ] Add React + Vite template
- [ ] Add Express API template
- [ ] Add fullstack template
- [ ] Add template selection logic
- [ ] Tests: 10+ unit tests

### 5e: Enhanced Team Coordination

**Multi-team capability:**
```typescript
// Enhanced CEO can manage multiple teams
class CEOAgent {
  async executeGoal(goal: string): Promise<GoalResult> {
    const design = await this.architect.createDesign(goal);

    // Spawn teams based on design
    const frontendTeam = this.createTeam('frontend', design.frontend);
    const backendTeam = this.createTeam('backend', design.backend);

    // Execute in parallel where possible
    const results = await Promise.all([
      frontendTeam.execute(design.frontend.tasks),
      backendTeam.execute(design.backend.tasks),
    ]);

    return this.integrateResults(results);
  }
}
```

**Tasks:**
- [ ] Add ArchitectAgent to CEO workflow
- [ ] Implement multi-team spawning
- [ ] Add parallel execution capability
- [ ] Add result integration logic
- [ ] Tests: 15+ unit tests

### 5f: Integration & Benchmark

**Tasks:**
- [ ] Run fullstack benchmark test
- [ ] Fix issues discovered
- [ ] Iterate until benchmark passes
- [ ] Document learnings

### Phase 5 Success Criteria

- [ ] Benchmark test `fullstack-capability.test.ts` passes
- [ ] Todo app created with working frontend + backend
- [ ] All generated code compiles without errors
- [ ] All generated tests pass
- [ ] API endpoints work correctly (verified by test)

---

## Phase 6: Production Quality

### Goal
Generated code meets production standards: security, testing, documentation, deployment.

### Benchmark
```
- REST API with JWT authentication
- 80%+ test coverage
- OpenAPI documentation
- Docker deployment
- CI/CD pipeline
```

### 6a: Enhanced QA Agents

```
src/agents/qa/
├── qa-agent.ts           # General QA (existing)
├── security-qa-agent.ts  # Security testing (OWASP)
├── perf-qa-agent.ts      # Performance testing
└── coverage-qa-agent.ts  # Coverage analysis
```

**Tasks:**
- [ ] Create SecurityQAAgent
- [ ] Create PerformanceQAAgent
- [ ] Create CoverageQAAgent
- [ ] Add to QA workflow
- [ ] Tests: 25+ unit tests

### 6b: Quality Gates

```typescript
// src/core/quality/gates.ts
interface QualityGate {
  name: string;
  check: (project: Project) => Promise<QualityResult>;
  required: boolean;
  threshold?: number;
}

const gates: QualityGate[] = [
  { name: 'lint', check: runLint, required: true },
  { name: 'typecheck', check: runTypecheck, required: true },
  { name: 'tests', check: runTests, required: true },
  { name: 'coverage', check: checkCoverage, required: true, threshold: 80 },
  { name: 'security', check: securityScan, required: true },
  { name: 'bundle-size', check: checkBundleSize, required: false },
];
```

**Tasks:**
- [ ] Create quality gates system
- [ ] Integrate with Team workflow
- [ ] Add gate reports to wiki
- [ ] Tests: 15+ unit tests

### 6c: DevOps Agent

```typescript
// src/agents/devops/devops-agent.ts
class DevOpsAgent extends Agent {
  // Creates: Dockerfile, docker-compose.yml, CI/CD configs
  // Knows: Docker, GitHub Actions, deployment patterns
}
```

**Tasks:**
- [ ] Create DevOpsAgent
- [ ] Add Docker tools (build, run, compose)
- [ ] Add CI/CD template generation
- [ ] Tests: 15+ unit tests

### 6d: Documentation Agent

```typescript
// src/agents/docs/docs-agent.ts
class DocsAgent extends Agent {
  async generateDocs(project: Project): Promise<Documentation> {
    return {
      readme: this.generateReadme(project),
      api: this.generateOpenAPI(project),
      architecture: this.generateArchDiagram(project),
    };
  }
}
```

**Tasks:**
- [ ] Create DocsAgent
- [ ] Add OpenAPI generation
- [ ] Add README generation
- [ ] Add architecture diagram generation
- [ ] Tests: 10+ unit tests

### Phase 6 Success Criteria

- [ ] Generated APIs have JWT authentication
- [ ] Test coverage >= 80%
- [ ] OpenAPI docs auto-generated
- [ ] Docker deployment works
- [ ] CI/CD pipeline included
- [ ] Security scan passes

---

## Phase 7: Self-Improvement

### Goal
ACIA can modify and improve its own codebase.

### Benchmark
```
- Add a new tool to ACIA itself
- Fix a bug in ACIA code
- All existing tests still pass
```

### 7a: Codebase Understanding

```typescript
// src/core/self/codebase-index.ts
class CodebaseIndex {
  // Index ACIA's own code
  // Understand patterns, conventions, dependencies
  // Enable context-aware self-modification
}
```

**Tasks:**
- [ ] Create codebase indexer
- [ ] Extract patterns and conventions
- [ ] Map dependencies
- [ ] Tests: 10+ unit tests

### 7b: Safe Self-Modification

```typescript
// src/core/self/modification-pipeline.ts
class SelfModificationPipeline {
  async modify(change: Change): Promise<Result> {
    // 1. Create branch
    // 2. Apply changes
    // 3. Run ALL tests
    // 4. Validate ACIA still works
    // 5. Merge or request approval
  }
}
```

**Tasks:**
- [ ] Create modification pipeline
- [ ] Add branch isolation
- [ ] Add full test validation
- [ ] Add self-health check
- [ ] Tests: 15+ unit tests

### Phase 7 Success Criteria

- [ ] ACIA can add a new tool to itself
- [ ] All 372+ existing tests still pass
- [ ] New tool has tests
- [ ] Documentation updated

---

## Phase 8: Learning & Optimization

### Goal
ACIA learns from projects and optimizes cost/performance.

### Benchmark
```
- Build second todo app 30% faster than first
- Use fewer tokens for similar tasks
- Reuse learned patterns
```

### 8a: Pattern Library

```typescript
// src/core/learning/pattern-library.ts
interface Pattern {
  name: string;
  context: string[];      // When to apply
  template: string;       // Code template
  successRate: number;
}

class PatternLibrary {
  learn(project: CompletedProject): Pattern[];
  suggest(context: TaskContext): Pattern[];
}
```

**Tasks:**
- [ ] Create pattern extraction
- [ ] Create pattern storage
- [ ] Create pattern matching
- [ ] Integrate with planning
- [ ] Tests: 15+ unit tests

### 8b: Cost Optimization

```typescript
// src/core/optimization/cost-optimizer.ts
class CostOptimizer {
  // Select cheaper models for simple tasks
  // Cache common operations
  // Batch similar requests
  // Track cost per project
}
```

**Tasks:**
- [ ] Create cost tracking
- [ ] Add model selection logic
- [ ] Enhance caching
- [ ] Add batch processing
- [ ] Tests: 10+ unit tests

### Phase 8 Success Criteria

- [ ] Similar projects built faster
- [ ] Token usage reduced
- [ ] Cost per project tracked
- [ ] Patterns reused across projects

---

## Architecture Evolution

### Current (Phase 4)

```
User → Jarvis → CEO → Team (PM→Dev→QA)
```

### Target (Phase 8)

```
User → Jarvis → CEO → Architect
                  ↓
         ┌───────┴───────┐
         ↓               ↓
    Frontend Team   Backend Team   DevOps Team
    (PM→FE Dev→QA) (PM→BE Dev→QA) (PM→DevOps→QA)
         ↓               ↓              ↓
         └───────────────┴──────────────┘
                         ↓
                   Quality Gates
                         ↓
                   Pattern Library (learns)
                         ↓
                   Final Output
```

---

## New Files Summary

### Phase 5 (New Files)
```
src/agents/architect/
  └── architect-agent.ts
src/agents/dev/
  ├── frontend-dev-agent.ts
  ├── backend-dev-agent.ts
  └── database-dev-agent.ts
src/core/tools/
  └── git-tools.ts
src/templates/
  ├── index.ts
  ├── react-vite/
  ├── express-api/
  └── fullstack/
```

### Phase 6 (New Files)
```
src/agents/qa/
  ├── security-qa-agent.ts
  ├── perf-qa-agent.ts
  └── coverage-qa-agent.ts
src/agents/devops/
  └── devops-agent.ts
src/agents/docs/
  └── docs-agent.ts
src/core/quality/
  └── gates.ts
src/core/tools/
  └── docker-tools.ts
```

### Phase 7 (New Files)
```
src/core/self/
  ├── codebase-index.ts
  └── modification-pipeline.ts
```

### Phase 8 (New Files)
```
src/core/learning/
  └── pattern-library.ts
src/core/optimization/
  └── cost-optimizer.ts
```

---

## Test Count Projections

| Phase | New Tests | Total |
|-------|-----------|-------|
| 4 (Current) | - | 372 |
| 5 | ~70 | ~442 |
| 6 | ~65 | ~507 |
| 7 | ~25 | ~532 |
| 8 | ~25 | ~557 |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Context overflow | High | Summarization, focused prompts |
| Infinite loops | High | Max iterations, cost caps |
| Bad code quality | Medium | Multiple QA passes, quality gates |
| Cost explosion | Medium | Token tracking, model selection |
| Security issues | High | Sandboxing, security scans |
| Hallucinated deps | Medium | Verification, known-good templates |

---

## Immediate Next Steps

1. **Verify benchmark test runs** (even if it fails)
2. **Start Phase 5a**: Create ArchitectAgent
3. **Add GitTools** for version control
4. **Create first template** (Express API)
5. **Iterate until benchmark passes**

---

## Success Definition

**ACIA is successful when:**

1. A user can say "Build me a todo app" and get a working application
2. The code is production-quality (typed, tested, documented)
3. No human intervention needed for standard projects
4. Cost is predictable and reasonable
5. Each project makes the system smarter

**The benchmark tests define this success. When they pass, we've achieved the vision.**
