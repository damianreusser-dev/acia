# ACIA Development Roadmap

**Created**: 2026-01-02
**Updated**: 2026-01-04
**Target**: Autonomous Company Factory

## Overview

This roadmap defines the path from current state (Phase 6 complete) to full autonomous company factory capability (Phase 12).

**Vision**: See [VISION.md](./VISION.md) for the complete autonomous company factory vision.

## Phase Summary

```
✅ Phase 1:  Foundation (Complete)
✅ Phase 2:  Basic Team (Complete)
✅ Phase 3:  Company Structure (Complete)
✅ Phase 4:  Production Hardening (Complete)
✅ Phase 5:  Fullstack Capability (Complete)
✅ Phase 6:  Coordination Refactor + Deployment & Operations (Complete)
🔄 Phase 7:  Persona-Based QA & Validation (Next)
⬜ Phase 8:  Self-Improvement Pipeline
⬜ Phase 9:  Marketing & Growth Division
⬜ Phase 10: Support & Feedback Division
⬜ Phase 11: Finance & Portfolio Division
⬜ Phase 12: Full Autonomy & Chief of Staff
```

---

## Completed Phases (1-4)

### Phase 1: Foundation ✅
- Base Agent class with LLM integration
- Tool system architecture
- File operations (read, write, list)
- Code execution tools
- CLI interface

### Phase 2: Basic Team ✅
- Task system with status tracking
- DevAgent, QAAgent, PMAgent
- Team coordination (PM → Dev → QA)
- Iteration loop with fix tasks
- Escalation callbacks

### Phase 3: Company Structure ✅
- Wiki/memory system
- Design-first development
- CEO agent for orchestration
- Jarvis as universal entry point
- Communication channels (pub/sub)

### Phase 4: Production Hardening ✅
- Security hardening (injection prevention, path traversal)
- Memory bounds (conversation history limits)
- LLM response caching
- Structured logging with correlation IDs
- Performance metrics collection

---

## Phase 5: Fullstack Capability ✅

**Status**: Complete (2026-01-03)

**Goal**: ACIA can create complete fullstack applications from a single prompt.

**Benchmark**: `tests/e2e/benchmarks/fullstack-capability.test.ts` - **PASSING**

### Completed Sub-phases

#### 5a: Architecture Foundation ✅
- [x] ArchitectAgent for system design
- [x] SystemDesign interface with API contracts
- [x] Technology stack decisions
- [x] File structure planning
- [x] 26 unit tests

#### 5b: Git Integration ✅
- [x] GitInitTool, GitAddTool, GitCommitTool
- [x] GitStatusTool, GitBranchTool, GitLogTool
- [x] Security: path validation, message sanitization
- [x] 34 unit tests

#### 5c: Specialized Agents & Templates ✅
- [x] FrontendDevAgent (React/TypeScript)
- [x] BackendDevAgent (Node/Express)
- [x] Keyword-based agent selection
- [x] React + Vite template
- [x] Express API template
- [x] Fullstack template
- [x] 82 unit tests

#### 5d: Benchmark Infrastructure ✅
- [x] Workspace-based JarvisAgent
- [x] Auto-creation of tools
- [x] Metrics tracking
- [x] 5 unit tests

#### 5e: Template Tools ✅
- [x] list_templates tool
- [x] generate_project tool
- [x] preview_template tool
- [x] 11 unit tests

#### 5f/5g: Template Structure & Agent Prompts ✅
- [x] Fullstack creates frontend/ and backend/ subdirs
- [x] Root README.md generation
- [x] Agent prompts mention template tools

#### 5h: Scaffold Task Detection ✅
- [x] PMAgent detects new project tasks
- [x] DevAgent scaffold task handling
- [x] 3 unit tests

#### 5i-5L: Benchmark Validation & Reliability (COMPLETED)
- [x] Run fullstack benchmark with real API
- [x] Fix issues discovered in multi-layer orchestration
- [x] Iterate until benchmark passes
- [x] Document learnings

**Key fixes applied:**
- BackendDevAgent/FrontendDevAgent now extend DevAgent (inherit tool verification)
- PM task descriptions use full paths (${projectName}/backend/src/routes/)
- CEO isScaffoldGoal() detects detailed requirements
- Tool call enforcement with retry loop (MAX_TASK_RETRIES=3)
- OpenAI native function calling support

