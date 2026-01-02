# ACIA Architecture

**Updated**: 2026-01-02
**Current Phase**: 5 - Fullstack Capability

## Overview

ACIA is a hierarchical multi-agent system designed as an **autonomous company factory**. It doesn't just write code - it runs entire businesses with specialized divisions for Tech, Marketing, Sales, Support, Operations, and Finance.

**Full Vision**: See [VISION.md](./VISION.md) for the complete autonomous company vision.

---

## Current Architecture (Phase 5)

```
┌─────────────────────────────────────────────────────────────────────┐
│                              User                                    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                             JARVIS                                   │
│                    (Universal Entry Point)                           │
│       Routes requests, manages companies, tracks portfolio           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
             ┌─────────────┐          ┌─────────────┐
             │  Company A  │          │  Company B  │
             │     CEO     │          │     CEO     │
             └──────┬──────┘          └──────┬──────┘
                    │                        │
                    ▼                        ▼
             ┌─────────────┐          ┌─────────────┐
             │    Team     │          │    Team     │
             │ (PM→Dev→QA) │          │ (PM→Dev→QA) │
             └──────┬──────┘          └──────┬──────┘
                    │                        │
                    └────────────┬───────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Shared Systems                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ LLMClient  │  │    Wiki    │  │  Channels  │  │   Tools    │   │
│  │ (Claude)   │  │  (Memory)  │  │ (Pub/Sub)  │  │ (File,Git) │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                   │
│  │   Logger   │  │  Metrics   │  │   Cache    │                   │
│  │(Structured)│  │ Collector  │  │(LRU + TTL) │                   │
│  └────────────┘  └────────────┘  └────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Anthropic Claude API                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Components

### Jarvis (`src/agents/executive/jarvis-agent.ts`)
- Universal entry point for all requests
- Routes requests to appropriate companies/CEOs
- Creates new companies for new domains
- Provides portfolio status across all companies
- Handles workspace mode for file operations

### CEO (`src/agents/executive/ceo-agent.ts`)
- Per-company orchestrator
- Breaks goals into projects for teams
- Handles escalations from PM
- Logs goal completion to wiki
- Multi-team coordination for parallel work

### Team (`src/team/team.ts`)
- Coordinates PM, Dev, and QA agents
- Executes task workflow with iteration loop
- Handles retry and escalation logic
- Provides callbacks for progress and escalation

### PMAgent (`src/agents/pm/pm-agent.ts`)
- Creates design docs before planning (wiki integration)
- Plans tasks by breaking into dev/QA subtasks
- Tracks task status and attempts
- Decides retry vs escalation
- Read-only tools (read_file, list_directory, wiki read)

### DevAgent (`src/agents/dev/dev-agent.ts`)
- Implements code based on task descriptions
- Analyzes response for success/failure
- Extracts modified files from output
- Full tools (read, write, execute, git)

### Specialized Dev Agents
- **FrontendDevAgent**: React/TypeScript specialist
- **BackendDevAgent**: Node/Express specialist
- Keyword-based agent selection in Team

### QAAgent (`src/agents/qa/qa-agent.ts`)
- Tests implementations
- Parses test results
- Creates test tasks for files
- Full tools

### ArchitectAgent (`src/agents/architect/architect-agent.ts`)
- Creates system designs before implementation
- Defines API contracts for team coordination
- Technology stack decisions
- File structure planning

### LLMClient (`src/core/llm/client.ts`)
- Wraps Anthropic Claude API
- Optional response caching (LRU with TTL)
- Metrics tracking (latency, tokens, errors)
- Structured logging with correlation IDs

### Wiki Service (`src/core/wiki/wiki-service.ts`)
- Persistent knowledge store
- Human-readable markdown files
- CRUD operations + search
- Agent tools for wiki access

### Communication Channels (`src/core/messaging/channel.ts`)
- Pub/Sub messaging between agents
- Topic-based routing
- Message history with filtering
- Thread support

---

## Tool System

### File Tools (`src/core/tools/file-tools.ts`)
- **ReadFileTool**: Read files from workspace
- **WriteFileTool**: Write files with auto-directory creation
- **ListDirectoryTool**: List directory contents
- Sandbox security (path traversal prevention)

### Exec Tools (`src/core/tools/exec-tools.ts`)
- **RunNpmScriptTool**: Run allowed npm scripts
- **RunTestFileTool**: Run vitest test files
- **RunCodeTool**: Execute TypeScript/JavaScript files
- Security hardening (shell injection prevention)

### Git Tools (`src/core/tools/git-tools.ts`)
- **GitInitTool**: Initialize repositories
- **GitAddTool**: Stage files
- **GitCommitTool**: Commit with sanitized messages
- **GitStatusTool**: Check repository status
- **GitBranchTool**: Branch operations
- **GitLogTool**: View commit history

### Template Tools (`src/core/tools/template-tools.ts`)
- **list_templates**: List available project templates
- **generate_project**: Scaffold projects from templates
- **preview_template**: Preview template structure

---

## Current Workflow

```
1. User submits request to Jarvis
              │
              ▼
