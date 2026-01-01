# ACIA - Autonomous Company Intelligence Architecture

A multi-agent system that simulates a self-improving software company. Agents collaborate to plan, develop, test, and deploy software autonomously.

## Vision

ACIA creates a virtual software company where AI agents work together like a real development team:
- **Jarvis**: Universal entry point for human interaction
- **CEO Agents**: Manage individual companies/projects
- **PM Agents**: Plan and coordinate development work
- **Dev Agents**: Write code and implement features
- **QA Agents**: Test and ensure quality
- **DevOps Agents**: Deploy and maintain infrastructure

The system is self-improving: ACIA (the company) develops and improves ACIA (the software).

## Current Status

**Phase 1a: Basic Agent Communication** - In Development

See [docs/STATUS.md](docs/STATUS.md) for detailed progress.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/damianreusser-dev/acia.git
cd acia

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Run tests
npm test

# Start the CLI
npm run dev
```

## Development

```bash
# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Testing
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:watch    # Watch mode

# Build
npm run build
```

## Project Structure

```
acia/
├── src/
│   ├── agents/       # Agent implementations
│   ├── core/         # Core systems (LLM, messaging, etc.)
│   └── cli/          # Command line interface
├── tests/            # Test suites
├── docs/             # Documentation
└── wiki/             # Agent knowledge base
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - Instructions for AI assistants
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) - What we're building
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design
- [docs/STATUS.md](docs/STATUS.md) - Current progress

## License

MIT
