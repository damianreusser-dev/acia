# CLAUDE.md - ACIA Project

## Project: ACIA (Autonomous Company Intelligence Architecture)

A multi-agent system that simulates a software company with autonomous agents capable of planning, developing, testing, and deploying software - including improving itself.

## Golden Rule: NO VIBE CODING

Every piece of code must:
1. Be planned before written
2. Have tests that prove it works
3. Be documented
4. Pass CI before merge
5. Actually function - not just look right

If something doesn't work → STOP → Fix it → Verify → Then continue.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 24.x + TypeScript 5.x |
| LLM | Anthropic Claude API |
| Communication | Event-driven (EventEmitter → Redis later) |
| State/Memory | File-based Wiki (Markdown) → DB later |
| Deployment | Docker Compose |
| CI/CD | GitHub Actions |
| Interface | CLI (Phase 1) → Web UI (later) |

## Repository Structure (Target)

```
acia/
├── src/
│   ├── agents/           # Agent implementations
│   │   ├── base/         # Base agent class
│   │   ├── dev/          # Developer agent
│   │   ├── qa/           # QA agent
│   │   ├── pm/           # Project Manager agent
│   │   ├── devops/       # DevOps agent
│   │   └── executive/    # CEO, Jarvis
│   ├── core/             # Core systems
│   │   ├── messaging/    # Inter-agent communication
│   │   ├── memory/       # Wiki/knowledge system
│   │   ├── tasks/        # Task management
│   │   └── llm/          # LLM integration layer
│   ├── company/          # Company structure
│   │   ├── divisions/    # Tech, etc.
│   │   └── channels/     # Communication channels
│   └── cli/              # CLI interface
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── ARCHITECTURE.md   # System design decisions
│   ├── REQUIREMENTS.md   # What we're building
│   ├── STATUS.md         # Current state, next steps
│   └── adr/              # Architecture Decision Records
├── wiki/                 # Agent knowledge base (human-readable)
├── docker/
├── .github/workflows/
├── CLAUDE.md             # This file
├── CHANGELOG.md
└── README.md
```

## Development Workflow

### For Every Feature/Change:

1. **Issue First**: Create GitHub issue with acceptance criteria
2. **Branch**: Create feature branch from `develop`
3. **Plan**: Write/update relevant docs BEFORE coding
4. **Test First**: Write failing test that defines success
5. **Implement**: Write minimal code to pass test
6. **Verify**: Run full test suite locally
7. **PR**: Create PR, CI must pass
8. **Review**: Self-review checklist (see below)
9. **Merge**: Only when everything green

### Self-Review Checklist (Before Any PR)

- [ ] All tests pass locally
- [ ] New code has tests
- [ ] No console.logs or debug code left
- [ ] Types are correct (no `any` unless justified)
- [ ] Error handling is proper
- [ ] Documentation updated if needed
- [ ] CHANGELOG updated

## Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Run in development mode
npm run build        # Build for production
npm run typecheck    # Type checking only

# Testing
npm test             # Run all tests
npm run test:unit    # Unit tests only
npm run test:int     # Integration tests only
npm run test:e2e     # E2E tests only
npm run test:watch   # Watch mode

# Quality
npm run lint         # Lint code
npm run lint:fix     # Fix lint issues
npm run format       # Format code

# Docker
docker compose up    # Start all services
docker compose up -d # Start detached
docker compose down  # Stop all services
```

## Architecture Overview

### Agent Hierarchy

```
User/Human
    │
    ▼
┌─────────┐
│ JARVIS  │ ← Universal entry point
└────┬────┘
     │ creates/manages
     ▼
┌─────────┐
│   CEO   │ ← Per-company orchestrator
└────┬────┘
     │ manages divisions
     ▼
┌─────────┐
│   PM    │ ← Division manager (Tech)
└────┬────┘
     │ assigns tasks
     ▼