### Phase 5 Success Criteria (ALL MET)
- [x] Benchmark test passes (todo app with React + Express) - **418 seconds**
- [x] All generated code compiles without errors
- [x] All generated tests pass
- [x] API endpoints work correctly (GET/POST/PUT/DELETE /api/todos)

---

## Phase 6: Deployment & Operations ✅

**Status**: Complete (2026-01-04)

**Goal**: ACIA deploys products to real environments and keeps them running.

**Benchmark**: `tests/e2e/benchmarks/build-deploy-monitor.test.ts` - **PASSING**

**Implementation Notes**:
- Railway/Vercel replaced with Azure focus (App Service, Static Web Apps, Container Apps)
- Added 6h (Azure + Build-Deploy-Monitor) and 6i (Reliability fixes) beyond original plan
- Total: ~425 new tests (exceeds projected 120)

### 6a: Coordination Layer Refactoring ✅

**Why**: The current architecture hardcodes Team to specific agent types. Adding new divisions (Ops, Marketing, Sales) will require duplicating ~575+ lines of coordination code per division unless we refactor first.

**Problem Areas Identified**:
| Issue | Location | Impact |
|-------|----------|--------|
| Team hardcodes agent imports | `src/team/team.ts:13-17` | Can't add new team types |
| CEO only knows Team class | `src/agents/executive/ceo-agent.ts:12` | Can't manage multiple division types |
| Tool filtering by string names | `src/team/team.ts:73-85` | Fragile, not extensible |
| Dev agents duplicate instead of inherit | `frontend-dev-agent.ts`, `backend-dev-agent.ts` | 200+ lines duplicated |
| Scaffold detection duplicated 3x | PM, Dev, CEO agents | Maintenance burden |

**Refactoring Tasks**:

#### 6a.1: Extract ITeam Interface ✅
```typescript
// New: src/team/team-interface.ts
interface ITeam {
  executeTask(description: string, priority: Priority): Promise<WorkflowResult>;
  getAgentRoles(): string[];
  getName(): string;
}
```
- [x] Create ITeam interface
- [x] Team class implements ITeam
- [x] CEO works with ITeam (not concrete Team)
- [x] Tests: 11 unit tests

#### 6a.2: Create Team Factory ✅
```typescript
// New: src/team/team-factory.ts
class TeamFactory {
  static create(type: 'tech' | 'ops' | 'marketing', config: TeamConfig): ITeam;
}
```
- [x] Create TeamFactory class
- [x] TechTeam as first implementation
- [x] Division type registration (tech, ops)
- [x] Tests: 17 unit tests

#### 6a.3: Tool Permission System ✅
```typescript
// Modify: src/core/tools/types.ts
interface Tool {
  definition: ToolDefinition;
  roles?: AgentRole[]; // New: which roles can use this tool
}

type AgentRole = 'pm' | 'dev' | 'qa' | 'devops' | 'ops' | 'content' | 'monitoring' | 'incident';
```
- [x] Add roles to Tool interface
- [x] Filter tools by role instead of string matching
- [x] Backward compatible (roles optional)
- [x] Tests: 18 unit tests

#### 6a.4: Consolidate Dev Agent Inheritance ✅
```typescript
// Modify: frontend-dev-agent.ts, backend-dev-agent.ts
class FrontendDevAgent extends DevAgent {
  // Only override system prompt
  // Remove duplicated buildTaskPrompt, analyzeResponse, etc.
}
```
- [x] FrontendDevAgent extends DevAgent
- [x] BackendDevAgent extends DevAgent
- [x] Remove duplicated methods
- [x] Tests: All existing tests pass

#### 6a.5: Extract Shared Utilities ✅
```typescript
// New: src/utils/scaffold-detector.ts
function isScaffoldTask(text: string): boolean;
function extractProjectName(text: string): string;

// New: src/utils/response-parser.ts
class ResponseParser {
  parseSection(response: string, section: string): string;
  parseList(response: string, section: string): string[];
  parseKeyValue(response: string, pattern: RegExp): Record<string, string>;
}
```
- [x] Create scaffold-detector.ts
- [x] Create response-parser.ts
- [x] PM, Dev, CEO use shared utilities
- [x] Remove duplicated logic
- [x] Tests: 97 unit tests (41 scaffold-detector + 56 response-parser)

**Phase 6a Success Criteria** (ALL MET):
- [x] CEO works with ITeam interface
- [x] TeamFactory can create TechTeam and OpsTeam
- [x] Tools filtered by role, not string matching
- [x] Dev agent inheritance consolidated
- [x] No duplicated scaffold detection logic
- [x] All existing tests pass (no regressions)

