# ACIA Project Status

**Last Updated**: 2026-01-02

## Current Phase: 3 - Enhanced Capabilities (IN PROGRESS)

### Phase 1 - COMPLETED

#### Phase 1a - Basic Agent Communication
- [x] Project structure created
- [x] TypeScript configuration with strict mode
- [x] ESLint + Prettier setup
- [x] Vitest test framework
- [x] GitHub Actions CI pipeline
- [x] Base Agent class with LLM integration
- [x] LLMClient wrapper for Anthropic API
- [x] Basic CLI with REPL

#### Phase 1b - Agent File Operations
- [x] Tool system architecture (ToolDefinition, ToolResult, Tool interface)
- [x] ReadFileTool - Read files from workspace
- [x] WriteFileTool - Write files with auto-directory creation
- [x] ListDirectoryTool - List directory contents
- [x] Sandbox security preventing directory traversal

#### Phase 1c - Agent Code Execution
- [x] RunNpmScriptTool - Run allowed npm scripts
- [x] RunTestFileTool - Run specific test files with vitest
- [x] RunCodeTool - Execute TypeScript/JavaScript files
- [x] processMessageWithTools() - Automatic tool execution loop
- [x] parseToolCall() - Extract tool calls from LLM responses
- [x] Max iteration protection against infinite loops

### Phase 2 - Basic Team (COMPLETED)

#### Phase 2a - Agent Types + Task System (COMPLETED)
- [x] Task interface with status, priority, attempts, results
- [x] createTask() factory with sensible defaults
- [x] canRetry() and isTerminal() utility functions
- [x] DevAgent - Specialized for implementing code
- [x] QAAgent - Specialized for testing and review
- [x] PMAgent - Coordinates work, plans tasks, handles escalation
- [x] TaskBreakdown for splitting work into dev/QA subtasks
- [x] Task tracking and status management in PMAgent

#### Phase 2b - Agent Communication (COMPLETED)
- [x] Team class to coordinate PM, Dev, QA agents
- [x] PM assigns tasks to Dev/QA based on execution order
- [x] Synchronous task execution through workflow
- [x] Result reporting back to PM with retry/escalate decisions
- [x] PM gets read-only tools, Dev/QA get all tools
- [x] Integration test demonstrating full workflow

#### Phase 2c - Workflow Loop (COMPLETED)
- [x] Dev → QA → Fix iteration loop
- [x] Automatic fix task creation when QA fails
- [x] QA task reset for re-testing after fixes
- [x] maxIterations limit to prevent infinite loops
- [x] onEscalation callback for notifications
- [x] onProgress callback for status updates
- [x] Escalation when max iterations exceeded
- [x] E2E tests with real Anthropic API
- [x] **Total: 122 tests passing (+ 2 E2E when API key set)**

### Phase 3 - Enhanced Capabilities (IN PROGRESS)

#### Phase 3a - Wiki/Memory System (COMPLETED)
- [x] WikiService with CRUD operations
- [x] Wiki page read, write, append, delete
- [x] Directory listing and search
- [x] Sandbox security (path traversal prevention)
- [x] Wiki Tools for agents (read_wiki, write_wiki, append_wiki, search_wiki, list_wiki)
- [x] Team integration with optional WikiService
- [x] PM gets read-only wiki tools (read, search, list)
- [x] Dev/QA get full wiki tools
- [x] Task completion logging to wiki
- [x] **46 new tests (27 WikiService + 15 WikiTools + 4 integration)**

#### Phase 3b - Design-First Development (Next)
- [ ] Design doc creation before implementation
- [ ] PM creates design doc in wiki
- [ ] Dev implements against design doc
- [ ] QA tests against design doc

#### Phase 3c - Company Structure
- [ ] CEO agent for higher-level orchestration
- [ ] Jarvis agent as universal entry point
- [ ] Communication channels between agents

### Blocked
None

---

## Recent Changes

### 2026-01-02 (Phase 3a - Wiki System)
- Added WikiService with full CRUD + search
- Wiki tools for agents (read, write, append, search, list)
- Team integration with optional wiki support
- PM gets read-only wiki access, Dev/QA get full access
- Task completion logging to wiki
- 46 new tests, total now 168