┌─────────────────────┐
│ DEV │ DEVOPS │ QA   │ ← Workers
└─────────────────────┘
```

### Communication Flow

1. **Downward**: Tasks flow down the hierarchy
2. **Upward**: Reports, escalations flow up
3. **Lateral**: Agents in same division can communicate via channels
4. **Escalation**: Blocker → PM → CEO → Jarvis → Human

### Memory System

- **Wiki**: Persistent, human-readable Markdown files
- **Agent Memory**: Short-term context, long-term summaries
- **Channels**: Message history for async communication

## Current Phase: 6 - Coordination Refactor + Deployment & Operations (NOT STARTED)

### Completed Phases

**Phase 1 - Foundation** ✅
- Base Agent class with LLM integration
- CLI for user interaction
- File operations (read, write, list) with sandbox
- Code execution (run TypeScript, run tests)
- Tool loop for autonomous multi-step tasks

**Phase 2 - Basic Team** ✅
- Task system with status, priority, attempts
- DevAgent, QAAgent, PMAgent specialized agents
- Team class coordinating PM → Dev → QA workflow
- Dev → QA → Fix iteration loop with maxIterations
- E2E tests validating real LLM integration

**Phase 3 - Enhanced Capabilities** ✅
- Wiki/Memory system for agent knowledge (CRUD + search)
- Design-First development workflow
- CEO agent for higher-level orchestration
- Jarvis agent as universal entry point
- Communication channels with pub/sub messaging
- CLI upgraded to use Jarvis

**Phase 4 - Production Hardening** ✅
- Security hardening (shell injection, path traversal prevention)
- Memory bounds (conversation history, channel messages)
- LLM response caching (LRUCache with TTL)
- Structured logging (JSON format, correlation IDs)

**Phase 5 - Fullstack Capability** ✅
- ArchitectAgent for system design
- GitTools for version control
- Specialized agents (FrontendDevAgent, BackendDevAgent)
- Project templates (React, Express, Fullstack)
- Template tools for agent scaffolding
- Multi-team coordination in CEO
- Tool call enforcement (retry loop, metrics-based success)
- OpenAI native function calling support
- Benchmark test passes: creates complete fullstack todo app from single prompt
- 535 unit tests passing (+26 E2E when API key set)

### Next Milestone: Phase 6 - Coordination Refactor + Deployment & Operations
- Refactor coordination layer (ITeam interface, TeamFactory, tool permissions)
- DevOpsAgent for deployment artifacts
- Docker and cloud deployment tools
- MonitoringAgent and IncidentAgent for ops
- See docs/ROADMAP.md for details

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-01 | TypeScript over Python | Type safety, async-native, consistent tooling |
| 2026-01-01 | File-based wiki first | Human-readable, git-trackable, simple start |
| 2026-01-01 | CLI before UI | Focus on core functionality first |
| 2026-01-02 | Shared LLM client | Simpler than per-agent clients |
| 2026-01-02 | PM read-only tools | PM plans, Dev/QA execute |
| 2026-01-02 | maxIterations default 3 | Prevent infinite loops, allow fixes |
| 2026-01-02 | E2E tests skip by default | Require `RUN_E2E_TESTS=true` to avoid API costs |
| 2026-01-02 | Design-First workflow | PM creates design doc before planning tasks |
| 2026-01-02 | Jarvis as universal entry | Single point of contact for all user interactions |
| 2026-01-02 | Pub/Sub channels | Flexible agent communication without tight coupling |
| 2026-01-02 | Smart task routing | Jarvis handles simple tasks directly, delegates complex ones |

## Notes for Claude

### DO:
- Ask clarifying questions before implementing
- Write tests before or with code
- Update STATUS.md after significant progress
- Create GitHub issues for discovered work
- Stop and fix if something breaks
- Run `npm test` after every change
- Use `npm run typecheck` to catch type errors early

### DON'T:
- Write code without tests
- Skip error handling
- Use `any` type without comment explaining why
- Merge with failing tests
- Add features not in current phase scope
- Assume something works - verify it

### When Stuck:
1. Document the blocker in STATUS.md
2. Check if it's a scope issue (maybe defer to later phase)
3. Ask human for input if architectural decision needed

## Code Quality Standards (MUST FOLLOW)

These standards prevent "vibe coding" - code that looks right but has subtle bugs.

### Security (CRITICAL)

**Never use shell: true with user input:**
```typescript
// BAD - shell injection vulnerability
spawn('npm', ['run', userInput], { shell: true });

// GOOD - use array args, avoid shell
spawn('npm', ['run', sanitizedScript], { shell: false });
spawn('npm', ['run', script]); // shell: false is default
```

**Always validate inputs at boundaries:**
```typescript
// BAD - trust user input
const script = args.script;
execCommand(script);

// GOOD - validate against allowlist
const ALLOWED_SCRIPTS = ['test', 'build', 'lint'] as const;
if (!ALLOWED_SCRIPTS.includes(script)) {
  throw new Error(`Invalid script: ${script}`);
}
```

### Type Safety (REQUIRED)

**Validate regex match groups before use:**
```typescript
// BAD - match[1] can be undefined, crashes at runtime
const match = text.match(/pattern: (\w+)/);
const value = match[1]; // TypeScript allows, runtime explodes

