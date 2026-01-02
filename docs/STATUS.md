# ACIA Project Status

**Last Updated**: 2026-01-02

## Current Phase: 5 - Fullstack Capability (IN PROGRESS)

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

### Phase 3 - Enhanced Capabilities (COMPLETED)

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

#### Phase 3b - Design-First Development (COMPLETED)
- [x] Design doc creation before implementation
- [x] PM creates design doc in wiki before planning
- [x] DesignDoc interface with overview, requirements, approach, acceptance criteria
- [x] Design doc parsing from LLM response
- [x] Design doc reference included in task breakdown
- [x] Planning prompt includes design doc context
- [x] Backward compatible - works without wiki
- [x] **13 new tests (9 unit + 4 integration)**

#### Phase 3c - Company Structure (COMPLETED)
- [x] CEO agent for higher-level orchestration
- [x] Jarvis agent as universal entry point
- [x] Communication channels between agents
- [x] Channel with pub/sub messaging
- [x] ChannelManager for multiple channels
- [x] Message history and threading
- [x] Company management in Jarvis
- [x] Human escalation callbacks
- [x] **84 new tests (19 CEO + 22 Jarvis + 43 Channel)**

### Phase 4 - Production Hardening (COMPLETED)

#### Phase 4a - Security Hardening (COMPLETED)
- [x] Shell injection prevention (shell: false on Unix, pre-validated on Windows)
- [x] Path traversal prevention for all exec tools
- [x] Input sanitization (dangerous character blocklist)
- [x] Null byte injection prevention
- [x] Absolute path rejection
- [x] Workspace boundary enforcement
- [x] Memory bounds for Agent conversation history (MAX_HISTORY_SIZE = 100)
- [x] Memory bounds for Channel message history (configurable, default 1000)
- [x] Channel.destroy() for cleanup
- [x] Single-pass filter optimization for getHistory()
- [x] **33 new tests (24 security + 9 memory bounds)**

#### Phase 4b - Performance Optimization (COMPLETED)
- [x] LLM response caching (LRUCache with TTL, key generation)
- [x] LLMResponseCache for semantic caching of API responses
- [x] Cache statistics (hits, misses, hit rate, evictions)
- [x] Configurable cache size and TTL
- [x] **29 new tests (cache module)**

#### Phase 4c - Monitoring & Observability (COMPLETED)
- [x] Structured logging (JSON format with Logger class)
- [x] Log levels (debug, info, warn, error) with filtering
- [x] Component-based logging with child loggers
- [x] Correlation IDs for request tracing
- [x] withCorrelationId() async context helper
- [x] Performance metrics collector (singleton)
- [x] LLM metrics (latency, tokens, errors, cache hits)
- [x] Tool execution metrics (latency, success/error)
- [x] Timed logging for operations
- [x] **44 new tests (23 logging + 21 metrics)**

### Phase 5 - Fullstack Capability (IN PROGRESS)

**Goal**: ACIA can create complete fullstack applications from a single prompt.

**Benchmark**: `tests/e2e/benchmarks/fullstack-capability.test.ts`

#### Phase 5a - Architecture Foundation (COMPLETED)
- [x] ArchitectAgent for system design and API contracts
- [x] SystemDesign interface with overview, file structure, API contracts, data models
- [x] ApiContract interface for endpoint definitions
- [x] CommunicationConfig for protocol, ports, CORS settings
- [x] TechStackChoice for technology decisions
- [x] Wiki integration for design documents
- [x] **26 new tests (ArchitectAgent)**
- [x] GitTools for version control operations
- [x] git_init, git_add, git_commit, git_status, git_branch, git_log tools
- [x] Security: path validation, message sanitization, shell: false
- [x] **34 new tests (GitTools)**

#### Phase 5c - Specialized Agents & Templates (COMPLETED)
- [x] FrontendDevAgent (React/TypeScript specialist)
- [x] BackendDevAgent (Node/Express specialist)
- [x] Keyword-based agent selection in Team
- [x] Project templates (React + Vite, Express)
- [x] TemplateService for project scaffolding
- [x] createFullstackProject() for combined projects
- [x] Multi-team coordination in CEO (executeGoalMultiTeam)
- [x] Parallel team execution with result aggregation
- [x] JarvisAgent.handleRequest() for benchmarks
- [x] **82 new tests (26 specialized agents + 18 templates + 10 team selection + 6 CEO multi-team + 3 Jarvis handleRequest + 19 existing team tests)**

#### Phase 5b - Git Integration (COMPLETED)
- [x] GitInitTool - Initialize git repositories
- [x] GitAddTool - Stage files for commit
- [x] GitCommitTool - Commit with sanitized messages
- [x] GitStatusTool - Repository status
- [x] GitBranchTool - List, create, switch branches
- [x] GitLogTool - Commit history
- [x] createGitTools() factory function
- [x] Path traversal prevention
- [x] Shell injection prevention via sanitization

