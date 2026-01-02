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

## Current Phase: 3 - Company Structure

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
- 122 unit/integration tests + 2 E2E tests

### Phase 3 Goal
Full company hierarchy with persistent knowledge:
- [ ] Wiki/Memory system for agent knowledge
- [ ] CEO agent for higher-level orchestration
- [ ] Jarvis agent as universal entry point
- [ ] Communication channels between agents

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

## Learned Patterns (from Phase 1-2)

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
}, { timeout: 180000 });
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

### LLM Integration Patterns

**Parse tool calls flexibly:**
- LLM output format varies - handle multiple formats
- Use clear delimiters in prompts (`<tool_call>`, `DEV_TASKS:`, etc.)
- Always have fallback for unparseable responses

**Task planning with LLM:**
- Provide clear structure in system prompt
- Request specific output format
- Parse with regex, not JSON (more flexible)

### File Organization

**Test file naming:**
- Unit tests: `tests/unit/{component}.test.ts`
- Integration: `tests/integration/{workflow}.test.ts`
- E2E: `tests/e2e/{feature}-e2e.test.ts`

**Source organization:**
```
src/agents/{type}/          # Agent implementations
src/agents/{type}/index.ts  # Re-exports
src/core/{system}/          # Core systems (tasks, llm, tools)
src/team/                   # Team coordination
```

## Quick Commands

```bash
# Run everything
npm test                    # All tests (unit + integration + e2e skipped)
npm run typecheck           # Type checking

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:int            # Integration tests only
RUN_E2E_TESTS=true npm run test:e2e  # E2E with real API

# Watch mode for development
npm run test:watch

# Before committing
npm test && npm run lint && npm run typecheck
```
