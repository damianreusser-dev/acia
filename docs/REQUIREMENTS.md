# ACIA Requirements

## Overview

ACIA (Autonomous Company Intelligence Architecture) is a multi-agent system that simulates a software company. The system should be capable of:
1. Receiving high-level project requirements
2. Breaking them down into tasks
3. Assigning tasks to appropriate agents
4. Developing, testing, and deploying software
5. Improving itself over time

## Phase Breakdown

### Phase 1: Foundation ✓ COMPLETED

**Goal**: Establish a working single-agent system that can communicate and reason.

#### Phase 1a: Basic Agent Communication ✓
- [x] Base Agent class with LLM integration
- [x] Simple CLI for user interaction
- [x] Agent can receive and respond to messages
- [x] Unit tests for core components

**Success Criteria**: ✓ All met
- User can start CLI and chat with agent
- Agent responses are coherent and contextual
- All tests pass
- No hardcoded responses - actual LLM usage

#### Phase 1b: Agent File Operations ✓
- [x] Agent can read files from disk
- [x] Agent can write files to disk
- [x] Agent can list directory contents
- [x] File operations are sandboxed to workspace

**Success Criteria**: ✓ All met
- Agent can be asked to read a file and summarize it
- Agent can be asked to create a file with specific content
- Agent cannot access files outside workspace
- Integration tests verify file operations

#### Phase 1c: Agent Code Execution ✓
- [x] Agent can write TypeScript/JavaScript code
- [x] Agent can run tests on written code
- [x] Agent receives test results and can iterate
- [x] Basic error handling and recovery

**Success Criteria**: ✓ All met
- Ask agent to "write a function that adds two numbers"
- Agent writes code to a file
- Agent writes a test for the code
- Agent runs test and reports result
- If test fails, agent can attempt to fix

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

**Success Criteria**: ✓ All met
- PM Agent coordinates work
- Dev Agent writes code
- QA Agent tests code
- Simple task handoff between agents
- Basic escalation when stuck
- 121 tests passing

---

### Phase 3: Company Structure (Future)

**Goal**: Full company hierarchy with divisions.

- [ ] CEO Agent manages overall direction
- [ ] Multiple divisions (Tech, etc.)
- [ ] Channel-based communication
- [ ] Persistent memory/wiki system
- [ ] Meeting summaries and reports

---

### Phase 4: Self-Improvement (Future)

**Goal**: ACIA can improve itself.

- [ ] ACIA as a company that builds ACIA
- [ ] Staged deployment for self-testing
- [ ] Capability assessment
- [ ] Automatic upgrade workflows

---

### Phase 5: Multi-Company (Future)

**Goal**: Jarvis orchestrating multiple companies.

- [ ] Jarvis as universal entry point
- [ ] Create and manage multiple companies
- [ ] Cross-company collaboration
- [ ] Strategy layer for optimization

## Non-Functional Requirements

### Quality ✓
- [x] All code must have tests (121 tests)
- [ ] Test coverage > 80% for core components (TBD)
- [x] No `any` types without justification
- [x] Linting and formatting enforced

### Security ✓
- [x] API keys never in code (via .env)
- [x] File operations sandboxed
- [x] No arbitrary code execution without review

### Documentation ✓
- [x] Every module has a doc comment
- [x] Architecture decisions recorded
- [x] STATUS.md always current

### Development Process
- [ ] Feature branches from develop
- [ ] PR required for all changes
- [x] CI must pass before merge
- [ ] No force pushes to main/develop