// GOOD - explicit null checks
const match = text.match(/pattern: (\w+)/);
if (match && match[1]) {
  const value = match[1];
}
```

**Validate before type assertions:**
```typescript
// BAD - blindly trust cast
const config = data as Config;

// GOOD - validate shape first
if (isValidConfig(data)) {
  const config = data;
}

// Or use runtime validation library (zod, etc.)
```

**No implicit any in callbacks:**
```typescript
// BAD - arr is any[]
array.map(item => item.value);

// GOOD - explicit types
array.map((item: MyType) => item.value);
```

### Memory Management (IMPORTANT)

**Bound all growing collections:**
```typescript
// BAD - grows forever, memory leak
private history: Message[] = [];
addMessage(msg: Message) {
  this.history.push(msg);
}

// GOOD - cap size, rotate old entries
private readonly MAX_HISTORY = 1000;
addMessage(msg: Message) {
  this.history.push(msg);
  if (this.history.length > this.MAX_HISTORY) {
    this.history.shift();
  }
}
```

**Clear references when done:**
```typescript
// In long-running processes, clean up
destroy() {
  this.handlers.clear();
  this.subscriptions.clear();
}
```

### Code Organization (BEST PRACTICE)

**Extract magic numbers as constants:**
```typescript
// BAD - magic numbers scattered
if (attempts > 3) { ... }
setTimeout(fn, 30000);

// GOOD - named constants at top
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 30_000;

if (attempts > MAX_RETRY_ATTEMPTS) { ... }
setTimeout(fn, DEFAULT_TIMEOUT_MS);
```

**Keep methods under 50 lines:**
```typescript
// BAD - 150 line method doing everything
async processTask(task: Task) {
  // ... 150 lines of nested logic
}

// GOOD - decomposed into focused methods
async processTask(task: Task) {
  const plan = await this.createPlan(task);
  const result = await this.executePlan(plan);
  return this.formatResult(result);
}
```

**Don't suppress linter warnings without reason:**
```typescript
// BAD - hide problems
// eslint-disable-next-line
const x = something;

// GOOD - if truly needed, explain why
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for API compatibility
const _legacyParam = param;
```

### Error Handling (REQUIRED)

**Never swallow errors silently:**
```typescript
// BAD - error disappears
try {
  await riskyOperation();
} catch {
  // nothing
}

// GOOD - at minimum, log it
try {
  await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  // re-throw, return error result, or handle gracefully
}
```

**Use specific error types:**
```typescript
// BAD - generic error, hard to handle
throw new Error('Failed');

// GOOD - typed errors for different cases
class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}
throw new ValidationError('email', 'Invalid email format');
```

### Testing Standards (REQUIRED)

**Test the edge cases, not just happy path:**
```typescript
describe('parseInput', () => {
  it('parses valid input', () => { ... });           // Happy path
  it('handles empty input', () => { ... });          // Edge case
  it('handles null/undefined', () => { ... });       // Edge case
  it('rejects invalid format', () => { ... });       // Error case
  it('handles unicode characters', () => { ... });   // Edge case
});
```

**Mock at boundaries, not internals:**
```typescript
// BAD - mocking internal methods, brittle tests
vi.spyOn(service, 'privateHelper').mockReturnValue(...);

// GOOD - mock external boundaries (LLM, file system, network)
const mockLLMClient = { chat: vi.fn() };
const service = new Service({ llmClient: mockLLMClient });
```

## Learned Patterns (from Phase 1-5)

### Testing Patterns

**Mock LLM responses with counter for iteration tests:**
```typescript
let callCount = 0;
mockLLMClient.chat = vi.fn().mockImplementation(() => {
  callCount++;
  if (callCount === 1) return { content: 'First response...' };
  if (callCount === 2) return { content: 'Second response...' };
  return { content: 'Default response...' };
});
```

**E2E tests need long timeouts:**
```typescript
it('should complete workflow', async () => {
  // Real LLM calls take 20-160 seconds
  // Full agent flows can take 5+ minutes (many LLM calls)
}, { timeout: 300000 }); // 5 minutes for complex flows
```

**Test smart agent behavior:**
```typescript
// Agents may handle tasks directly without full hierarchy
// This is GOOD - simple tasks don't need full company structure
it('handles simple task directly', async () => {
  const result = await jarvis.processRequest('Create hello.txt');
  expect(result.success).toBe(true);
  // Don't assert newCompanyCreated - Jarvis may be smart enough to do it directly
});
```

### Code Patterns

**Always guard regex match groups:**
```typescript
// BAD - match[1] can be undefined
const value = match[1];