**Phase 6a New Files**:
```
src/team/
  ├── team-interface.ts
  └── team-factory.ts
src/utils/
  ├── scaffold-detector.ts
  └── response-parser.ts
tests/unit/
  ├── team-interface.test.ts
  ├── team-factory.test.ts
  ├── scaffold-detector.test.ts
  └── response-parser.test.ts
```

**Phase 6a Test Count**: 143 new tests

---

### 6b: DevOps Agent ✅

**New**: `src/agents/devops/devops-agent.ts`

```typescript
class DevOpsAgent extends Agent {
  // Creates deployment artifacts
  // Manages infrastructure
  // Handles deployments
}
```

**Tasks**:
- [x] Create DevOpsAgent class
- [x] System prompt for infrastructure expertise
- [x] Docker knowledge (Dockerfile, compose)
- [x] CI/CD knowledge (GitHub Actions)
- [x] Cloud deployment patterns
- [x] Tests: 16 unit tests

### 6c: Docker Tools ✅

**New**: `src/core/tools/docker-tools.ts`

```typescript
const dockerTools = [
  { name: 'docker_build', description: 'Build Docker image' },
  { name: 'docker_run', description: 'Run container' },
  { name: 'docker_compose_up', description: 'Start compose stack' },
  { name: 'docker_compose_down', description: 'Stop compose stack' },
  { name: 'docker_logs', description: 'Get container logs' },
  { name: 'docker_ps', description: 'List containers' },
  { name: 'docker_stop', description: 'Stop container' },
  { name: 'docker_rm', description: 'Remove container' },
];
```

**Tasks**:
- [x] Create docker-tools.ts
- [x] Implement all 8 docker tools
- [x] Security: role-based access (devops, ops only)
- [x] Tests: 37 unit tests

### 6d: Cloud Deployment Tools ✅

**New**: `src/core/tools/deploy-tools.ts`, `src/core/tools/azure-tools.ts`

```typescript
// Changed from Railway/Vercel to Azure focus
const azureTools = [
  { name: 'deploy_to_azure_app_service', description: 'Deploy to Azure App Service' },
  { name: 'deploy_to_azure_static_web', description: 'Deploy to Azure Static Web Apps' },
  { name: 'deploy_to_azure_container_apps', description: 'Deploy to Container Apps' },
  { name: 'get_azure_deployment_status', description: 'Check Azure deployment status' },
  { name: 'get_azure_deployment_logs', description: 'Get Azure deployment logs' },
  { name: 'delete_azure_deployment', description: 'Clean up Azure resources' },
];
```

**Tasks**:
- [x] Create deploy-tools.ts and azure-tools.ts
- [x] Azure App Service integration
- [x] Azure Static Web Apps integration
- [x] Azure Container Apps integration
- [x] Deployment status and logs
- [x] Tests: 88 unit tests (35 deploy + 53 azure)

### 6e: Monitoring Agent ✅

**New**: `src/agents/ops/monitoring-agent.ts`

```typescript
class MonitoringAgent extends Agent {
  // Watches deployed services
  // Detects issues
  // Triggers alerts
}
```

**Tasks**:
- [x] Create MonitoringAgent class
- [x] Health check polling with target management
- [x] Consecutive failure tracking
- [x] Severity-based alerts (medium/high/critical)
- [x] Health state management (healthy/unhealthy/unknown)
- [x] Tests: 19 unit tests

### 6f: Incident Agent ✅

**New**: `src/agents/ops/incident-agent.ts`

```typescript
class IncidentAgent extends Agent {
  // Responds to alerts
  // Executes runbooks
  // Escalates if needed
}
```

**Tasks**:
- [x] Create IncidentAgent class
- [x] Runbook system (register and trigger matching)
- [x] Automated recovery (restart → rollback → escalate)
- [x] Incident lifecycle (detected → acknowledged → investigating → resolved/escalated)
- [x] Timeline tracking for all events
- [x] Tests: 32 unit tests

### 6g: Ops Division Integration ✅

**New**: `src/company/divisions/ops-division.ts`

**Tasks**:
- [x] Create OpsDivision class implementing ITeam
- [x] Integrate DevOpsAgent, MonitoringAgent, IncidentAgent
- [x] Task type detection (deployment, monitoring, incident)
- [x] Workflow routing to appropriate agents
- [x] Role-based tool filtering (devops, monitoring, incident)
- [x] Tests: 18 unit tests

