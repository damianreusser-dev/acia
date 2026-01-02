# Agent Coordination & Communication

**Purpose**: Define how agents coordinate, especially across team boundaries.

## The Problem

When multiple teams work on a fullstack application:
- Frontend needs to know API endpoints before they exist
- Backend needs to know what data frontend expects
- Both must agree on data structures, error formats, authentication
- Changes in one affect the other

**Without coordination**: Frontend builds against imagined API, Backend builds different API, integration fails.

## Solution: Contract-First Development

### The Architect's Role

The ArchitectAgent creates a **System Design Document** that serves as the contract between all teams:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTEM DESIGN DOCUMENT                       │
│                   (Created by Architect)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. API CONTRACTS                                               │
│     ┌─────────────────────────────────────────────────────┐    │
│     │ GET /api/todos                                       │    │
│     │   Response: { todos: Todo[] }                        │    │
│     │                                                      │    │
│     │ POST /api/todos                                      │    │
│     │   Request: { title: string }                         │    │
│     │   Response: { todo: Todo }                           │    │
│     │                                                      │    │
│     │ interface Todo {                                     │    │
│     │   id: string;                                        │    │
│     │   title: string;                                     │    │
│     │   completed: boolean;                                │    │
│     │   createdAt: string; // ISO 8601                     │    │
│     │ }                                                    │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                 │
│  2. FILE STRUCTURE                                              │
│     /frontend - React app (port 3000)                          │
│     /backend - Express API (port 3001)                         │
│     /shared - Shared types (imported by both)                  │
│                                                                 │
│  3. COMMUNICATION PROTOCOLS                                     │
│     - Frontend calls Backend via REST                          │
│     - CORS enabled for localhost:3000                          │
│     - JSON request/response bodies                             │
│     - Error format: { error: string, code: string }            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Frontend │   │ Backend  │   │  Shared  │
        │   Team   │   │   Team   │   │  Types   │
        └──────────┘   └──────────┘   └──────────┘
```

### Communication Flow

```
                        ┌─────────────┐
                        │  Architect  │
                        │  (Design)   │
                        └──────┬──────┘
                               │
                               ▼ writes
                    ┌──────────────────────┐
                    │   designs/           │
                    │   └─todo-app.md      │
                    │                      │
                    │   contracts/         │
                    │   └─api-spec.ts      │
                    │                      │
                    │   (in Wiki)          │
                    └──────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │ reads          │ reads          │ reads
              ▼                ▼                ▼
       ┌────────────┐   ┌────────────┐   ┌────────────┐
       │  Frontend  │   │  Backend   │   │    QA      │
       │    Team    │   │    Team    │   │   Team     │
       └────────────┘   └────────────┘   └────────────┘
              │                │                │
              │ implements     │ implements     │ verifies
              ▼                ▼                ▼
       ┌────────────┐   ┌────────────┐   ┌────────────┐
       │ React app  │   │ Express    │   │ Integration│
       │ calls API  │   │ serves API │   │ tests API  │
       │ per spec   │   │ per spec   │   │ matches    │
       └────────────┘   └────────────┘   └────────────┘
```

### Shared Types Pattern

The Architect creates shared TypeScript types that both teams import:

```typescript
// /shared/types/todo.ts (created by Architect)
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface CreateTodoRequest {
  title: string;
}

export interface ApiError {
  error: string;
  code: string;
}
```

```typescript
// /backend/src/routes/todos.ts (created by Backend Team)
import { Todo, CreateTodoRequest } from '../../shared/types/todo.js';

app.post('/api/todos', (req, res) => {
  const body: CreateTodoRequest = req.body;
  // ... implementation
});
```

```typescript
// /frontend/src/api/todos.ts (created by Frontend Team)
import { Todo, CreateTodoRequest } from '../../shared/types/todo.js';

export async function createTodo(data: CreateTodoRequest): Promise<Todo> {
  // ... implementation
}
```

### Channel-Based Coordination

Teams communicate via dedicated channels:

```typescript
// Channel structure for a fullstack project
const channels = {
  // Architect broadcasts design decisions
  'design-updates': Channel,

  // Teams can ask questions about the design
  'design-questions': Channel,

  // Backend announces when APIs are ready
  'api-ready': Channel,

  // Frontend reports integration issues
  'integration-issues': Channel,

  // All teams report blockers
  'blockers': Channel,
};
```

### Coordination Protocol

```
PHASE 1: DESIGN (Serial)
─────────────────────────
1. Architect analyzes requirements
2. Architect creates system design
3. Architect writes API contracts
4. Architect creates shared types
5. Design doc written to wiki
6. CEO reviews and approves

PHASE 2: IMPLEMENTATION (Parallel)
──────────────────────────────────
                    ┌──────────────────────┐
                    │ Design Doc (source)  │
                    └──────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        [Frontend Team] [Backend Team]  [DevOps Team]
              │               │               │
              │               │               │
              ▼               ▼               ▼
        React + Types   Express + Types   Docker + CI
              │               │               │
              └───────┬───────┘               │
                      │                       │
                      ▼                       │
               [Integration]◄─────────────────┘

PHASE 3: INTEGRATION (Serial)
─────────────────────────────
1. Backend deploys API (or runs locally)
2. Frontend connects to real API
3. QA runs integration tests
4. Issues → Back to implementation
5. All pass → Done

