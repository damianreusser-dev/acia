/**
 * Response Parser Utility
 *
 * Shared utility for parsing agent responses.
 * Extracts success indicators, file modifications, and other structured data.
 *
 * Part of Phase 6a: Coordination Layer Refactoring
 */

/**
 * Hard failure indicators - actual errors that override success signals
 */
const HARD_FAILURE_INDICATORS = [
  'error:',
  'exception:',
  'failed to write',
  'permission denied',
  'enoent',           // File not found errors
  'eacces',           // Permission errors
  'syntax error',
  'compilation failed',
] as const;

/**
 * Soft failure indicators - suggest failure but not definitive
 */
const SOFT_FAILURE_INDICATORS = [
  'failed to',
  'could not',
  'unable to',
  'cannot complete',
  'blocked by',
] as const;

/**
 * Indicators that tools were actually used
 */
const TOOL_USAGE_INDICATORS = [
  'tool_call',          // Tool call format
  'tool_result',        // Tool result format
  'wrote to',           // File write result
  'file created',       // File creation
  'file updated',       // File update
  'files created',      // Multiple files created
  'files written',      // Multiple files written
  'generated project',  // Template generation
  'scaffolded',         // Scaffold result
  'contents of',        // Showing file contents
  'i created',          // First person file creation
  'i wrote',            // First person file writing
] as const;

/**
 * Success language indicators
 */
const SUCCESS_INDICATORS = [
  'completed',
  'created',
  'implemented',
  'wrote',
  'updated',
  'successfully',
] as const;

/**
 * Tool call metrics for verification
 */
export interface ToolCallMetrics {
  total: number;
  successful: number;
  byTool: Map<string, number>;
}

/**
 * Result of response analysis
 */
export interface ResponseAnalysis {
  success: boolean;
  hasHardFailure: boolean;
  hasSoftFailure: boolean;
  hasToolUsage: boolean;
  hasSuccessIndicator: boolean;
  reason?: string;
}

/**
 * Analyze an agent response to determine if the task was successful.
 *
 * Priority order:
 * 1. Tool call metrics (if available) - successful tool calls = success
 * 2. Hard failures override success signals
 * 3. Soft failures suggest failure
 * 4. Success language + tool usage = success
 * 5. Tool usage alone = success
 *
 * @param response - The agent response text
 * @param metrics - Optional tool call metrics from agent
 * @returns Analysis result with success determination
 */
export function analyzeResponse(
  response: string,
  metrics?: ToolCallMetrics
): ResponseAnalysis {
  const lowerResponse = response.toLowerCase();

  // Check for hard failures
  const hasHardFailure = HARD_FAILURE_INDICATORS.some(f =>
    lowerResponse.includes(f)
  );

  // Check for soft failures
  const hasSoftFailure = SOFT_FAILURE_INDICATORS.some(f =>
    lowerResponse.includes(f)
  );

  // Check for tool usage
  const hasToolUsage = TOOL_USAGE_INDICATORS.some(indicator =>
    lowerResponse.includes(indicator)
  );

  // Check for success indicators
  const hasSuccessIndicator = SUCCESS_INDICATORS.some(indicator =>
    lowerResponse.includes(indicator)
  );

  // PRIORITY 1: Trust tool call metrics if available
  if (metrics && metrics.successful > 0) {
    if (!hasHardFailure) {
      return {
        success: true,
        hasHardFailure,
        hasSoftFailure,
        hasToolUsage: true,
        hasSuccessIndicator,
        reason: `${metrics.successful} successful tool calls`,
      };
    }
    // Hard failure overrides tool metrics
    return {
      success: false,
      hasHardFailure,
      hasSoftFailure,
      hasToolUsage: true,
      hasSuccessIndicator,
      reason: 'Hard failure detected despite tool calls',
    };
  }

  // PRIORITY 2: Soft failure indicators (no successful tool calls)
  if (hasSoftFailure) {
    return {
      success: false,
      hasHardFailure,
      hasSoftFailure,
      hasToolUsage,
      hasSuccessIndicator,
      reason: 'Soft failure indicator found',
    };
  }

  // PRIORITY 3: Success language + tool usage = success
  if (hasSuccessIndicator && hasToolUsage) {
    return {
      success: true,
      hasHardFailure,
      hasSoftFailure,
      hasToolUsage,
      hasSuccessIndicator,
      reason: 'Success indicators with tool usage',
    };
  }

  // PRIORITY 4: Tool usage alone = success
  if (hasToolUsage) {
    return {
      success: true,
      hasHardFailure,
      hasSoftFailure,
      hasToolUsage,
      hasSuccessIndicator,
      reason: 'Tool usage detected',
    };
  }

  // Default: No evidence of actual work
  return {
    success: false,
    hasHardFailure,
    hasSoftFailure,
    hasToolUsage,
    hasSuccessIndicator,
    reason: 'No evidence of actual work performed',
  };
}