### 6h: Azure + Build-Deploy-Monitor ✅ (BONUS)

**Not in original plan** - Added for complete deployment workflow.

**Tasks**:
- [x] CEO.executeGoalWithDeployment() method
- [x] OpsDivision local Docker deployment
- [x] Jarvis deployment intent detection
- [x] Auto-monitoring target registration
- [x] Build-deploy-monitor E2E benchmark
- [x] Tests: ~60 tests

### 6i: Deployment Reliability ✅ (BONUS)

**Not in original plan** - Added to fix reliability issues.

**Tasks**:
- [x] Deployment diagnostics test suite (D1-D6)
- [x] Team project path tracking (activeProjectPath)
- [x] DevAgent PROJECT PATH CONTEXT injection
- [x] Express template Docker files
- [x] Tests: 34 tests

### Phase 6 Success Criteria (ALL MET)
- [x] DevOpsAgent creates valid Dockerfile and docker-compose.yml
- [x] App deploys to local Docker successfully
- [x] App deploys to Azure successfully (when credentials available)
- [x] Monitoring detects health failures
- [x] IncidentAgent triggers recovery actions
- [x] Full deploy → monitor → incident → recover flow works

### Phase 6 New Files
```
src/team/
  ├── team-interface.ts
  └── team-factory.ts
src/utils/
  ├── scaffold-detector.ts
  └── response-parser.ts
src/agents/devops/
  └── devops-agent.ts
src/agents/ops/
  ├── monitoring-agent.ts
  └── incident-agent.ts
src/core/tools/
  ├── docker-tools.ts
  ├── deploy-tools.ts
  ├── azure-tools.ts
  └── deployment-template-tools.ts
src/core/validation/
  └── compose-validator.ts
src/templates/docker/
  ├── docker-template.ts
  ├── compose-template.ts
  └── types.ts
src/company/divisions/
  └── ops-division.ts
tests/unit/
  ├── team-interface.test.ts
  ├── team-factory.test.ts
  ├── scaffold-detector.test.ts
  ├── response-parser.test.ts
  ├── devops-agent.test.ts
  ├── monitoring-agent.test.ts
  ├── incident-agent.test.ts
  ├── docker-tools.test.ts
  ├── deploy-tools.test.ts
  ├── azure-tools.test.ts
  ├── deployment-template-tools.test.ts
  ├── deployment-diagnostics.test.ts
  ├── compose-validator.test.ts
  ├── docker-templates.test.ts
  └── ops-division.test.ts
tests/e2e/benchmarks/
  ├── coordination-refactor.test.ts
  ├── deployment-capability.test.ts
  ├── incident-recovery.test.ts
  └── build-deploy-monitor.test.ts
```

### Phase 6 Test Count: ~425 new tests (exceeded projected 120)
- 6a (Coordination Refactor): 143 tests
- 6b (DevOpsAgent + Docker): 53 tests
- 6c-6g (Monitoring, Incident, Ops): 69 tests
- 6h (Azure + Build-Deploy-Monitor): 60 tests
- 6i (Reliability + Diagnostics): 100 tests

---

## Phase 7: Persona-Based QA & Validation

**Status**: Planned (DETAILED)

**Goal**: QA that catches real issues through persona simulation with context isolation.

**Benchmark**: Chess game where PersonaQA finds logic bugs that unit tests miss.

### 7a: Persona QA Agent

**New**: `src/agents/qa/persona-qa-agent.ts`

```typescript
interface Persona {
  name: string;
  description: string;
  expectations: string[];
  behavior: 'exploratory' | 'systematic' | 'adversarial';
}

class PersonaQAAgent extends Agent {
  private persona: Persona;

  // CRITICAL: Fresh LLM context, NO dev history
  // Only knows: requirement + running app + persona

  async testAsPersona(app: RunningApp, requirement: string): Promise<TestReport>;
}
```

**Personas to implement**:
- [ ] BeginnerPersona: Tries obvious things, expects guidance
- [ ] ExpertPersona: Tries edge cases, expects completeness
- [ ] AdversarialPersona: Tries to break things
- [ ] AccessibilityPersona: Keyboard navigation, screen reader
- [ ] MobilePersona: Small screen, touch interactions

**Tasks**:
- [ ] Create PersonaQAAgent class
- [ ] Persona definition interface
- [ ] Context isolation (fresh LLM session)
- [ ] 5 built-in personas
- [ ] Custom persona creation
- [ ] Tests: 25+ unit tests

