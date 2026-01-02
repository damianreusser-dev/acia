#!/bin/bash
cd /c/SOWISO/acia

# Load .env
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Run E2E tests
export RUN_E2E_TESTS=true
npm run test:e2e -- --run tests/e2e/jarvis-e2e.test.ts