// GOOD - guard against undefined
if (match && match[1] && match[2]) {
  const value = match[1];
}
```

**Use callbacks for long-running workflows:**
```typescript
const team = new Team({
  onProgress: (msg) => console.log(`[Progress] ${msg}`),
  onEscalation: (reason) => console.log(`[Escalation] ${reason}`),
});
```

**Always have iteration limits:**
```typescript
// Prevent infinite loops in retry/fix cycles
maxIterations: 3,
maxRetries: 2,
```

**Avoid private property name conflicts in inheritance:**
```typescript
// BAD - base class has private llmClient
class ChildAgent extends Agent {
  private llmClient: LLMClient; // Conflict!
}

// GOOD - use unique names if you need local reference
class ChildAgent extends Agent {
  private childLLMClient: LLMClient;
  // Or just use the inherited one via this.llmClient
}
```

### LLM Integration Patterns

**Parse tool calls flexibly:**
- LLM output format varies - handle multiple formats
- Use clear delimiters in prompts (`<tool_call>`, `DEV_TASKS:`, etc.)
- Always have fallback for unparseable responses

**Task planning with LLM:**
- Provide clear structure in system prompt
- Request specific output format
- Parse with regex, not JSON (more flexible)

### Agent Workflow Patterns

**Design-First Development:**
```typescript
// PM creates design doc BEFORE planning tasks
async planTask(task: Task): Promise<TaskBreakdown> {
  const designDoc = await this.createDesignDoc(task);
  const breakdown = await this.createTaskBreakdown(task, designDoc);
  return breakdown;
}
```

**Escalation chain:**
```
Dev/QA fails → PM retries → CEO handles → Jarvis escalates → Human
```

**Smart task routing:**
```typescript
// Not everything needs full hierarchy
// Jarvis can handle simple requests directly
if (this.isSimpleRequest(request)) {
  return await this.handleDirectly(request);
}
// Complex requests go to companies/CEOs
return await this.delegateToCompany(request);
```

### File Organization

**Test file naming:**
- Unit tests: `tests/unit/{component}.test.ts`
- Integration: `tests/integration/{workflow}.test.ts`
- E2E: `tests/e2e/{feature}-e2e.test.ts`
- Benchmarks: `tests/e2e/benchmarks/{capability}.test.ts`

**Source organization:**
```
src/agents/{type}/          # Agent implementations
src/agents/{type}/index.ts  # Re-exports
src/core/{system}/          # Core systems (tasks, llm, tools)
src/team/                   # Team coordination
src/templates/              # Project scaffolding templates
```

### Template & Scaffolding Patterns (Phase 5)

**Template structure must match external expectations:**
```typescript
// BAD - creates sibling directories (non-standard)
// Creates: project-frontend/, project-backend/

// GOOD - creates subdirectories (industry standard)
// Creates: project/frontend/, project/backend/
await createFullstackProject(outputDir, {
  projectName: 'todo-app',
});
// Result: todo-app/frontend/, todo-app/backend/, todo-app/README.md
```

**Agents need to know about available tools in their system prompt:**
```typescript
// BAD - agent has template tools but doesn't know about them
const DEV_PROMPT = `You are a developer...
Available tools: read_file, write_file, run_code`;

// GOOD - system prompt mentions all relevant tools
const DEV_PROMPT = `You are a developer...
Available tools:
- read_file, write_file, run_code
- generate_project (scaffold from templates: react, express, fullstack)
- list_templates, preview_template`;
```

**Tool parameter format must be arrays, not objects:**
```typescript
// BAD - TypeScript error: parameters as object
definition: ToolDefinition = {
  name: 'my_tool',
  parameters: {
    param1: { type: 'string', required: true }  // WRONG!
  }
};

// GOOD - parameters as array of ToolParameter
definition: ToolDefinition = {
  name: 'my_tool',
  parameters: [
    { name: 'param1', type: 'string', required: true, description: '...' }
  ]
};
```

**Entry point naming matters for benchmarks:**
```typescript
// Express template should use src/index.ts (industry standard)
// Not src/server.ts (non-standard)
// Keep legacy file for backwards compatibility:
// src/server.ts -> re-exports from index.ts
```

### Benchmark Testing Patterns (Phase 5)

**E2E benchmark tests need LONG timeouts:**
```typescript
it('should create fullstack app', async () => {
  // This involves: Jarvis → CEO → Team → Dev → QA
  // Multiple LLM calls, each 10-60+ seconds
  // Total can be 5-10 minutes
}, 600000); // 10 minute timeout

