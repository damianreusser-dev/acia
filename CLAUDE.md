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

## Current Phase: 1 - Foundation

### Phase 1 Goal
A single working agent that can:
- Receive a task via CLI
- Use LLM to reason about it
- Write code to a file
- Write a test for the code
- Run the test
- Report success/failure

### Phase 1 Success Criteria
- [ ] Base Agent class with LLM integration
- [ ] CLI can send task to agent
- [ ] Agent writes working code
- [ ] Agent writes passing test
- [ ] Test actually runs and verifies code
- [ ] Full flow documented and reproducible

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-01 | TypeScript over Python | Type safety, async-native, consistent tooling |
| 2026-01-01 | File-based wiki first | Human-readable, git-trackable, simple start |
| 2026-01-01 | CLI before UI | Focus on core functionality first |

## Notes for Claude

### DO:
- Ask clarifying questions before implementing
- Write tests before or with code
- Update STATUS.md after significant progress
- Create GitHub issues for discovered work
- Stop and fix if something breaks

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
