# ACIA Requirements

> **Phase details**: See [ROADMAP.md](./ROADMAP.md) for implementation phases 1-12.
> **Vision**: See [VISION.md](./VISION.md) for the autonomous company factory concept.

---

## Non-Functional Requirements

### Quality
- [x] All code must have tests (520+ tests)
- [ ] Test coverage > 80% for core components
- [x] No `any` types without justification
- [x] Linting and formatting enforced
- [x] TypeScript strict mode

### Security
- [x] API keys never in code (via .env)
- [x] File operations sandboxed to workspace
- [x] Shell injection prevention (shell: false)
- [x] Path traversal prevention
- [x] Input sanitization with allowlists
- [ ] Security scans on generated code

### Performance
- [x] LRU caching for LLM responses (configurable TTL)
- [x] Memory bounds on all growing collections
- [ ] Token usage optimization
- [ ] Model selection for cost/capability (haiku vs opus)
- [ ] Parallel execution where possible

### Observability
- [x] Structured JSON logging
- [x] Correlation IDs for request tracing
- [x] Performance metrics collection (LLM latency, tokens, tool usage)
- [ ] Cost metrics per project
- [ ] Dashboard/monitoring UI

### Documentation
- [x] Every module has a doc comment
- [x] Architecture decisions recorded (ADRs)
- [x] STATUS.md always current
- [x] CLAUDE.md with learned patterns
- [ ] Auto-generated API docs

### Development Process
- [x] CI must pass before merge
- [x] Tests run on every PR
- [ ] Feature branches from develop
- [ ] PR required for all changes
- [ ] No force pushes to main/develop

---

## Agent Hierarchy (Target)

```
Human
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│                         JARVIS                               │
│              (Universal Entry Point)                         │
│  Analyzes requests, routes to companies, reports results    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                          CEO                                 │
│              (Company Orchestrator)                          │
│  Strategic planning, resource allocation, escalation        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       ARCHITECT                              │
│              (Technical Design)                              │
│  System design, tech decisions, file structure              │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Frontend   │   │   Backend   │   │   DevOps    │
│    Team     │   │    Team     │   │    Team     │
├─────────────┤   ├─────────────┤   ├─────────────┤
│ PM          │   │ PM          │   │ PM          │
│ FE Dev      │   │ BE Dev      │   │ DevOps Eng  │
│ QA          │   │ QA          │   │ QA          │
└─────────────┘   └─────────────┘   └─────────────┘
         │                │                │
         └────────────────┴────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    QUALITY GATES                             │
│  Lint → Typecheck → Tests → Coverage → Security → Docs     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
                   DELIVERED PROJECT
```

---

## Tool Inventory

### Core Tools (Phase 1-4) ✅
| Tool | Description | Status |
|------|-------------|--------|
| `read_file` | Read file contents | ✅ |
| `write_file` | Write file contents | ✅ |
| `list_directory` | List directory contents | ✅ |
| `run_code` | Execute TypeScript/JavaScript | ✅ |
| `run_test_file` | Run specific test file | ✅ |
| `run_npm_script` | Run npm scripts | ✅ |

### Wiki Tools (Phase 3) ✅
| Tool | Description | Status |
|------|-------------|--------|
| `read_wiki` | Read wiki page | ✅ |
| `write_wiki` | Write wiki page | ✅ |
| `append_wiki` | Append to wiki page | ✅ |
| `search_wiki` | Search wiki content | ✅ |
| `list_wiki` | List wiki pages | ✅ |

### Git Tools (Phase 5) ✅
| Tool | Description | Status |
|------|-------------|--------|
| `git_init` | Initialize repository | ✅ |
| `git_add` | Stage files | ✅ |
| `git_commit` | Commit changes | ✅ |
| `git_status` | Check status | ✅ |
| `git_branch` | Manage branches | ✅ |
| `git_log` | View commit history | ✅ |

### Template Tools (Phase 5) ✅
| Tool | Description | Status |
|------|-------------|--------|
| `list_templates` | List available templates | ✅ |
| `generate_project` | Scaffold from template | ✅ |
| `preview_template` | Preview template structure | ✅ |

### Docker Tools (Phase 6b)
| Tool | Description | Status |
|------|-------------|--------|
| `docker_build` | Build Docker image | ⬜ |
| `docker_run` | Run container | ⬜ |
| `docker_compose_up` | Start compose stack | ⬜ |
| `docker_compose_down` | Stop compose stack | ⬜ |
| `docker_logs` | Get container logs | ⬜ |
| `docker_ps` | List containers | ⬜ |

### Deployment Tools (Phase 6c)
| Tool | Description | Status |
|------|-------------|--------|
| `deploy_to_railway` | Deploy to Railway | ⬜ |
| `deploy_to_vercel` | Deploy to Vercel | ⬜ |
| `get_deployment_status` | Check deployment | ⬜ |
| `get_deployment_logs` | Get deploy logs | ⬜ |
| `rollback_deployment` | Rollback version | ⬜ |

### Interaction Tools (Phase 7)
| Tool | Description | Status |
|------|-------------|--------|
| `launch_app` | Start app locally | ⬜ |
| `screenshot` | Take screenshot | ⬜ |
| `click` | Click element | ⬜ |
| `type` | Type text | ⬜ |
| `navigate` | Go to URL | ⬜ |
| `check_accessibility` | Run a11y audit | ⬜ |

### Self-Improvement Tools (Phase 8)
| Tool | Description | Status |
|------|-------------|--------|
| `check_capability` | Query capability registry | ⬜ |
| `create_sandbox` | Create isolated env | ⬜ |
| `run_immune_check` | Verify no regression | ⬜ |
| `evaluate_confidence` | Score change confidence | ⬜ |

---

## Agent Inventory

### Current Agents ✅
| Agent | Role | Phase |
|-------|------|-------|
| `Agent` | Base class | 1 |
| `DevAgent` | Code implementation | 2 |
| `QAAgent` | Testing & verification | 2 |
| `PMAgent` | Task planning & coordination | 2 |
| `CEOAgent` | Company orchestration | 3 |
| `JarvisAgent` | Universal entry point | 3 |
| `ArchitectAgent` | System design | 5 |
| `FrontendDevAgent` | React/UI specialist | 5 |
| `BackendDevAgent` | Node/API specialist | 5 |

### Planned Agents
| Agent | Role | Phase |
|-------|------|-------|
| `DevOpsAgent` | Deployment & infrastructure | 6b |
| `MonitoringAgent` | Service monitoring | 6e |
| `IncidentAgent` | Incident response | 6f |
| `PersonaQAAgent` | User persona testing | 7 |
| `VisualQAAgent` | Screenshot-based testing | 7 |
| `ContentAgent` | Blog/docs creation | 9 |
| `SEOAgent` | Search optimization | 9 |
| `SocialAgent` | Social media | 9 |
| `TriageAgent` | Support categorization | 10 |
| `ResponseAgent` | Support responses | 10 |
| `RevenueTracker` | Income monitoring | 11 |
| `CostTracker` | Expense monitoring | 11 |
| `ChiefOfStaffAgent` | User's personal agent | 12 |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Unit Tests | 520+ | 1100+ |
| Security Tests | 24 | 50+ |
| E2E Tests | 8 | 30+ |
| Benchmark Pass | Phase 5 | Phase 12 |
| Autonomous Ops | 0% | 90%+ |