PHASE 4: DELIVERY
─────────────────
1. DevOps builds containers
2. DevOps runs full stack
3. Final verification
4. Deliver to user
```

## Implementation Details

### ArchitectAgent System Prompt

```typescript
const ARCHITECT_SYSTEM_PROMPT = `
You are a Software Architect. Your job is to create technical designs
that enable multiple teams to work in parallel without conflicts.

When given a project requirement, you must create:

1. SYSTEM OVERVIEW
   - High-level architecture diagram (ASCII)
   - Component responsibilities
   - Technology choices with rationale

2. API CONTRACTS (if applicable)
   - Every endpoint with request/response types
   - Error formats
   - Authentication requirements
   - Rate limiting

3. DATA MODELS
   - TypeScript interfaces for all entities
   - Validation rules
   - Relationships

4. FILE STRUCTURE
   - Directory layout
   - What goes where
   - Shared code location

5. COMMUNICATION
   - How components talk to each other
   - Ports, protocols, formats
   - CORS, authentication

Your design must be detailed enough that:
- Frontend team can build UI without waiting for backend
- Backend team can build API without waiting for frontend
- Both teams produce compatible code
- QA can write integration tests from the spec

Write the design to: wiki/designs/{project-name}.md
Write shared types to: wiki/contracts/{project-name}.ts
`;
```

### CEO Multi-Team Orchestration

```typescript
class CEOAgent {
  async executeGoal(goal: string): Promise<GoalResult> {
    // 1. Get design from Architect (blocking)
    const design = await this.architect.createDesign(goal);
    await this.wiki.write(`designs/${goal.slug}.md`, design.document);
    await this.wiki.write(`contracts/${goal.slug}.ts`, design.contracts);

    // 2. Spawn teams based on design
    const teams: Team[] = [];

    if (design.requiresFrontend) {
      teams.push(this.createTeam('frontend', {
        designDoc: design.document,
        contracts: design.contracts,
        scope: design.frontendScope,
      }));
    }

    if (design.requiresBackend) {
      teams.push(this.createTeam('backend', {
        designDoc: design.document,
        contracts: design.contracts,
        scope: design.backendScope,
      }));
    }

    // 3. Execute in parallel
    this.emitProgress('Starting parallel team execution');
    const results = await Promise.all(
      teams.map(team => team.executeTask(team.scope))
    );

    // 4. Integration phase (serial)
    if (results.every(r => r.success)) {
      const integrationResult = await this.runIntegration(design, results);
      return integrationResult;
    }

    // 5. Handle failures
    return this.handleTeamFailures(results);
  }
}
```

### Team Context from Design

```typescript
interface TeamConfig {
  // ... existing config
  designDoc?: string;      // Path to design document
  contracts?: string;      // Path to shared contracts
  scope?: string;          // What this team is responsible for
}

class Team {
  async executeTask(taskDescription: string): Promise<WorkflowResult> {
    // Include design context in planning
    const context = await this.loadDesignContext();

    const parentTask = createTask({
      type: 'implement',
      title: taskDescription,
      description: taskDescription,
      createdBy: 'CEO',
      context: {
        designDoc: context.designDoc,
        contracts: context.contracts,
        teamScope: this.scope,
      },
    });

    // PM uses design doc for planning
    // Dev uses contracts for implementation
    // QA uses contracts for verification
  }
}
```

## Communication Patterns

### Pattern 1: Design Broadcast

When Architect completes design:
```typescript
channel.publish('architect', 'design-ready', JSON.stringify({
  project: 'todo-app',
  designPath: 'designs/todo-app.md',
  contractsPath: 'contracts/todo-app.ts',
}));
```

### Pattern 2: Ready Notification

When Backend completes an API:
```typescript
channel.publish('backend-team', 'api-ready', JSON.stringify({
  endpoint: '/api/todos',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  baseUrl: 'http://localhost:3001',
}));
```

### Pattern 3: Issue Report

When Frontend finds API mismatch:
```typescript
channel.publish('frontend-team', 'integration-issue', JSON.stringify({
  endpoint: '/api/todos',
  expected: 'Response should have createdAt as ISO string',
  actual: 'Response has createdAt as Unix timestamp',
  severity: 'blocking',
}));
```

### Pattern 4: Blocker Escalation

When team is blocked:
```typescript
channel.publish('backend-team', 'blocker', JSON.stringify({
  issue: 'Need database schema before implementing persistence',
  blockedBy: 'architect',
  waitingFor: 'Database design decision',
}));
```

## Integration with No Vibe Coding

This coordination approach follows No Vibe Coding principles:

1. **Planned Before Written**: Architect creates design before any code
2. **Tests Prove It Works**: Integration tests verify contract compliance
3. **Documented**: Design doc is the documentation
4. **Actually Functions**: Parallel work only possible with clear contracts

## Summary

| Component | Responsibility |
|-----------|----------------|
| Architect | Creates design, defines contracts |
| Design Doc | Source of truth for all teams |
| Shared Types | TypeScript interfaces both teams import |
| Channels | Real-time coordination between teams |
| Integration Tests | Verify contract compliance |
| CEO | Orchestrates parallel execution |

This ensures Frontend and Backend can work in parallel while producing compatible code.