#### Phase 5d - Benchmark Infrastructure (COMPLETED)
- [x] Workspace-based JarvisAgent initialization
- [x] Auto-creation of tools from workspace path
- [x] CEO → Team wiring on company creation
- [x] Automatic frontend/backend teams for fullstack domains
- [x] getMetrics() for token and request tracking
- [x] getWorkspace() accessor
- [x] **5 new tests (workspace mode, metrics tracking)**

#### Phase 5e - Template Tools (COMPLETED)
- [x] list_templates tool to list available project templates
- [x] generate_project tool to scaffold projects from templates
- [x] preview_template tool to preview template structure
- [x] Fullstack template support (React + Express combined)
- [x] Template tools auto-included in Jarvis workspace mode
- [x] **11 new tests (template tools)**

#### Phase 5f - Template Structure Fix (COMPLETED)
- [x] Fullstack projects create frontend/ and backend/ subdirectories (not sibling dirs)
- [x] Root README.md generated with project overview
- [x] Express template entry point changed to src/index.ts (industry standard)
- [x] Legacy src/server.ts kept for backwards compatibility
- [x] Benchmark test timeout updated for ambiguous requirements (60s)

#### Phase 5g - Agent Prompt Updates (COMPLETED)
- [x] DevAgent system prompt mentions template tools
- [x] FrontendDevAgent system prompt mentions template tools
- [x] BackendDevAgent system prompt mentions template tools
- [x] Agents now know how to use generate_project for scaffolding

**Success Criteria**:
- [ ] Benchmark test passes (todo app with React + Express)
- [ ] All generated code compiles
- [ ] All generated tests pass
- [ ] API endpoints work correctly

### Blocked
None

---

## Recent Changes

### 2026-01-02 (Phase 5f/5g - Template Fixes & Agent Prompts)
- Fixed fullstack template structure to match benchmark expectations
  - Projects now create frontend/ and backend/ subdirectories
  - Root README.md with project overview and setup instructions
- Updated Express template entry point to src/index.ts
  - Matches industry standard expectations
  - Legacy src/server.ts kept for backwards compatibility
- Updated agent system prompts to mention template tools
  - DevAgent, FrontendDevAgent, BackendDevAgent all updated
  - Agents now know about list_templates, generate_project, preview_template
- Updated benchmark test timeout for ambiguous requirements (5s → 60s)
- **Total: 492 tests (+8 E2E when API key set)**

### 2026-01-02 (Phase 5e - Template Tools)
- Added template tools for agent-driven scaffolding
  - list_templates: List available project templates
  - generate_project: Scaffold projects from templates
  - preview_template: Preview template structure
- Fullstack template creates both React and Express projects
- Jarvis auto-includes template tools in workspace mode
- Added 11 new tests for template tools
- **Total: 511 tests (+8 E2E when API key set)**

### 2026-01-02 (Phase 5d - Benchmark Infrastructure)
- Enhanced JarvisAgent for benchmark testing
  - Workspace-based initialization (auto-creates tools)
  - Auto-wires CEO with Teams on company creation
  - Creates frontend/backend teams for fullstack domains
  - getMetrics() for token usage and request tracking
- Improved company creation flow
  - Default team always created
  - Specialized teams for web/fullstack/application domains
- Added 5 new tests for workspace and metrics functionality
- **Total: 500 tests (+8 E2E when API key set)**

### 2026-01-02 (Phase 5c - Specialized Agents & Templates)
- Added FrontendDevAgent (React/TypeScript specialist)
  - UI-focused system prompt
  - React component expertise
  - Accessibility and responsive design knowledge
- Added BackendDevAgent (Node/Express specialist)
  - API-focused system prompt
  - REST and database expertise
  - Security and performance focus
- Added keyword-based agent selection to Team
  - Frontend keywords: react, component, tsx, jsx, ui, css, tailwind, etc.
  - Backend keywords: api, endpoint, route, express, database, etc.
  - Explicit agent type override via task context
  - Falls back to general DevAgent for ambiguous tasks
- Added project template system
  - React template: Vite + TypeScript + Vitest + testing-library
  - Express template: TypeScript + cors + helmet + health routes
  - TemplateService for preview and generation
  - createFullstackProject() for combined projects
- Enhanced CEO with multi-team coordination
  - executeGoalMultiTeam() for parallel team execution
  - LLM-based project assignment to teams
  - Result aggregation across teams
  - getCoordinationStatus() for monitoring
- Added JarvisAgent.handleRequest() for benchmark compatibility
- Added 82 new tests
- **Total: 495 tests (+8 E2E when API key set)**