### 7b: Visual QA Agent

**New**: `src/agents/qa/visual-qa-agent.ts`

```typescript
class VisualQAAgent extends Agent {
  // Takes screenshots of running app
  // Uses multimodal LLM to analyze
  // Detects visual issues
}
```

**Tasks**:
- [ ] Create VisualQAAgent class
- [ ] Screenshot capture tool (Puppeteer/Playwright)
- [ ] Multimodal LLM integration (Claude vision)
- [ ] Visual issue detection prompts
- [ ] Golden image comparison (optional)
- [ ] Tests: 15+ unit tests

### 7c: Oracle Testing System

**New**: `src/core/testing/oracle-system.ts`

```typescript
interface Oracle {
  domain: string;           // e.g., 'chess', 'math', 'date'
  implementation: string;   // e.g., 'chess.js', 'mathjs'
  verify: (input: any, output: any) => boolean;
}

class OracleTestingSystem {
  async findOracle(domain: string): Promise<Oracle | null>;
  async verifyAgainstOracle(app: RunningApp, oracle: Oracle): Promise<OracleReport>;
}
```

**Built-in oracles**:
- [ ] Chess (chess.js)
- [ ] Math calculations (mathjs)
- [ ] Date/time (date-fns)
- [ ] JSON validation (ajv)

**Tasks**:
- [ ] Create OracleTestingSystem
- [ ] Oracle interface and registry
- [ ] Automatic oracle discovery based on domain
- [ ] Comparison and reporting
- [ ] 4 built-in oracles
- [ ] Tests: 20+ unit tests

### 7d: App Interaction Tools

**New**: `src/core/tools/interaction-tools.ts`

```typescript
const interactionTools = [
  { name: 'launch_app', description: 'Start the app locally' },
  { name: 'screenshot', description: 'Take screenshot of page' },
  { name: 'click', description: 'Click element by selector' },
  { name: 'type', description: 'Type text into element' },
  { name: 'navigate', description: 'Go to URL' },
  { name: 'get_text', description: 'Get text content of element' },
  { name: 'check_accessibility', description: 'Run accessibility audit' },
];
```

**Tasks**:
- [ ] Create interaction-tools.ts
- [ ] Puppeteer/Playwright integration
- [ ] All interaction tools
- [ ] Accessibility audit (axe-core)
- [ ] Tests: 20+ unit tests

### 7e: QA Division Enhancement

**Modify**: `src/company/divisions/tech-division.ts`

**Tasks**:
- [ ] Add PersonaQAAgent to QA workflow
- [ ] Add VisualQAAgent to QA workflow
- [ ] Oracle testing when applicable
- [ ] QA runs AFTER unit tests pass
- [ ] Persona QA has isolated context
- [ ] Tests: 10+ integration tests

### Phase 7 Success Criteria
- [ ] PersonaQAAgent finds UI bug that unit tests missed
- [ ] Different personas catch different types of issues
- [ ] VisualQAAgent identifies visual regression
- [ ] Oracle testing catches chess logic error
- [ ] QA has NO access to dev implementation context
- [ ] Full isolation verified (fresh LLM session per persona)

### Phase 7 New Files
```
src/agents/qa/
  ├── persona-qa-agent.ts
  └── visual-qa-agent.ts
src/core/testing/
  └── oracle-system.ts
src/core/tools/
  └── interaction-tools.ts
tests/unit/
  ├── persona-qa-agent.test.ts
  ├── visual-qa-agent.test.ts
  ├── oracle-system.test.ts
  └── interaction-tools.test.ts
tests/integration/
  └── persona-qa-workflow.test.ts
```

### Phase 7 Test Count: ~90 new tests

---

## Phase 8: Self-Improvement Pipeline

**Status**: Planned (DETAILED)

**Goal**: ACIA can safely modify itself with confidence-based autonomy.

**Benchmark**: ACIA detects missing capability, adds it, verifies no regression.

### 8a: Capability Registry

**New**: `src/core/self/capability-registry.ts`

```typescript
interface Capability {
  name: string;
  description: string;
  requires: string[];        // Dependencies
  provides: string[];        // What it enables
  agents: string[];          // Which agents have it
  tools: string[];           // Which tools it needs
  canTest: boolean;          // Can we verify it works?
  confidence: number;        // How reliable is it?
}

class CapabilityRegistry {
  list(): Capability[];
  has(name: string): boolean;
  check(requirement: string): CapabilityCheck;
  add(capability: Capability): void;
  remove(name: string): void;
}
```

