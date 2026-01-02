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

**Phase 3: Enhanced Capabilities** - COMPLETE

The system is fully functional with:
- Full agent hierarchy (Jarvis → CEO → Team → PM/Dev/QA)
- Design-First development workflow
- Wiki-based knowledge management
- Pub/Sub communication channels
- 266 tests passing

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

# Start the CLI (uses Jarvis as entry point)
npm run dev
```

## Usage

Once running, you can give Jarvis any development task:

```
You: Create a TypeScript file with a function that adds two numbers

🤖 Processing...

✅ Success
⏱️  5.2s
────────────────────────────────────
I've created calculator.ts with an add function...
────────────────────────────────────
```

**Commands:**
- `/status` - Show system status (companies, projects)
- `/clear` - Clear conversation history
- `/exit` - Exit the CLI

**Example Tasks:**
- "Create a greeting.ts file that exports a greet function"
- "Build a simple calculator with add, subtract, multiply, divide"
- "What is the status of active projects?"

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
npm run test:int      # Integration tests
npm run test:e2e      # E2E tests (needs API key)
npm run test:watch    # Watch mode

# E2E tests with real API
RUN_E2E_TESTS=true npm run test:e2e

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