### 2026-01-02 (Phase 5a - Architecture Foundation)
- Added ArchitectAgent for system design
  - Creates comprehensive SystemDesign documents
  - Parses API contracts from LLM response
  - Extracts data models (TypeScript interfaces)
  - Generates file structure plans
  - Identifies technology stack choices
  - Writes designs to wiki when available
- Added GitTools for version control
  - GitInitTool: Initialize repositories
  - GitAddTool: Stage files
  - GitCommitTool: Commit with message sanitization
  - GitStatusTool: Check repository status
  - GitBranchTool: List, create, switch branches
  - GitLogTool: View commit history
  - createGitTools() factory function
- Security hardening for git operations
  - Path traversal prevention
  - Commit message sanitization (removes shell chars)
  - shell: false for all spawn calls
- Created vision and roadmap documents
  - docs/VISION.md - Autonomous AI factory vision
  - docs/ROADMAP.md - Phase 5-8 implementation plan
  - docs/COORDINATION.md - Multi-team coordination strategy
- Added benchmark tests for fullstack capability
  - tests/e2e/benchmarks/fullstack-capability.test.ts
  - Defines success criteria for Phase 5
- Added 60 new tests (26 ArchitectAgent + 34 GitTools)
- **Total: 413 tests (+ 7 E2E when API key set)**

### 2026-01-02 (Phase 4b/4c - Performance & Observability)
- Added structured logging infrastructure
  - Logger class with JSON and pretty output formats
  - Log levels (debug, info, warn, error) with filtering
  - Component-based logging with child() method
  - Timed logging for performance tracking
- Added correlation ID system for request tracing
  - setCorrelationId() / getCorrelationId()
  - withCorrelationId() async context helper
  - Automatically attached to all log entries
- Added performance metrics collector
  - LLM metrics: request count, tokens, latency (avg/min/max), errors, cache hits
  - Tool execution metrics: count, success/error, latency
  - Snapshot API for dashboard/monitoring
  - Singleton pattern with reset for testing
- Added LLM response caching
  - LRUCache with configurable max size and TTL
  - Automatic eviction of oldest entries
  - Cache key generation from request parameters
  - LLMResponseCache for semantic API caching
  - Integrated into LLMClient (optional, disabled by default)
- Updated LLMClient with metrics, logging, and optional caching
  - Records latency and token usage automatically
  - Logs debug info with correlation IDs
  - getCacheStats() and clearCache() methods
- Added 73 new tests
  - 29 cache tests (LRU, TTL, eviction, stats)
  - 23 logging tests (levels, metadata, correlation)
  - 21 metrics tests (LLM, tools, snapshots)
- **Total: 372 tests (+ 7 E2E when API key set)**