**Tasks**:
- [ ] Create CapabilityRegistry class
- [ ] Capability interface
- [ ] Requirement parsing (from task description)
- [ ] Dependency resolution
- [ ] Persistence (wiki-based)
- [ ] Tests: 20+ unit tests

### 8b: Gap Detector

**New**: `src/core/self/gap-detector.ts`

```typescript
interface CapabilityGap {
  required: string;
  reason: string;
  suggestions: string[];
  estimatedEffort: 'small' | 'medium' | 'large';
}

class GapDetector {
  async analyzeTask(task: Task): Promise<CapabilityGap[]>;
  async canWeDoThis(request: string): Promise<{
    capable: boolean;
    gaps: CapabilityGap[];
  }>;
}
```

**Tasks**:
- [ ] Create GapDetector class
- [ ] Task analysis for required capabilities
- [ ] Gap identification
- [ ] Effort estimation
- [ ] Suggestion generation
- [ ] Tests: 15+ unit tests

### 8c: Sandbox Environment

**New**: `src/core/self/sandbox.ts`

```typescript
class SelfModificationSandbox {
  async create(): Promise<SandboxInstance>;
  async applyChanges(sandbox: SandboxInstance, changes: Change[]): Promise<void>;
  async runTests(sandbox: SandboxInstance): Promise<TestResult>;
  async merge(sandbox: SandboxInstance): Promise<MergeResult>;
  async destroy(sandbox: SandboxInstance): Promise<void>;
}
```

**Implementation**: Git worktree-based isolation

**Tasks**:
- [ ] Create SelfModificationSandbox class
- [ ] Git worktree creation/management
- [ ] Change application in sandbox
- [ ] Full test suite execution
- [ ] Safe merge to main
- [ ] Cleanup on failure/success
- [ ] Tests: 15+ unit tests

### 8d: Immune System

**New**: `src/core/self/immune-system.ts`

```typescript
interface ImmuneCheck {
  name: string;
  description: string;
  check: (before: SystemState, after: SystemState) => Promise<CheckResult>;
  severity: 'block' | 'warn';
}

class ImmuneSystem {
  checks: ImmuneCheck[];

  async validate(before: SystemState, after: SystemState): Promise<ImmuneResult>;
  async getSystemState(): Promise<SystemState>;
}
```

**Built-in checks**:
- [ ] no-regression: Tests still pass
- [ ] no-bloat: Codebase growth within budget
- [ ] no-dead-code: No unused exports added
- [ ] no-complexity-spike: Cyclomatic complexity stable
- [ ] capability-justified: New code serves stated goal

**Tasks**:
- [ ] Create ImmuneSystem class
- [ ] SystemState snapshot
- [ ] 5 built-in immune checks
- [ ] Custom check registration
- [ ] Severity-based blocking/warning
- [ ] Tests: 20+ unit tests

### 8e: Confidence Evaluator

**New**: `src/core/self/confidence-evaluator.ts`

```typescript
interface ConfidenceFactors {
  similarChangesBefore: number;     // 0-100
  testCoverage: number;             // 0-100
  scopeSize: number;                // Lines changed
  patternMatch: boolean;            // Known pattern?
  rollbackEase: 'easy' | 'medium' | 'hard';
}

class ConfidenceEvaluator {
  async evaluate(change: ProposedChange): Promise<{
    score: number;              // 0-100
    factors: ConfidenceFactors;
    recommendation: 'auto' | 'notify' | 'approve' | 'escalate';
  }>;
}
```

**Thresholds**:
- >95: Auto-approve, notify after
- 80-95: Auto-approve, notify immediately
- 60-80: Wait for approval
- <60: Escalate, don't attempt

**Tasks**:
- [ ] Create ConfidenceEvaluator class
- [ ] Factor calculation
- [ ] Historical success tracking
- [ ] Recommendation generation
- [ ] Threshold configuration
- [ ] Tests: 15+ unit tests

### 8f: Self-Modification Pipeline

**New**: `src/core/self/modification-pipeline.ts`

```typescript
class SelfModificationPipeline {
  async propose(gap: CapabilityGap): Promise<ModificationProposal>;
  async execute(proposal: ModificationProposal): Promise<ModificationResult>;

  // Full flow:
  // 1. Detect gap
  // 2. Plan modification
  // 3. Create sandbox
  // 4. Apply changes
  // 5. Run tests
  // 6. Immune system check
  // 7. Confidence evaluation
  // 8. Auto-approve or wait
  // 9. Merge or rollback
  // 10. Update capability registry
}
```

