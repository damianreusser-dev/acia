/**
 * Performance Metrics
 *
 * Tracks performance metrics for LLM calls, tool execution,
 * and other operations.
 */

export interface LLMMetrics {
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface ToolMetrics {
  executionCount: number;
  successCount: number;
  errorCount: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
}

export interface MetricsSnapshot {
  timestamp: string;
  uptime: number;
  llm: LLMMetrics;
  tools: Record<string, ToolMetrics>;
}

export interface MetricsConfig {
  enabled?: boolean;
  resetIntervalMs?: number;
}

/**
 * Metrics Collector
 *
 * Singleton that collects and aggregates performance metrics.
 */
export class MetricsCollector {
  private static instance: MetricsCollector | null = null;
  private enabled: boolean;
  private startTime: number;
  private llmMetrics: LLMMetrics;
  private toolMetrics: Map<string, ToolMetrics> = new Map();
  private resetIntervalMs: number;
  private resetTimer?: ReturnType<typeof setInterval>;

  private constructor(config: MetricsConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.resetIntervalMs = config.resetIntervalMs ?? 0; // 0 = no auto-reset
    this.startTime = Date.now();
    this.llmMetrics = this.createEmptyLLMMetrics();

    if (this.resetIntervalMs > 0) {
      this.resetTimer = setInterval(() => this.reset(), this.resetIntervalMs);
    }
  }

  private createEmptyLLMMetrics(): LLMMetrics {
    return {
      requestCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalLatencyMs: 0,
      averageLatencyMs: 0,
      minLatencyMs: Infinity,
      maxLatencyMs: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  private createEmptyToolMetrics(): ToolMetrics {
    return {
      executionCount: 0,
      successCount: 0,
      errorCount: 0,
      totalLatencyMs: 0,
      averageLatencyMs: 0,
    };
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(config?: MetricsConfig): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector(config);
    }
    return MetricsCollector.instance;
  }

  /**
   * Reset the singleton instance (useful for testing).
   */
  static resetInstance(): void {
    if (MetricsCollector.instance?.resetTimer) {
      clearInterval(MetricsCollector.instance.resetTimer);
    }
    MetricsCollector.instance = null;
  }

  /**
   * Record an LLM request.
   */
  recordLLMRequest(data: {
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    error?: boolean;
    cached?: boolean;
  }): void {
    if (!this.enabled) return;

    this.llmMetrics.requestCount++;
    this.llmMetrics.totalInputTokens += data.inputTokens;
    this.llmMetrics.totalOutputTokens += data.outputTokens;
    this.llmMetrics.totalLatencyMs += data.latencyMs;
    this.llmMetrics.averageLatencyMs =
      this.llmMetrics.totalLatencyMs / this.llmMetrics.requestCount;
    this.llmMetrics.minLatencyMs = Math.min(
      this.llmMetrics.minLatencyMs,
      data.latencyMs
    );
    this.llmMetrics.maxLatencyMs = Math.max(
      this.llmMetrics.maxLatencyMs,
      data.latencyMs
    );

    if (data.error) {
      this.llmMetrics.errorCount++;
    }

    if (data.cached) {
      this.llmMetrics.cacheHits++;
    } else {
      this.llmMetrics.cacheMisses++;
    }
  }

  /**
   * Record a tool execution.
   */
  recordToolExecution(data: {
    toolName: string;
    latencyMs: number;
    success: boolean;
  }): void {
    if (!this.enabled) return;

    let metrics = this.toolMetrics.get(data.toolName);
    if (!metrics) {
      metrics = this.createEmptyToolMetrics();
      this.toolMetrics.set(data.toolName, metrics);
    }

    metrics.executionCount++;
    metrics.totalLatencyMs += data.latencyMs;
    metrics.averageLatencyMs = metrics.totalLatencyMs / metrics.executionCount;

    if (data.success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }
  }

  /**
   * Get current metrics snapshot.
   */
  getSnapshot(): MetricsSnapshot {
    const toolsObj: Record<string, ToolMetrics> = {};
    for (const [name, metrics] of this.toolMetrics) {
      toolsObj[name] = { ...metrics };
    }

    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      llm: {
        ...this.llmMetrics,
        // Fix Infinity for display
        minLatencyMs:
          this.llmMetrics.minLatencyMs === Infinity
            ? 0
            : this.llmMetrics.minLatencyMs,
      },
      tools: toolsObj,
    };
  }

  /**
   * Get LLM metrics only.
   */
  getLLMMetrics(): LLMMetrics {
    return {
      ...this.llmMetrics,
      minLatencyMs:
        this.llmMetrics.minLatencyMs === Infinity
          ? 0
          : this.llmMetrics.minLatencyMs,
    };
  }

  /**
   * Get metrics for a specific tool.
   */
  getToolMetrics(toolName: string): ToolMetrics | undefined {
    const metrics = this.toolMetrics.get(toolName);
    return metrics ? { ...metrics } : undefined;
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.llmMetrics = this.createEmptyLLMMetrics();
    this.toolMetrics.clear();
    this.startTime = Date.now();
  }

  /**
   * Enable or disable metrics collection.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if metrics collection is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Destroy the collector, cleaning up any timers.
   */
  destroy(): void {
    if (this.resetTimer) {
      clearInterval(this.resetTimer);
      this.resetTimer = undefined;
    }
  }
}

/**
 * Get the global metrics collector.
 */
export function getMetrics(): MetricsCollector {
  return MetricsCollector.getInstance();
}

/**
 * Helper to time an async operation and record metrics.
 */
export async function withTiming<T>(
  operation: () => Promise<T>,
  onComplete: (latencyMs: number, result: T) => void
): Promise<T> {
  const startTime = Date.now();
  const result = await operation();
  const latencyMs = Date.now() - startTime;
  onComplete(latencyMs, result);
  return result;
}
