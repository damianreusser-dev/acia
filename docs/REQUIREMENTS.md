# ACIA Requirements

## Overview

ACIA (Autonomous Company Intelligence Architecture) is a multi-agent system that operates as an autonomous software factory. The system should be capable of:
1. Receiving high-level project requirements
2. Designing architecture and technical approach
3. Breaking requirements into tasks
4. Assigning tasks to specialized agents
5. Developing, testing, and deploying software
6. Learning and improving over time

## Phase Breakdown

### Phase 1: Foundation ✓ COMPLETED

**Goal**: Establish a working single-agent system that can communicate and reason.

#### Phase 1a: Basic Agent Communication ✓
- [x] Base Agent class with LLM integration
- [x] Simple CLI for user interaction
- [x] Agent can receive and respond to messages
- [x] Unit tests for core components

#### Phase 1b: Agent File Operations ✓
- [x] Agent can read files from disk
- [x] Agent can write files to disk
- [x] Agent can list directory contents
- [x] File operations are sandboxed to workspace

#### Phase 1c: Agent Code Execution ✓
- [x] Agent can write TypeScript/JavaScript code
- [x] Agent can run tests on written code
- [x] Agent receives test results and can iterate
- [x] Basic error handling and recovery

---

### Phase 2: Basic Team ✓ COMPLETED

**Goal**: Multiple agents working together on a single task.

#### Phase 2a: Agent Types + Task System ✓
- [x] Task interface with status, priority, attempts
- [x] DevAgent specialized for implementing code
- [x] QAAgent specialized for testing and review
- [x] PMAgent for coordination and task planning
- [x] Task tracking and status management

#### Phase 2b: Agent Communication ✓
- [x] Team class to coordinate agents
- [x] PM assigns tasks to Dev/QA based on plan
- [x] Synchronous task execution
- [x] Result reporting back to PM
- [x] Retry logic with PM feedback

#### Phase 2c: Workflow Loop ✓
- [x] Dev → QA → Fix iteration loop
- [x] Automatic fix task creation when QA fails
- [x] maxIterations limit to prevent infinite loops
- [x] Escalation callbacks for external notification
- [x] Progress callbacks for status updates

---

### Phase 3: Company Structure ✓ COMPLETED

**Goal**: Full company hierarchy with divisions.

- [x] CEO Agent manages overall direction
- [x] Jarvis as universal entry point
- [x] Channel-based communication
- [x] Persistent memory/wiki system
- [x] Design-first development workflow

---

### Phase 4: Production Hardening ✓ COMPLETED

**Goal**: Security, performance, and observability.

- [x] Security hardening (injection prevention, sandboxing)
- [x] LRU caching for LLM responses
- [x] Structured logging with correlation IDs
- [x] Performance metrics collection
- [x] Memory bounds enforcement

---

### Phase 5: Fullstack Capability (NEXT)

**Goal**: ACIA can create complete fullstack applications.

**Benchmark**: Build a todo app with React frontend + Express backend

#### Phase 5a: Architecture Foundation
- [ ] ArchitectAgent for system design
- [ ] Technical design before coding
- [ ] Tech stack decisions
- [ ] File structure planning

#### Phase 5b: Git Integration
- [ ] GitTools (init, add, commit, branch, status)
- [ ] Version control for generated projects
- [ ] Safe sandbox (no remote ops without approval)

#### Phase 5c: Specialized Dev Agents
- [ ] FrontendDevAgent (React, TypeScript, Vite)
- [ ] BackendDevAgent (Node, Express, APIs)
- [ ] DatabaseDevAgent (SQL, migrations)
- [ ] Agent selection logic in PM/Team

#### Phase 5d: Project Templates
- [ ] Template system for common patterns
- [ ] React + Vite template
- [ ] Express API template
- [ ] Fullstack template
- [ ] Template selection based on requirements

#### Phase 5e: Multi-Team Coordination
- [ ] CEO can spawn multiple teams
- [ ] Parallel execution where possible
- [ ] Result integration across teams
- [ ] Architect → Teams workflow

**Success Criteria**:
- [ ] `tests/e2e/benchmarks/fullstack-capability.test.ts` passes
- [ ] Todo app created with working frontend + backend
- [ ] All generated code compiles
- [ ] All generated tests pass
- [ ] API endpoints verified working

---

### Phase 6: Production Quality

**Goal**: Generated code meets production standards.

**Benchmark**: REST API with auth, 80% coverage, Docker, CI/CD

#### Phase 6a: Enhanced QA
- [ ] SecurityQAAgent (OWASP checks)
- [ ] PerformanceQAAgent (load testing)
- [ ] CoverageQAAgent (80%+ coverage)

#### Phase 6b: Quality Gates
- [ ] Automated quality gate system
- [ ] Lint, typecheck, test, coverage, security
- [ ] Gate reports in wiki
- [ ] Required vs optional gates

#### Phase 6c: DevOps Agent
- [ ] DevOpsAgent for deployment
- [ ] Docker tools (build, compose)
- [ ] CI/CD template generation
- [ ] GitHub Actions workflows

#### Phase 6d: Documentation Agent
- [ ] DocsAgent for auto-documentation
- [ ] OpenAPI/Swagger generation
- [ ] README generation
- [ ] Architecture diagrams