**Tasks**:
- [ ] Create SelfModificationPipeline class
- [ ] Full pipeline orchestration
- [ ] Integration with all Phase 8 components
- [ ] Notification system for approvals
- [ ] Audit logging
- [ ] Tests: 15+ unit tests

### 8g: ACIA Self-Company Integration

**Tasks**:
- [ ] ACIA registered as a "company" in Jarvis
- [ ] ACIA CEO handles self-improvement requests
- [ ] Tech Division executes modifications
- [ ] Monitoring Division tracks system health
- [ ] Tests: 10+ integration tests

### Phase 8 Success Criteria
- [ ] CapabilityRegistry accurately reflects system capabilities
- [ ] GapDetector identifies when capability is missing
- [ ] Sandbox isolates changes safely
- [ ] Immune system blocks regressions
- [ ] Confidence evaluation works correctly
- [ ] High-confidence changes auto-merge
- [ ] Low-confidence changes wait for approval
- [ ] Full self-improvement loop completes successfully
- [ ] New capability available after merge

### Phase 8 New Files
```
src/core/self/
  ├── capability-registry.ts
  ├── gap-detector.ts
  ├── sandbox.ts
  ├── immune-system.ts
  ├── confidence-evaluator.ts
  └── modification-pipeline.ts
tests/unit/
  ├── capability-registry.test.ts
  ├── gap-detector.test.ts
  ├── sandbox.test.ts
  ├── immune-system.test.ts
  ├── confidence-evaluator.test.ts
  └── modification-pipeline.test.ts
tests/integration/
  └── self-improvement.test.ts
```

### Phase 8 Test Count: ~110 new tests

---

## Phase 9: Marketing & Growth Division

**Status**: Planned (HIGH-LEVEL)

**Goal**: ACIA can market products, not just build them.

### Components

| Component | Description |
|-----------|-------------|
| ContentAgent | Blog posts, tutorials, documentation |
| SEOAgent | Search optimization |
| SocialAgent | Social media presence |
| AdsAgent | Paid campaign management |
| GrowthAnalyticsAgent | Track what works |

### Required Integrations

- CMS (headless, e.g., Sanity, Strapi)
- Social APIs (Twitter, LinkedIn)
- Analytics (Plausible, PostHog)
- Ad platforms (Google Ads, Meta Ads)

### Success Criteria

- [ ] ContentAgent publishes blog post about product
- [ ] SEOAgent optimizes page metadata
- [ ] SocialAgent schedules and posts content
- [ ] Analytics tracked and reported
- [ ] A/B testing for landing pages

### Estimated Test Count: ~80 new tests

---

## Phase 10: Support & Feedback Division

**Status**: Planned (HIGH-LEVEL)

**Goal**: ACIA handles user communication and learns from feedback.

### Components

| Component | Description |
|-----------|-------------|
| TriageAgent | Categorize incoming messages |
| ResponseAgent | Draft and send responses |
| FeedbackProcessorAgent | Extract insights |
| EscalationAgent | Route complex issues |

### Required Integrations

- Email (SendGrid, Resend)
- Chat (Intercom, Crisp)
- Feedback collection (surveys)
- Issue tracking (internal backlog)

### Success Criteria

- [ ] Auto-respond to support ticket
- [ ] Categorize as bug/question/feature request
- [ ] Extract feature requests to backlog
- [ ] Route bugs to Tech division
- [ ] Learn patterns from similar issues

### Estimated Test Count: ~70 new tests

---

## Phase 11: Finance & Portfolio Division

**Status**: Planned (HIGH-LEVEL)

**Goal**: ACIA tracks money and manages multiple products.

### Components

| Component | Description |
|-----------|-------------|
| RevenueTracker | Monitor income sources |
| CostTracker | Monitor expenses |
| ProfitabilityAnalyzer | Per-product analysis |
| ResourceAllocator | Investment decisions |
| ForecastAgent | Projections |

### Required Integrations

- Payment processors (Stripe)
- Cloud billing APIs
- LLM cost tracking (internal)

### Success Criteria

- [ ] Track revenue per product
- [ ] Track costs per product
- [ ] Calculate profitability
- [ ] Recommend resource allocation
- [ ] Generate financial reports (daily, weekly, monthly)
- [ ] Flag anomalies (cost spikes, revenue drops)