/**
 * Determine if response indicates success (simple boolean version).
 *
 * @param response - The agent response text
 * @param metrics - Optional tool call metrics
 * @returns true if task appears successful
 */
export function isSuccessfulResponse(
  response: string,
  metrics?: ToolCallMetrics
): boolean {
  return analyzeResponse(response, metrics).success;
}

/**
 * Extract file paths that were modified from the response.
 * Looks for common patterns indicating file creation/modification.
 *
 * @param response - The agent response text
 * @returns Array of file paths that were modified
 */
export function extractModifiedFiles(response: string): string[] {
  const files: string[] = [];

  // Pattern: "wrote to 'path'" or "wrote to path"
  // Use [\w./-]+ to match file path characters (alphanumeric, dots, slashes, hyphens)
  const writeMatches = response.matchAll(/wrote\s+to\s+['"]?([\w./-]+)['"]?/gi);
  for (const match of writeMatches) {
    if (match[1]) {
      files.push(match[1].trim());
    }
  }

  // Pattern: "created 'path.ext'" or "created path.ext"
  const createdMatches = response.matchAll(/created\s+['"]?([^\s'">\n]+\.[a-z]+)['"]?/gi);
  for (const match of createdMatches) {
    if (match[1]) {
      files.push(match[1].trim());
    }
  }

  // Pattern: "file: path" in structured output
  const fileMatches = response.matchAll(/file:\s*['"]?([^\s'">\n]+\.[a-z]+)['"]?/gi);
  for (const match of fileMatches) {
    if (match[1]) {
      files.push(match[1].trim());
    }
  }

  // Pattern: "writing to path"
  const writingMatches = response.matchAll(/writing\s+to\s+['"]?([^'">\n]+)['"]?/gi);
  for (const match of writingMatches) {
    if (match[1]) {
      files.push(match[1].trim());
    }
  }

  // Deduplicate and return
  return [...new Set(files)];
}

/**
 * Extract error messages from a response.
 *
 * @param response - The agent response text
 * @returns Array of error messages found
 */
export function extractErrors(response: string): string[] {
  const errors: string[] = [];

  // Pattern: "Error: message"
  const errorMatches = response.matchAll(/error:\s*([^\n]+)/gi);
  for (const match of errorMatches) {
    if (match[1]) {
      errors.push(match[1].trim());
    }
  }

  // Pattern: "Failed to ..."
  const failedMatches = response.matchAll(/failed\s+to\s+([^\n.]+)/gi);
  for (const match of failedMatches) {
    if (match[1]) {
      errors.push(`Failed to ${match[1].trim()}`);
    }
  }

  return errors;
}

/**
 * Parse tool call results from response.
 * Extracts tool_result blocks and their content.
 *
 * @param response - The agent response text
 * @returns Array of parsed tool results
 */
export interface ToolResultParsed {
  tool: string;
  success: boolean;
  output?: string;
}

export function parseToolResults(response: string): ToolResultParsed[] {
  const results: ToolResultParsed[] = [];

  // Pattern: <tool_result>...</tool_result>
  const resultBlocks = response.matchAll(/<tool_result>([\s\S]*?)<\/tool_result>/gi);
  for (const match of resultBlocks) {
    if (match[1]) {
      const content = match[1].trim();
      try {
        const parsed = JSON.parse(content);
        results.push({
          tool: parsed.tool || 'unknown',
          success: parsed.success ?? !content.toLowerCase().includes('error'),
          output: parsed.output || content,
        });
      } catch {
        // Not JSON, try to extract info from text
        results.push({
          tool: 'unknown',
          success: !content.toLowerCase().includes('error'),
          output: content,
        });
      }
    }
  }

  return results;
}