// Simple LLM call still needs reasonable timeout
it('should handle ambiguous input', async () => {
  await jarvis.handleRequest('Build me an app');
}, 60000); // 1 minute, not 5 seconds!
```

**Benchmark tests verify the entire system:**
```typescript
// Benchmark tests are end-to-end integration tests
// They verify:
// 1. Request reaches Jarvis
// 2. Company/CEO created correctly
// 3. Teams wired up with tools
// 4. Agents execute tasks
// 5. Files actually created
// 6. Code compiles (npm install, tsc)
// 7. Tests pass (npm test)
// 8. Server runs (starts on correct port)
```

**Workspace-based agent initialization for benchmarks:**
```typescript
// Agents need workspace to auto-create tools
const jarvis = new JarvisAgent({
  workspace: BENCHMARK_WORKSPACE,  // Required for auto-tool creation
  wikiService: wiki,
});
// Tools are auto-created: file tools, exec tools, git tools, template tools
```

## Expanded Vision Conventions (Phases 6-12)

### Company Division Structure

ACIA will evolve beyond a Tech Division to include full company operations:

| Division | Purpose | Key Agents |
|----------|---------|------------|
| Tech | Build products | Dev, QA, DevOps, Architect |
| Marketing | Grow audience | Content, SEO, Social, Ads |
| Sales | Convert users | Outreach, Demo, Closing |
| Support | Help users | Triage, Response, Feedback |
| Operations | Run business | Monitoring, Incident, SLA |
| Finance | Track money | Revenue, Cost, Forecast |

**Division Pattern:**
```typescript
interface Division {
  name: string;
  purpose: string;
  agents: Agent[];
  kpis: KPI[];              // How we measure success
  escalationPath: Agent;    // Who to escalate to
}
```

### Confidence-Based Autonomy

For self-improvement and critical decisions, use confidence scoring:

```
Confidence > 95%: Auto-approve, notify after
Confidence 80-95%: Auto-approve, notify immediately
Confidence 60-80%: Propose plan, wait for approval
Confidence < 60%: Escalate to user, don't attempt
```

**Pattern:**
```typescript
interface ConfidenceScore {
  score: number;           // 0-100
  reasoning: string;       // Why this confidence level
  risks: string[];         // What could go wrong
  mitigations: string[];   // How we'd handle failures
}
```

### Product Lifecycle States

Products managed by ACIA follow this lifecycle:

```
Concept → Building → Launching → Growing → Mature → Declining → Sunset
```

Each state has different attention levels and resource allocation.

### Self-Improvement Pattern

When ACIA modifies itself:

1. **Gap Detection**: Identify capability we lack
2. **Sandbox**: Create isolated branch/environment
3. **Implementation**: Make changes in sandbox
4. **Testing**: Full test suite + regression checks
5. **Immune System**: Verify no bloat, no regressions
6. **Merge**: Only if all checks pass
7. **Notify**: User informed based on confidence level

### QA Context Isolation

QA agents must NOT share context with Dev agents:

```typescript
// GOOD - Fresh QA context
const qaAgent = new PersonaQAAgent({
  persona: 'first-time-user',
  context: {
    requirement: originalRequirement,  // Only original task
    appAccess: runningAppUrl,          // Access to deployed app
    // NO dev implementation details
    // NO design decisions
    // NO code context
  }
});

// BAD - Shared context (defeats purpose)
const qaAgent = new QAAgent({
  context: devAgent.getContext()  // Shares blind spots!
});
```

### User as Shareholder Model

User interaction should follow this pattern:

- **High attention**: New product launches, critical decisions
- **Regular check-ins**: Growing products, weekly reports
- **Hands-off**: Mature products, exception-based alerts
- **Reports**: Weekly portfolio summaries, revenue updates

### Revenue Flywheel

Track the investment-return cycle:

```
Investment (User $) → ACIA Resources → Products Built →
Revenue Generated → Reinvest → Better ACIA → More/Better Products
```

Every product should track: revenue, costs, profitability, trend.

## Quick Commands

```bash
# Run everything
npm test                    # All tests (unit + integration + e2e skipped)
npm run typecheck           # Type checking

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:int            # Integration tests only
RUN_E2E_TESTS=true npm run test:e2e  # E2E with real API

# Run benchmarks (requires API key, takes 5-10 minutes)
RUN_E2E_TESTS=true npm run test:e2e -- tests/e2e/benchmarks/fullstack-capability.test.ts

# Watch mode for development
npm run test:watch

# Before committing
npm test && npm run lint && npm run typecheck
```