**Success Criteria**:
- [ ] JWT authentication in generated APIs
- [ ] Test coverage >= 80%
- [ ] OpenAPI docs generated
- [ ] Docker deployment works
- [ ] CI/CD pipeline included
- [ ] Security scan passes

---

### Phase 7: Self-Improvement

**Goal**: ACIA can improve itself.

**Benchmark**: Add a new tool to ACIA, all tests pass

#### Phase 7a: Codebase Understanding
- [ ] Index ACIA's own codebase
- [ ] Extract patterns and conventions
- [ ] Map dependencies
- [ ] Context-aware modifications

#### Phase 7b: Safe Self-Modification
- [ ] Modification pipeline with isolation
- [ ] Branch-based changes
- [ ] Full test validation
- [ ] Self-health verification
- [ ] Human approval for major changes

**Success Criteria**:
- [ ] ACIA adds a new tool to itself
- [ ] All 370+ existing tests pass
- [ ] New tool has tests
- [ ] Documentation updated

---

### Phase 8: Learning & Optimization

**Goal**: ACIA learns and optimizes over time.

**Benchmark**: Second todo app 30% faster, fewer tokens

#### Phase 8a: Pattern Library
- [ ] Extract patterns from completed projects
- [ ] Store and index patterns
- [ ] Pattern matching for new tasks
- [ ] Pattern suggestions during planning

#### Phase 8b: Cost Optimization
- [ ] Model selection (haiku vs opus)
- [ ] Enhanced caching strategies
- [ ] Batch processing
- [ ] Cost tracking per project

**Success Criteria**:
- [ ] Similar projects built faster
- [ ] Token usage reduced over time
- [ ] Cost per project tracked
- [ ] Patterns reused effectively

---

## Non-Functional Requirements

### Quality
- [x] All code must have tests (372+ tests)
- [ ] Test coverage > 80% for core components
- [x] No `any` types without justification
- [x] Linting and formatting enforced

### Security
- [x] API keys never in code (via .env)
- [x] File operations sandboxed
- [x] Shell injection prevention
- [x] Path traversal prevention
- [ ] Security scans on generated code

### Performance
- [x] LRU caching for LLM responses
- [ ] Token usage optimization
- [ ] Model selection for cost/capability
- [ ] Parallel execution where possible

### Observability
- [x] Structured JSON logging
- [x] Correlation IDs for tracing
- [x] Performance metrics collection
- [ ] Cost metrics per project

### Documentation
- [x] Every module has a doc comment
- [x] Architecture decisions recorded
- [x] STATUS.md always current
- [ ] Auto-generated API docs

### Development Process
- [ ] Feature branches from develop
- [ ] PR required for all changes
- [x] CI must pass before merge
- [ ] No force pushes to main/develop

---

## Agent Hierarchy (Target)

```
Human
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│                         JARVIS                               │
│              (Universal Entry Point)                         │
│  Analyzes requests, routes to companies, reports results    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                          CEO                                 │
│              (Company Orchestrator)                          │
│  Strategic planning, resource allocation, escalation        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       ARCHITECT                              │
│              (Technical Design)                              │
│  System design, tech decisions, file structure              │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Frontend   │   │   Backend   │   │   DevOps    │
│    Team     │   │    Team     │   │    Team     │
├─────────────┤   ├─────────────┤   ├─────────────┤
│ PM          │   │ PM          │   │ PM          │
│ FE Dev      │   │ BE Dev      │   │ DevOps Eng  │
│ QA          │   │ QA          │   │ QA          │
└─────────────┘   └─────────────┘   └─────────────┘
         │                │                │
         └────────────────┴────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    QUALITY GATES                             │
│  Lint → Typecheck → Tests → Coverage → Security → Docs     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
                   DELIVERED PROJECT
```

---

## Tool Inventory (Target)

### Current Tools
- [x] read_file - Read file contents
- [x] write_file - Write file contents
- [x] list_directory - List directory contents
- [x] run_code - Execute TypeScript/JavaScript
- [x] run_test_file - Run specific test file
- [x] run_npm_script - Run npm scripts
- [x] read_wiki - Read wiki page
- [x] write_wiki - Write wiki page
- [x] search_wiki - Search wiki
- [x] list_wiki - List wiki pages

### Phase 5 Tools
- [ ] git_init - Initialize repository
- [ ] git_add - Stage files
- [ ] git_commit - Commit changes
- [ ] git_status - Check status
- [ ] git_branch - Manage branches

### Phase 6 Tools
- [ ] docker_build - Build Docker image
- [ ] docker_run - Run container
- [ ] docker_compose - Manage compose
- [ ] security_scan - Run security scan
- [ ] generate_openapi - Generate API docs

### Phase 7 Tools
- [ ] index_codebase - Index code for understanding
- [ ] search_code - Search codebase
- [ ] analyze_patterns - Extract patterns

---

## Success Metrics

| Metric | Phase 5 | Phase 6 | Phase 7 | Phase 8 |
|--------|---------|---------|---------|---------|
| Build fullstack app | ✓ | ✓ | ✓ | ✓ |
| Production quality | - | ✓ | ✓ | ✓ |
| Self-modification | - | - | ✓ | ✓ |
| Learning | - | - | - | ✓ |
| Test count | ~442 | ~507 | ~532 | ~557 |
| Benchmark pass | 1/6 | 4/6 | 5/6 | 6/6 |
