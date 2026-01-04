# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.4] - 2026-01-04 - Phase 6 Cleanup: E2E Test Improvements

### Changed
- **E2E Test Environment Loading**
  - Added `import 'dotenv/config'` at top of E2E test files
  - Ensures RUN_E2E_TESTS env var is loaded before `describe.runIf()` evaluation
  - Also updated vitest.config.ts for immediate dotenv loading

- **E2E Test Reliability**
  - TypeScript checks now tolerate unused variable warnings (TS6133, TS6196)
  - LLM-generated code may have minor linting issues that don't affect functionality
  - Only fails on actual compile errors, not style warnings

### Fixed
- E2E tests now correctly detect RUN_E2E_TESTS from .env file
- Removed false positives from strict TypeScript checks in LLM-generated code

## [0.6.3] - 2026-01-04 - Phase 6i: Deployment Reliability & Agent Workflow Fixes

### Added
- **Deployment Diagnostics Test Suite**
  - D1: Agent Configuration tests (DevOpsAgent, BackendDevAgent initialization)
  - D2: Docker Tool Definitions tests (docker_build, docker_compose_up/down)
  - D3: DevOpsAgent System Prompt tests (Dockerfile creation instructions)
  - D4: Dockerfile Validation Patterns tests (FROM, EXPOSE, volume mounts)
  - D5: Task Detection tests (Docker/deployment keywords)
  - D6: Health Check Patterns tests (Dockerfile HEALTHCHECK, compose healthcheck)
  - Jarvis Deployment Intent Detection tests (local vs Azure keywords)
  - 38 new unit tests for deployment diagnostics

- **Agent File Path Handling**
  - Team.activeProjectPath property to track scaffolded project location
  - Team.extractProjectPath() method to extract path from tool results
  - Team.isScaffoldTask() for scaffold task detection
  - DevAgent PROJECT PATH CONTEXT injection in task prompts
  - Agents instructed to use full paths like `${projectPath}/src/routes/`
  - 4 new unit tests for path tracking

- **Express Template Docker Files**
  - Multi-stage Dockerfile (builder + production stages)
  - Alpine-based production image with curl for health checks
  - .dockerignore excludes node_modules, .git, .env, tests, coverage
  - Health check configured for `/api/health` endpoint
  - 2 new unit tests for Docker file generation

- **Docker Templates**
  - createNodeDockerfile() for pre-built applications
  - createNodeDockerfileWithBuild() for multi-stage builds
  - createDockerCompose() for generic compose files
  - createSingleServiceCompose() for single backend service
  - createFullstackCompose() for frontend + backend with health checks

- **Compose Validator**
  - Detects problematic volume mounts that overwrite /app or /usr/src/app
  - Warns about missing health checks
  - Warns about missing restart policies
  - Validates services section exists

- **Phase 6 Deployment Plan**
  - docs/PHASE-6-DEPLOYMENT-PLAN.md with comprehensive root cause analysis
  - D1-D6 diagnostic test hierarchy
  - Sprint implementation order
  - Success criteria and verification checklist

### Changed
- Team.executeDevTask() now injects project path into task context
- DevAgent.buildTaskPrompt() includes PROJECT PATH CONTEXT section
- Express template now includes Dockerfile and .dockerignore

### Fixed
- Agents no longer write files to workspace root after scaffolding
- Files are written to correct project subdirectory paths
- Volume mount issues in docker-compose.yml templates (no /app overwrites)

**Test Counts:**
- Total unit tests: 1006 passing
- E2E tests: 34 passing (when API key/Docker/Azure available)
- Phase 6 complete with ~425 new tests

## [0.6.2] - 2026-01-03 - Phase 6h: Azure Deployment + Build-Deploy-Monitor

### Added
- **Phase 6h: Azure Deploy Tools**
  - DeployToAzureAppServiceTool: Deploy Node.js backend to Azure App Service
  - DeployToAzureStaticWebTool: Deploy React frontend to Azure Static Web Apps
  - DeployToAzureContainerAppsTool: Deploy Docker containers to Azure Container Apps
  - GetAzureDeploymentStatusTool: Check deployment status
  - GetAzureDeploymentLogsTool: Get deployment logs
  - DeleteAzureDeploymentTool: Clean up Azure resources
  - All tools have ['devops', 'ops'] roles for role-based access
  - 53 new unit tests for Azure tools