### 2026-01-02 (Phase 4a - Security Hardening)
- Fixed shell injection vulnerability in exec-tools.ts
  - Uses shell: false on Unix systems
  - On Windows, pre-validates all args before shell execution
  - Added dangerous character blocklist (;&|`$(){}[]<>!#*?\\'" etc.)
  - Added null byte injection prevention
  - Added absolute path rejection
- Fixed path traversal in all execution tools
  - RunTestFileTool now validates paths against workspace
  - RunCodeTool already had protection, now enhanced
  - Consistent isPathWithinWorkspace() check
- Added memory bounds to prevent leaks
  - Agent conversation history capped at 100 messages
  - Channel message history configurable (default 1000)
  - Added Channel.destroy() for cleanup
  - Optimized getHistory() with single-pass filtering
- Added comprehensive security test suite
  - 24 security tests (path traversal, injection, validation)
  - 9 memory bounds tests
- **Total: 299 tests (+ 7 E2E when API key set)**

### 2026-01-02 (CLI Upgrade + Full E2E Validation)
- Upgraded CLI to use Jarvis as universal entry point
  - Workspace-aware (uses current directory)
  - Wiki support (.acia-wiki folder)
  - Commands: /status, /clear, /exit
  - Human escalation display
  - Timing and status info
- Added Jarvis E2E tests with real API
  - Full flow: Jarvis → CEO → Team → Dev/QA
  - Validated Design-First workflow end-to-end
  - 4 new E2E tests
- **Total: 266 tests (+ 7 E2E when API key set)**

### 2026-01-02 (Phase 3c - Company Structure)
- Added CEOAgent for high-level orchestration
  - Manages Teams, breaks goals into projects
  - Handles escalations from PM
  - Logs goal completion to wiki
- Added JarvisAgent as universal entry point
  - Routes requests to appropriate companies/CEOs
  - Creates new companies for new domains
  - Status reporting across all companies
  - Conversation tracking
- Added Communication Channels
  - Channel with pub/sub messaging
  - Topic-based message routing
  - Message history with filtering
  - Thread support for conversations
  - ChannelManager for multiple channels
- 84 new tests (19 CEO + 22 Jarvis + 43 Channel)

### 2026-01-02 (Phase 3b - Design-First Development)
- Added DesignDoc interface for structured design docs
- PMAgent creates design doc before planning when wiki available
- Design doc includes overview, requirements, approach, acceptance criteria
- Design doc written to wiki in `designs/` directory
- Planning prompt includes design doc context for better task alignment
- TaskBreakdown now includes designDoc reference
- 13 new tests (9 unit + 4 integration)
- **Total: 181 tests**

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
| 2026-01-02 | Design-First Development | PM creates design doc before planning tasks |
| 2026-01-02 | Design doc in wiki | Single source of truth for requirements and approach |
| 2026-01-02 | CEO manages Teams | Higher-level orchestration, project breakdown |
| 2026-01-02 | Jarvis as entry point | Single universal interface for users |
| 2026-01-02 | Pub/Sub Channels | Flexible agent-to-agent communication |
| 2026-01-02 | CLI uses Jarvis | Single entry point for all interactions |
| 2026-01-02 | Shell injection prevention | Pre-validate all paths before execution |
| 2026-01-02 | Memory bounds | Cap conversation and message history to prevent leaks |
| 2026-01-02 | LRU cache for LLM responses | Reduce redundant API calls, configurable TTL |
| 2026-01-02 | Structured JSON logging | Human-readable and machine-parseable logs |
| 2026-01-02 | Correlation IDs | Request tracing across async operations |
| 2026-01-02 | Metrics collector singleton | Centralized performance tracking |
| 2026-01-02 | ArchitectAgent for design | Create system design before implementation |
| 2026-01-02 | Contract-First Development | Define API contracts for parallel team work |
| 2026-01-02 | GitTools sandboxed | Version control with security (no remote ops) |

---

## Known Issues

1. **CLI pipe input on Windows**: Works fine in interactive mode.
2. **Deprecation warning**: spawn with shell option on Windows - necessary for npm/npx, mitigated by input validation.

---

## Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Test Coverage | >80% | TBD |
| Unit Tests | All pass | 470/470 |
| Integration Tests | All pass | 17/17 |
| E2E Tests | All pass | 8/8 (when API key set) |
| Benchmark Tests | - | 8 (Phase 5 target) |
| Security Tests | All pass | 24/24 |
| Memory Tests | All pass | 9/9 |
| Cache Tests | All pass | 29/29 |
| Logging Tests | All pass | 23/23 |
| Metrics Tests | All pass | 21/21 |
| ArchitectAgent Tests | All pass | 26/26 |
| GitTools Tests | All pass | 34/34 |
| Specialized Agents Tests | All pass | 26/26 |
| Templates Tests | All pass | 18/18 |
| Team Selection Tests | All pass | 10/10 |
| CEO Multi-Team Tests | All pass | 6/6 |
| Jarvis Workspace Tests | All pass | 5/5 |
| Template Tools Tests | All pass | 11/11 |
| Total Tests | All pass | 492 (+8 E2E) |
| CI Status | Passing | Passing |

---

## Architecture Summary

```
User/Human
    │
    ▼
┌─────────────────────────────────────────────┐
│               JARVIS                         │
│  (Universal Entry Point)                     │
│  Routes requests, manages companies          │
└────────────────┬────────────────────────────┘
                 │ creates/manages
                 ▼
┌─────────────────────────────────────────────┐
│               CEO                            │
│  (Per-Company Orchestrator)                  │
│  Breaks goals into projects                  │
│  Handles escalations from Teams              │
└────────────────┬────────────────────────────┘
                 │ manages
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
           │                           │
           │ pub/sub                   │ LLM calls
           ▼                           ▼
┌────────────────────────┐   ┌────────────────────────┐
│  Communication Channels │   │       LLMClient        │
│  Topic-based messaging  │   │  Caching (LRUCache)    │
│  History, filtering     │   │  Metrics tracking      │
└────────────────────────┘   └────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
           ┌────────────────┐                    ┌────────────────┐
           │     Logger     │                    │ MetricsCollector│
           │  JSON/Pretty   │                    │  LLM latency    │
           │  Correlation   │                    │  Token usage    │
           │  Component     │                    │  Tool stats     │
           └────────────────┘                    └────────────────┘
```

**Workflow (Design-First with Company Structure):**
1. User submits request to Jarvis
2. Jarvis analyzes and routes to appropriate Company/CEO
3. CEO breaks goal into projects for Team
4. For each project:
   a. PM creates design doc (if wiki available)
   b. PM plans task into dev/QA subtasks (referencing design doc)
   c. Dev implements features (can read design doc)
   d. QA tests implementation (can read design doc)
   e. If QA fails → Dev fixes → QA retests (loop)
   f. If max iterations → Escalate to PM → CEO → Jarvis → Human
5. CEO aggregates project results
6. Jarvis reports back to user
