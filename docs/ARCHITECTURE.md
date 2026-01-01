# ACIA Architecture

## Overview

ACIA is designed as a hierarchical multi-agent system that mimics a software company structure.

## Current Architecture (Phase 1)

```
┌─────────────────────────────────────────────────┐
│                     CLI                          │
│              (User Interface)                    │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│                   Agent                          │
│         (Reasoning & Conversation)               │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│                 LLMClient                        │
│           (Anthropic Claude API)                 │
└─────────────────────────────────────────────────┘
```

### Components

#### LLMClient (`src/core/llm/client.ts`)
- Wraps Anthropic Claude API
- Handles message formatting
- Manages API configuration
- Returns structured responses

#### Agent (`src/agents/base/agent.ts`)
- Core reasoning unit
- Maintains conversation history
- Uses LLMClient for inference
- Base class for specialized agents

#### CLI (`src/cli/index.ts`)
- REPL interface for user
- Loads configuration from .env
- Creates and manages agent instance

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
    │  Tech PM    │
    └──────┬──────┘
           │
     ┌─────┼─────┐
     ▼     ▼     ▼
   ┌───┐ ┌───┐ ┌───┐
   │DEV│ │OPS│ │QA │
   └───┘ └───┘ └───┘
```

### Future Components

#### Message Bus
- Event-driven communication
- Pub/sub for channels
- Async message delivery

#### Task Manager
- Task creation and assignment
- Status tracking
- Dependency management

#### Wiki/Memory System
- Persistent knowledge store
- Human-readable markdown files
- Indexed for agent retrieval

#### Execution Engine
- Sandboxed code execution
- Test runner integration
- Build and deploy capabilities

## Design Principles

1. **Simplicity First**: Don't add complexity until needed
2. **Testability**: Every component must be testable in isolation
3. **Observability**: Log and trace all agent actions
4. **Safety**: Sandbox all file/code operations
5. **Human Readable**: All state stored as readable files

## File Structure

```
src/
├── agents/
│   ├── base/           # Base agent class
│   │   └── agent.ts
│   ├── dev/            # Developer agent (Phase 2)
│   ├── qa/             # QA agent (Phase 2)
│   ├── pm/             # PM agent (Phase 2)
│   ├── devops/         # DevOps agent (Phase 2)
│   └── executive/      # CEO, Jarvis (Phase 3+)
├── core/
│   ├── llm/            # LLM integration
│   │   └── client.ts
│   ├── messaging/      # Inter-agent messaging (Phase 2)
│   ├── memory/         # Wiki/knowledge system (Phase 2)
│   └── tasks/          # Task management (Phase 2)
├── company/            # Company structure (Phase 3)
└── cli/                # CLI interface
    └── index.ts
```

## Data Flow

### Current (Phase 1)
```
User Input → CLI → Agent → LLMClient → Claude API
                     ↓
                  Response
                     ↓
              CLI → User Output
```

### Future (Phase 2+)
```
User Input → Jarvis → CEO → PM → Task Queue
                                     ↓
                              Agent Assignment
                                     ↓
                           Agent Execution Loop
                           (Dev → QA → Fix → QA)
                                     ↓
                              Report → PM → CEO
                                     ↓
                              User Notification
```