- **CEO Build-Deploy-Monitor Workflow**
  - DeploymentConfig interface for local/azure-appservice/azure-containers targets
  - CEODeploymentResult interface for combined build + deploy + monitoring results
  - executeGoalWithDeployment() method for end-to-end build-deploy-monitor flow
  - Sequential workflow: Tech Team builds → Ops Team deploys → Ops Team monitors
  - 9 new unit tests for CEO deployment workflow

- **Local Docker Deployment Flow**
  - OpsDivision.detectDeploymentTarget() for local/azure/general routing
  - executeLocalDockerDeployment() with docker-compose support
  - extractPortsFromDescription() for custom port configuration
  - Auto-registration of monitoring targets after local deployment
  - Default ports: frontend 3000, backend 3001

- **Jarvis Deployment Integration**
  - detectDeploymentIntent() for deploy/launch/host keywords
  - extractProjectName() from natural language requests
  - createCompanyAndDeploy() for build-deploy-monitor flow
  - generateDeploymentSummary() for user-friendly response
  - JarvisResult extended with deploymentResult and urls fields
  - Auto-includes docker, deploy, and azure tools in workspace mode

- **Build-Deploy-Monitor E2E Benchmark Tests**
  - tests/e2e/benchmarks/build-deploy-monitor.test.ts
  - Local Docker deployment tests (requires Docker Desktop)
  - Monitoring auto-setup tests
  - Azure App Service deployment tests (requires Azure CLI + credentials)
  - Azure Container Apps deployment tests
  - Incident detection and auto-restart tests
  - Deployment intent detection tests
  - 8 E2E benchmark tests (conditional on Docker/Azure availability)

### Changed
- Removed Railway and Vercel tools from deploy-tools.ts (focus on Azure + local Docker)
- OpsDivision now supports local Docker and Azure deployment targets
- Jarvis now auto-includes deployment tools when workspace is specified

### Fixed
- createDockerTools() call in Jarvis (was incorrectly passing workspace argument)
- TypeScript null checks in extractProjectName() method

## [0.6.1] - 2026-01-03 - Phase 6b-6g: Deployment & Operations Complete

### Added
- **Phase 6b: DevOpsAgent & Tools**
  - DevOpsAgent for containerization and cloud deployment tasks
  - Docker tools: docker_build, docker_run, docker_compose_up/down, docker_logs, docker_ps, docker_stop, docker_rm
  - Deploy tools: deploy_to_railway, deploy_to_vercel, get_deployment_status, get_deployment_logs, rollback_deployment, delete_deployment, health_check
  - Deployment capability benchmark tests
  - 98 new tests (16 DevOpsAgent + 37 Docker + 35 Deploy + 10 benchmark)

- **Phase 6c-6e: MonitoringAgent & IncidentAgent**
  - MonitoringAgent for health check monitoring, metrics collection, and alert generation
    - Target management (add/remove monitoring targets)
    - Health state tracking (healthy/unhealthy/unknown)
    - Consecutive failure counting with configurable alert threshold
    - Severity-based alerts (medium at 3 failures, high at 5, critical at 10)
  - IncidentAgent for incident lifecycle management and automated recovery
    - Runbook execution from wiki-based configurations
    - Recovery strategies: restart (2 attempts) → rollback (1 attempt) → escalate
    - Incident state machine (detected → acknowledged → investigating → mitigating → resolved/escalated)
    - Automatic escalation when recovery attempts exhausted
  - Incident recovery benchmark tests (health failure detection, auto-restart, rollback, escalation)
  - 72 new tests (19 MonitoringAgent + 32 IncidentAgent + 21 benchmark)

- **Phase 6f-6g: OpsDivision & Registration**
  - OpsDivision implementing ITeam interface for CEO/TeamFactory integration
  - Coordinates DevOpsAgent, MonitoringAgent, and IncidentAgent
  - Task type detection (deployment, monitoring, incident) with workflow routing
  - Role-based tool filtering for ops agents (devops, monitoring, incident roles)
  - TeamFactory registration for 'ops' team type
  - 18 new tests for OpsDivision

