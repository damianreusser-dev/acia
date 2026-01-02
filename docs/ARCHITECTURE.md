# ACIA Architecture

## Overview

ACIA is designed as a hierarchical multi-agent system that mimics a software company structure.

## Current Architecture (Phase 2)

```
┌─────────────────────────────────────────────────────────────┐
│                          User                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                         Team                                 │
│                  (Workflow Coordinator)                      │
│                                                              │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐     │
│  │    PMAgent    │ │   DevAgent    │ │    QAAgent    │     │
│  │  (Planning)   │ │  (Implement)  │ │   (Testing)   │     │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘     │
│          │                 │                 │              │
│          └─────────────────┼─────────────────┘              │
│                            │                                 │
│                    Shared LLMClient                         │
│                            │                                 │
│                    ┌───────┴───────┐                        │
│                    │     Tools     │                        │
│                    │ (File, Exec)  │                        │
│                    └───────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Anthropic Claude API                       │
└─────────────────────────────────────────────────────────────┘
```

### Components

#### Team (`src/team/team.ts`)
- Coordinates PM, Dev, and QA agents
- Executes task workflow with iteration loop
- Handles retry and escalation logic
- Provides callbacks for progress and escalation

#### PMAgent (`src/agents/pm/pm-agent.ts`)
- Plans tasks by breaking into dev/QA subtasks
- Uses LLM to analyze requirements
- Tracks task status and attempts
- Decides retry vs escalation
- Has read-only tools (read_file, list_directory)

#### DevAgent (`src/agents/dev/dev-agent.ts`)
- Implements code based on task descriptions
- Uses all tools (read, write, execute)
- Analyzes response for success/failure
- Extracts modified files from output

#### QAAgent (`src/agents/qa/qa-agent.ts`)
- Tests implementations
- Parses test results
- Creates test tasks for files
- Uses all tools

#### LLMClient (`src/core/llm/client.ts`)
- Wraps Anthropic Claude API
- Handles message formatting
- Manages API configuration
- Returns structured responses

#### Tools (`src/core/tools/`)
- **ReadFileTool**: Read files from workspace
- **WriteFileTool**: Write files with auto-directory creation
- **ListDirectoryTool**: List directory contents
- **RunNpmScriptTool**: Run allowed npm scripts
- **RunTestFileTool**: Run vitest test files
- **RunCodeTool**: Execute TypeScript/JavaScript files
- All tools enforce sandbox security (no path traversal)

#### Task System (`src/core/tasks/types.ts`)
- Task interface with status, priority, attempts
- createTask() factory function
- canRetry() and isTerminal() utilities

## Workflow

```
1. User submits task to Team.executeTask()
            │
            ▼
2. PMAgent plans task into dev/QA subtasks
            │
            ▼
3. Execute tasks in order:
   ┌────────────────────────────────────┐
   │  For each task in execution order  │
   │                                    │
   │  Dev task? → DevAgent.executeTask()│
   │  QA task?  → QAAgent.executeTask() │
   │                                    │
   │  PMAgent.handleTaskResult()        │
   │    → continue / retry / escalate   │
   └────────────────────────────────────┘
            │
            ▼
4. QA fails? Create fix task, loop back
            │
            ▼
5. Max iterations? Escalate
            │
            ▼
6. Return WorkflowResult
```

## Target Architecture (Future Phases)

```
                        ┌─────────┐
                        │  Human  │
                        └────┬────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│                        JARVIS                               │
│                  (Universal Orchestrator)                   │
└─────────────────────────┬──────────────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
      ┌─────────┐   ┌─────────┐   ┌─────────┐
      │  ACIA   │   │ Company │   │ Company │
      │   CEO   │   │  A CEO  │   │  B CEO  │
      └────┬────┘   └─────────┘   └─────────┘
           │
           ▼
    ┌─────────────┐
    │    Team     │ ← Current Phase 2
    │  (PM/Dev/QA)│
    └─────────────┘
```

### Future Components

#### Wiki/Memory System
- Persistent knowledge store
- Human-readable markdown files
- Indexed for agent retrieval

#### CEO Agent
- Higher-level orchestration
- Strategic decisions
- Resource allocation

#### Jarvis Agent
- Universal entry point
- Multi-company management
- Human interface

## Design Principles

1. **Simplicity First**: Don't add complexity until needed
2. **Testability**: Every component must be testable in isolation
3. **Observability**: Log and trace all agent actions
4. **Safety**: Sandbox all file/code operations
5. **Human Readable**: All state stored as readable files
6. **No Vibe Coding**: Tests required for all functionality

## File Structure

```
src/
├── agents/
│   ├── base/           # Base agent class
│   │   └── agent.ts
│   ├── dev/            # Developer agent ✓
│   │   └── dev-agent.ts
│   ├── qa/             # QA agent ✓
│   │   └── qa-agent.ts
│   ├── pm/             # PM agent ✓
│   │   └── pm-agent.ts
│   └── executive/      # CEO, Jarvis (Phase 3)
├── core/
│   ├── llm/            # LLM integration ✓
│   │   └── client.ts
│   ├── tools/          # Tool implementations ✓
│   │   ├── types.ts
│   │   ├── file-tools.ts
│   │   └── exec-tools.ts
│   └── tasks/          # Task management ✓
│       └── types.ts
├── team/               # Team coordination ✓
│   └── team.ts
└── cli/                # CLI interface ✓
    └── index.ts

tests/
├── unit/               # 112 unit tests
└── integration/        # 9 integration tests
```

## Data Flow

### Current (Phase 2)
```
User Input → Team.executeTask()
                    │
                    ▼
              PMAgent.planTask()
                    │
                    ▼
              TaskBreakdown (dev/QA tasks)
                    │
    ┌───────────────┴───────────────┐
    ▼                               ▼
DevAgent.executeTask()      QAAgent.executeTask()
    │                               │
    └───────────┬───────────────────┘
                ▼
        PMAgent.handleTaskResult()
        (continue / retry / escalate)
                │
                ▼
          WorkflowResult
```

### Iteration Loop
```
Dev implements → QA tests → Failed?
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                   Yes                  No
                    │                   │
                    ▼                   ▼
            Create fix task         Complete
                    │
                    ▼
            Dev fixes → QA retests → ...
```
