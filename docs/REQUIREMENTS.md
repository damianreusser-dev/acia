# ACIA Requirements

## Overview

ACIA (Autonomous Company Intelligence Architecture) is a multi-agent system that simulates a software company. The system should be capable of:
1. Receiving high-level project requirements
2. Breaking them down into tasks
3. Assigning tasks to appropriate agents
4. Developing, testing, and deploying software
5. Improving itself over time

## Phase Breakdown

### Phase 1: Foundation

**Goal**: Establish a working single-agent system that can communicate and reason.

#### Phase 1a: Basic Agent Communication
- [ ] Base Agent class with LLM integration
- [ ] Simple CLI for user interaction
- [ ] Agent can receive and respond to messages
- [ ] Unit tests for core components

**Success Criteria**:
- User can start CLI and chat with agent
- Agent responses are coherent and contextual
- All tests pass
- No hardcoded responses - actual LLM usage

#### Phase 1b: Agent File Operations
- [ ] Agent can read files from disk
- [ ] Agent can write files to disk
- [ ] Agent can list directory contents
- [ ] File operations are sandboxed to workspace

**Success Criteria**:
- Agent can be asked to read a file and summarize it
- Agent can be asked to create a file with specific content
- Agent cannot access files outside workspace
- Integration tests verify file operations

#### Phase 1c: Agent Code Execution
- [ ] Agent can write TypeScript/JavaScript code
- [ ] Agent can run tests on written code
- [ ] Agent receives test results and can iterate
- [ ] Basic error handling and recovery

**Success Criteria**:
- Ask agent to "write a function that adds two numbers"
- Agent writes code to a file
- Agent writes a test for the code
- Agent runs test and reports result
- If test fails, agent can attempt to fix

---

### Phase 2: Basic Team (Future)

**Goal**: Multiple agents working together on a single task.

- PM Agent coordinates work
- Dev Agent writes code
- QA Agent tests code
- Simple task handoff between agents
- Basic escalation when stuck

---

### Phase 3: Company Structure (Future)

**Goal**: Full company hierarchy with divisions.

- CEO Agent manages overall direction
- Multiple divisions (Tech, etc.)
- Channel-based communication
- Persistent memory/wiki system
- Meeting summaries and reports

---

### Phase 4: Self-Improvement (Future)

**Goal**: ACIA can improve itself.

- ACIA as a company that builds ACIA
- Staged deployment for self-testing
- Capability assessment
- Automatic upgrade workflows

---

### Phase 5: Multi-Company (Future)

**Goal**: Jarvis orchestrating multiple companies.

- Jarvis as universal entry point
- Create and manage multiple companies
- Cross-company collaboration
- Strategy layer for optimization

## Non-Functional Requirements

### Quality
- All code must have tests
- Test coverage > 80% for core components
- No `any` types without justification
- Linting and formatting enforced

### Security
- API keys never in code
- File operations sandboxed
- No arbitrary code execution without review

### Documentation
- Every module has a doc comment
- Architecture decisions recorded
- STATUS.md always current

### Development Process
- Feature branches from develop
- PR required for all changes
- CI must pass before merge
- No force pushes to main/develop