### Fixed
- MonitoringAgent constructor now copies targets array to prevent shared reference mutation between tests

## [0.6.0] - 2026-01-03 - Phase 6a: Coordination Layer Refactoring

### Added
- ITeam interface for team abstraction (executeTask, getAgentRoles, getName, getWorkspace)
- TeamFactory for creating teams by type without implementation coupling
- WorkflowResult interface for standardized team execution results
- AgentRole type system (pm, dev, qa, devops, ops, content, monitoring, incident)
- Tool.roles property for role-based tool access control
- filterToolsByRole() utility with backward compatibility
- scaffold-detector.ts shared utility (isScaffoldTask, isCustomizeTask, extractProjectName, etc.)
- response-parser.ts shared utility (analyzeResponse, extractModifiedFiles, parseToolResults, etc.)
- CEO.registerTeam() method for custom team instances
- Phase 6a benchmark tests (coordination-refactor.test.ts)
- 143 new tests (ITeam, TeamFactory, tool permissions, utilities)

### Changed
- CEO now uses ITeam interface instead of concrete Team class
- CEO.createTeam() uses TeamFactory internally
- CEO.getTeam() returns ITeam instead of Team
- Team class implements ITeam interface
- Moved Priority and WorkflowResult to team-interface.ts

## [0.5.0] - 2026-01-03 - Phase 5: Fullstack Capability

### Added
- **MILESTONE**: ACIA can now create complete fullstack applications from a single prompt
- ArchitectAgent for system design and API contract creation
- GitTools (git_init, git_add, git_commit, git_status, git_branch, git_log)
- FrontendDevAgent (React/TypeScript specialist)
- BackendDevAgent (Node/Express specialist)
- Project templates (React, Express, Fullstack)
- Template tools (list_templates, generate_project, preview_template)
- Multi-team coordination in CEO (executeGoalMultiTeam)
- Tool call enforcement with retry loop (MAX_TASK_RETRIES=3)
- OpenAI native function calling support
- Diagnostic test suite (D0-D5)
- Benchmark test: fullstack todo app creation

### Fixed
- BackendDevAgent and FrontendDevAgent now extend DevAgent (inherit tool verification)
- PM task descriptions use full paths (${projectName}/backend/src/routes/)
- CEO isScaffoldGoal() detects detailed requirements correctly
- Template structure creates proper subdirectories (frontend/, backend/)

### Changed
- DevAgent now supports optional systemPrompt and role configuration
- PM extractSectionRequirements() generates full path instructions
- Reduced maxIterations for scaffold tasks (2) and customize tasks (5)

## [0.4.0] - 2026-01-02 - Phase 4: Production Hardening

### Added
- Security hardening (shell injection, path traversal prevention)
- Memory bounds for Agent (100 messages) and Channel (1000 messages)
- LRU cache for LLM responses with TTL
- Structured JSON logging with correlation IDs
- Performance metrics collector

## [0.3.0] - 2026-01-02 - Phase 3: Enhanced Capabilities

### Added
- Wiki/Memory system with CRUD and search
- Design-First development workflow
- CEO agent for higher-level orchestration
- Jarvis agent as universal entry point
- Communication channels with pub/sub messaging
- CLI upgraded to use Jarvis

## [0.2.0] - 2026-01-02 - Phase 2: Basic Team

### Added
- Task system with status, priority, attempts
- DevAgent, QAAgent, PMAgent specialized agents
- Team class coordinating PM → Dev → QA workflow
- Dev → QA → Fix iteration loop with maxIterations
- E2E tests validating real LLM integration

## [0.1.0] - 2026-01-01 - Phase 1: Foundation

### Added
- Initial project structure
- Base Agent class with LLM integration
- LLMClient wrapper for Anthropic Claude API
- CLI interface for agent interaction
- File tools (read_file, write_file, list_directory)
- Execution tools (run_code, run_test, run_npm_script)
- Unit tests for Agent and LLMClient
- GitHub Actions CI pipeline
- ESLint and Prettier configuration
- Project documentation (README, REQUIREMENTS, ARCHITECTURE, STATUS)
- Project initialization (fresh start from acia-legacy)