2. Jarvis analyzes and routes to Company/CEO
              │
              ▼
3. CEO breaks goal into projects for Team
              │
              ▼
4. For each project:
   ┌────────────────────────────────────────────────────┐
   │  a. PM creates design doc (if wiki available)     │
   │  b. PM plans task into dev/QA subtasks            │
   │  c. Dev implements (uses appropriate specialist)   │
   │  d. QA tests implementation                       │
   │  e. If QA fails → Dev fixes → QA retests (loop)   │
   │  f. If max iterations → Escalate to PM → CEO      │
   └────────────────────────────────────────────────────┘
              │
              ▼
5. CEO aggregates results
              │
              ▼
6. Jarvis reports back to user
```

---

## Target Architecture (Phase 12)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              YOU                                         │
│                         (Shareholder)                                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CHIEF OF STAFF                                    │
│              (Your personal assistant agent)                             │
│     Synthesizes portfolio │ Prepares decisions │ Filters attention      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            JARVIS                                        │
│                    (System Orchestrator)                                 │
│     Routes requests │ Manages companies │ Tracks portfolio │ Reports    │
└────────────────┬──────────────────┬──────────────────┬──────────────────┘
                 │                  │                  │
    ┌────────────┘                  │                  └────────────┐
    ▼                               ▼                               ▼
┌─────────────┐             ┌─────────────┐             ┌─────────────┐
│  Product A  │             │  Product B  │             │    ACIA     │
│   Company   │             │   Company   │             │   (Self)    │
└──────┬──────┘             └──────┬──────┘             └──────┬──────┘
       │                           │                           │
       └───────────────────────────┼───────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         COMPANY STRUCTURE                                │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                            CEO Agent                                │ │
│  │              Strategic planning, resource allocation                │ │
│  └───────────────────────────────┬────────────────────────────────────┘ │
│                                  │                                       │
│     ┌────────────┬───────────────┼───────────────┬────────────┐         │
│     ▼            ▼               ▼               ▼            ▼         │
│  ┌──────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────┐     │
│  │ Tech │   │Marketing │   │ Support  │   │   Ops    │   │Finance│    │
│  │ Div  │   │   Div    │   │   Div    │   │   Div    │   │ Div  │     │
│  └──┬───┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └──┬───┘     │
│     │            │              │              │            │          │
│     ▼            ▼              ▼              ▼            ▼          │
│  Architect   ContentAgent   TriageAgent   DevOpsAgent   RevenueTracker│
│  PMAgent     SEOAgent       ResponseAgent MonitorAgent  CostTracker   │
│  DevAgents   SocialAgent    FeedbackAgent IncidentAgent Forecaster    │
│  QAAgents    AdsAgent       EscalationAgt ScaleAgent    Allocator     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Self-Improvement Loop (Phase 8+)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELF-IMPROVEMENT FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Request exceeds capability                                    │
│              │                                                  │
│              ▼                                                  │
│   ┌─────────────────────┐                                      │
│   │  Capability Check   │ → Has capability? → Proceed          │
│   └──────────┬──────────┘                                      │
│              │ No                                               │
│              ▼                                                  │
│   ┌─────────────────────┐                                      │
│   │   Gap Detected      │                                      │
│   └──────────┬──────────┘                                      │
│              │                                                  │
│              ▼                                                  │
│   ┌─────────────────────┐                                      │
│   │  ACIA Tech Division │ Plans self-improvement               │
│   └──────────┬──────────┘                                      │
│              │                                                  │
│              ▼                                                  │
│   ┌─────────────────────┐                                      │
│   │  Sandbox Created    │ Git worktree isolation               │
│   └──────────┬──────────┘                                      │
│              │                                                  │
│              ▼                                                  │
│   ┌─────────────────────┐                                      │
│   │  Changes Applied    │                                      │
│   └──────────┬──────────┘                                      │
│              │                                                  │
│              ▼                                                  │
│   ┌─────────────────────┐                                      │
│   │  Full Test Suite    │                                      │
│   │  Immune System      │ No regression, no bloat              │
│   └──────────┬──────────┘                                      │
│              │                                                  │
│              ▼                                                  │
│   ┌─────────────────────┐                                      │
│   │ Confidence Evaluate │                                      │
│   └──────────┬──────────┘                                      │
│              │                                                  │
│     ┌────────┴────────┐                                        │
│     ▼                 ▼                                        │
│  High (>80%)      Low (<80%)                                   │
│     │                 │                                        │
│     ▼                 ▼                                        │
│  Auto-merge      Wait for approval                             │
│     │                 │                                        │
│     └────────┬────────┘                                        │
│              │                                                  │
│              ▼                                                  │
│   ┌─────────────────────┐                                      │
│   │ Capability Added    │                                      │
│   │ Retry Request       │                                      │
│   └─────────────────────┘                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Revenue Flywheel

```
┌─────────────────────────────────────────────────────────────────┐
│                       REVENUE FLYWHEEL                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│         ┌──────────────┐                                       │
│         │  You Invest  │                                       │
│         └──────┬───────┘                                       │
│                │                                                │
│                ▼                                                │
│         ┌──────────────┐      ┌──────────────┐                │
│         │    ACIA      │─────▶│   Products   │                │
│         │   Builds     │      │   Deployed   │                │
│         └──────────────┘      └──────┬───────┘                │
│                ▲                     │                         │
│                │                     ▼                         │
│         ┌──────────────┐      ┌──────────────┐                │
│         │   Better     │◀─────│   Revenue    │                │
│         │    ACIA      │      │  Generated   │                │
│         └──────────────┘      └──────┬───────┘                │
│                ▲                     │                         │
│                │                     ▼                         │
│                │              ┌──────────────┐                │
│                └──────────────│  Resources   │                │
│                               │  (LLM, $$$)  │                │
│                               └──────────────┘                │
│                                                                 │
│   Each cycle: More products, better quality, faster builds     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure (Current)

