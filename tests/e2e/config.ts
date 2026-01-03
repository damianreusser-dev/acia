/**
 * E2E Test Configuration
 *
 * Standardized timeout tiers for different test complexities.
 * Based on observed LLM response times (20-160s per call).
 */

/**
 * Timeout tiers for E2E tests.
 * Each tier represents a different level of test complexity.
 */
export const E2E_TIMEOUTS = {
  /** Tier 0: Foundation tests - basic connectivity (<30s) */
  TIER_0_FOUNDATION: 30_000,

  /** Tier 1: Tool execution tests - single tool calls (<60s) */
  TIER_1_TOOL: 60_000,

  /** Tier 2: Agent behavior tests - isolated agent actions (<180s) */
  TIER_2_AGENT: 180_000,

  /** Tier 3: Workflow tests - PM → Dev flows (<300s) */
  TIER_3_WORKFLOW: 300_000,

  /** Tier 4: Integration tests - full team + CEO flows (<600s) */
  TIER_4_INTEGRATION: 600_000,

  /** Tier 5: Benchmark tests - complete application flows (<900s) */
  TIER_5_BENCHMARK: 900_000,

  /** Tier 6: Extended benchmark - complex multi-team flows (<1200s) */
  TIER_6_EXTENDED: 1_200_000,
} as const;

/**
 * Check if E2E tests should run based on environment.
 */
export function shouldRunE2ETests(): boolean {
  return process.env.RUN_E2E_TESTS === 'true';
}

/**
 * Get the LLM provider from environment.
 */
export function getLLMProvider(): 'openai' | 'anthropic' {
  const provider = process.env.LLM_PROVIDER || 'openai';
  return provider as 'openai' | 'anthropic';
}

/**
 * Check if API key is configured for the selected provider.
 */
export function hasAPIKey(): boolean {
  const provider = getLLMProvider();
  if (provider === 'openai') {
    return !!process.env.OPENAI_API_KEY;
  }
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Get the API key for the selected provider.
 */
export function getAPIKey(): string {
  const provider = getLLMProvider();
  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY || '';
  }
  return process.env.ANTHROPIC_API_KEY || '';
}

/**
 * Standard test skip condition for E2E tests.
 * Use with: it.skipIf(!canRunE2E())
 */
export function canRunE2E(): boolean {
  return shouldRunE2ETests() && hasAPIKey();
}

/**
 * Log E2E test environment info.
 * Call at start of test suites for debugging.
 */
export function logE2EEnvironment(prefix: string = ''): void {
  const pre = prefix ? `[${prefix}] ` : '';
  console.log(`${pre}LLM Provider: ${getLLMProvider()}`);
  console.log(`${pre}API key set: ${hasAPIKey()}`);
  console.log(`${pre}RUN_E2E_TESTS: ${process.env.RUN_E2E_TESTS}`);
  console.log(`${pre}E2E tests will run: ${canRunE2E()}`);
}