### 2026-01-02 (E2E Tests)
- Added E2E test suite for real LLM validation
- DevAgent E2E: Creates files with real Anthropic API
- Team E2E: Full PM → Dev → QA workflow verified
- Tests skip by default, run with `RUN_E2E_TESTS=true`

### 2026-01-02 (Phase 2c)
- **Phase 2 COMPLETE**
- Added Dev → QA → Fix iteration loop to Team
- Automatic fix task creation when QA tests fail
- maxIterations parameter to limit loop iterations
- onEscalation callback for external notification
- onProgress callback for status updates
- 7 new tests for iteration and callback functionality

### 2026-01-02 (Phase 2b)
- Created Team class for agent coordination
- Implemented executeTask() workflow with planning, execution, and verification
- Added retry logic with PM feedback
- Added escalation when max retries exceeded
- 11 unit tests for Team + 3 integration tests

### 2026-01-02 (Phase 2a)
- Created Task system with types and utilities
- Implemented DevAgent extending base Agent
- Implemented QAAgent extending base Agent
- Implemented PMAgent with task planning and tracking
- Added 45 new tests (14 task types + 9 dev + 9 qa + 13 pm)

### 2026-01-01
- **Phase 1 COMPLETE**
- Implemented full agent tool system
- Agent can now autonomously:
  - Write files
  - Execute code
  - Run tests
  - Iterate based on results

---

## Decisions Made

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-01 | Fresh start over legacy code | Old code was vibe coded without tests |
| 2026-01-01 | TypeScript + Vitest | Type safety and modern testing |
| 2026-01-01 | Phase 1a/1b/1c split | Smaller verifiable steps |
| 2026-01-01 | Tool system with interfaces | Extensible, testable design |
| 2026-01-01 | Tool execution loop in Agent | Enables autonomous multi-step tasks |
| 2026-01-02 | Shared LLM client between agents | Simpler, works for our use case |
| 2026-01-02 | Shared workspace for all agents | Team works on same codebase |
| 2026-01-02 | PM uses LLM for task planning | Better task breakdown than hardcoded rules |
| 2026-01-02 | 3 retries before escalation | Balance between persistence and escalation |
| 2026-01-02 | Team class as workflow coordinator | Clean separation of orchestration from agents |
| 2026-01-02 | PM read-only, Dev/QA full tools | PM plans, workers execute |
| 2026-01-02 | Iteration loop with fix tasks | QA failures create dev fix tasks automatically |
| 2026-01-02 | Callbacks for escalation/progress | Allow external systems to react to workflow events |
| 2026-01-02 | File-based wiki (Markdown) | Human-readable, git-trackable, simple |
| 2026-01-02 | PM read-only wiki, Dev/QA full | PM plans with context, workers document |
| 2026-01-02 | Wiki optional in Team | Backward compatible, gradual adoption |

---

## Known Issues

1. **CLI pipe input on Windows**: Works fine in interactive mode.
2. **Deprecation warning**: spawn with shell option - safe for our use case.

---

## Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Test Coverage | >80% | TBD |
| Unit Tests | All pass | 154/154 |
| Integration Tests | All pass | 13/13 |
| E2E Tests | All pass | 2/2 (when API key set) |
| Total Tests | All pass | 168 (+2 E2E) |
| CI Status | Passing | Passing |

---

## Architecture Summary

```
User
  │
  ▼
┌─────────────────────────────────────────────┐
│                   Team                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ PMAgent │  │DevAgent │  │ QAAgent │     │
│  │(plans)  │  │(codes)  │  │(tests)  │     │
│  └────┬────┘  └────┬────┘  └────┬────┘     │
│       │            │            │           │
│       └────────────┼────────────┘           │
│                    │                        │
│              Shared Tools                   │
│  (read_file, write_file, run_code, etc.)   │
└─────────────────────────────────────────────┘
```

**Workflow:**
1. User submits task to Team
2. PM plans task into dev/QA subtasks
3. Dev implements features
4. QA tests implementation
5. If QA fails → Dev fixes → QA retests (loop)
6. If max iterations → Escalate
7. Return WorkflowResult with all details