### Estimated Test Count: ~60 new tests

---

## Phase 12: Full Autonomy & Chief of Staff

**Status**: Planned (HIGH-LEVEL)

**Goal**: System runs autonomously with user as shareholder.

### Components

| Component | Description |
|-----------|-------------|
| ChiefOfStaffAgent | User's personal assistant |
| OpportunityRadar | Find new product ideas |
| PortfolioDashboard | Overview of all products |
| NotificationSystem | Reports, questions, approvals |

### Chief of Staff Capabilities

- Synthesize across all products
- Prepare decisions for user
- Filter what needs attention
- Track pending decisions
- Suggest time allocation

### Notification Types

```typescript
enum NotificationType {
  INFO,          // "Project X completed"
  REPORT,        // "Weekly status"
  QUESTION,      // "Should we use X or Y?"
  ESCALATION,    // "Blocked, need help"
  ALERT,         // "Anomaly detected"
  APPROVAL,      // "Ready to deploy, approve?"
}
```

### Success Criteria

- [ ] Weekly portfolio report generated automatically
- [ ] Chief of Staff answers "What needs my attention?"
- [ ] Opportunities identified and evaluated
- [ ] One-click approve/reject for decisions
- [ ] Products run without daily intervention
- [ ] User involvement < 5 hours/week for 5+ products

### Estimated Test Count: ~80 new tests

---

## Test Count Projections

| Phase | New Tests | Running Total |
|-------|-----------|---------------|
| 1-4 (Complete) | - | 372 |
| 5 (Complete) | 163 | 535 |
| 6 (Complete) | 471 | 1006 |
| 7 | ~90 | ~1096 |
| 8 | ~110 | ~1206 |
| 9 | ~80 | ~1286 |
| 10 | ~70 | ~1356 |
| 11 | ~60 | ~1416 |
| 12 | ~80 | ~1496 |

**Target**: 1400+ tests for full system (updated from 1100)

---

## Architecture Evolution

### Current (Phase 6)

```
User → Jarvis → CEO → Teams (Tech + Ops)
                         ├── Tech Team (PM → Dev → QA)
                         └── Ops Team (DevOps → Monitoring → Incident)
```

### Target (Phase 12)

```
User
  ↓
Chief of Staff (your agent)
  ↓
Jarvis (system orchestrator)
  ↓
┌─────────────────────────────────────────────┐
│              Companies                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │Product A│  │Product B│  │  ACIA   │    │
│  └────┬────┘  └────┬────┘  └────┬────┘    │
│       │            │            │          │
│       └────────────┴────────────┘          │
│                    │                        │
│              ┌─────┴─────┐                 │
│              │  Company  │                 │
│              │ Structure │                 │
│              └─────┬─────┘                 │
│     ┌──────────────┼──────────────┐       │
│     ↓              ↓              ↓       │
│  ┌──────┐     ┌──────┐      ┌──────┐     │
│  │ Tech │     │Market│      │  Ops │     │
│  │ Div  │     │ Div  │      │  Div │     │
│  └──────┘     └──────┘      └──────┘     │
│     ↓              ↓              ↓       │
│  ┌──────┐     ┌──────┐      ┌──────┐     │
│  │Support│    │ Sales │     │Finance│    │
│  │  Div │     │  Div  │     │  Div │     │
│  └──────┘     └──────┘      └──────┘     │
└─────────────────────────────────────────────┘
```

---

## Risk Register

| Risk | Impact | Phase | Mitigation |
|------|--------|-------|------------|
| Context overflow | High | All | Summarization, focused prompts |
| Infinite loops | High | 5-8 | Max iterations, cost caps |
| Bad code quality | Medium | 5-7 | Multiple QA passes, quality gates |
| Cost explosion | Medium | All | Token tracking, budgets |
| Security issues | High | 6 | Sandboxing, security scans |
| Self-modification bugs | High | 8 | Sandbox, immune system, rollback |
| External API changes | Medium | 9-11 | Abstraction layers, monitoring |
| User overwhelm | Medium | 12 | Chief of Staff filtering |

---

## Success Definition

**ACIA is successful when:**

1. A user can say "Build me a SaaS" and get a working, deployed product
2. The product is marketed, supported, and monitored autonomously
3. Revenue and costs are tracked automatically
4. User involvement is < 5 hours/week for portfolio of 5+ products
5. System improves itself when capability gaps are detected
6. Each project makes the system smarter

**The benchmark tests at each phase define incremental success.**