```
src/
├── agents/
│   ├── base/
│   │   └── agent.ts           # Base agent class
│   ├── dev/
│   │   ├── dev-agent.ts       # General developer
│   │   ├── frontend-dev-agent.ts  # React specialist
│   │   └── backend-dev-agent.ts   # Node specialist
│   ├── qa/
│   │   └── qa-agent.ts        # QA testing agent
│   ├── pm/
│   │   └── pm-agent.ts        # Project manager
│   ├── architect/
│   │   └── architect-agent.ts # System architect
│   ├── executive/
│   │   ├── ceo-agent.ts       # Company CEO
│   │   └── jarvis-agent.ts    # Universal entry point
│   └── index.ts
├── core/
│   ├── llm/
│   │   └── client.ts          # Anthropic API wrapper
│   ├── tools/
│   │   ├── types.ts           # Tool interfaces
│   │   ├── file-tools.ts      # File operations
│   │   ├── exec-tools.ts      # Code execution
│   │   ├── git-tools.ts       # Git operations
│   │   └── template-tools.ts  # Project templates
│   ├── tasks/
│   │   └── types.ts           # Task system
│   ├── messaging/
│   │   └── channel.ts         # Pub/Sub channels
│   ├── wiki/
│   │   ├── wiki-service.ts    # Wiki CRUD
│   │   └── wiki-tools.ts      # Wiki agent tools
│   ├── cache/
│   │   └── lru-cache.ts       # LLM response cache
│   ├── logging/
│   │   └── logger.ts          # Structured logging
│   └── metrics/
│       └── collector.ts       # Performance metrics
├── team/
│   └── team.ts                # Team coordination
├── templates/
│   ├── index.ts               # Template service
│   ├── react/                 # React template
│   ├── express/               # Express template
│   └── fullstack/             # Combined template
└── cli/
    └── index.ts               # CLI interface

tests/
├── unit/                      # ~470 unit tests
├── integration/               # ~17 integration tests
└── e2e/                       # ~8 E2E tests
    └── benchmarks/            # Capability benchmarks
```

---

## Design Principles

1. **No Vibe Coding**: Every feature must have tests and actually work
2. **Testability**: All components testable in isolation
3. **Observability**: Log and trace all agent actions
4. **Safety**: Sandbox all file/code operations
5. **Human Readable**: All state stored as readable markdown
6. **Self-Improvement**: System can enhance itself safely
7. **Confidence-Based Autonomy**: High confidence = auto-proceed, low = ask

---

## Metrics (Current)

| Metric | Value |
|--------|-------|
| Unit Tests | ~470 |
| Integration Tests | ~17 |
| E2E Tests | 8 |
| Total Tests | ~495 |
| Agent Types | 8 |
| Tool Types | 15+ |
| CI Status | Passing |

---

## Evolution Path

```
Phase 5  (Current)   → Fullstack apps from prompt
Phase 6  (Next)      → Coordination refactor (6a) + Deploy & monitor (6b-g)
Phase 7              → Persona-based QA, oracle testing
Phase 8              → Self-improvement pipeline
Phase 9              → Marketing division
Phase 10             → Support division
Phase 11             → Finance division
Phase 12             → Full autonomy + Chief of Staff
```

See [ROADMAP.md](./ROADMAP.md) for detailed phase breakdown.
