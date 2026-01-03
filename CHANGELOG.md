# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
