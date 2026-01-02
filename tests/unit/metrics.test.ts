/**
 * Metrics Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MetricsCollector,
  getMetrics,
  withTiming,
} from '../../src/core/metrics/metrics.js';

describe('MetricsCollector', () => {
  beforeEach(() => {
    MetricsCollector.resetInstance();
  });

  afterEach(() => {
    MetricsCollector.resetInstance();
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = MetricsCollector.getInstance();
      const instance2 = MetricsCollector.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should reset instance correctly', () => {
      const instance1 = MetricsCollector.getInstance();
      instance1.recordLLMRequest({
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 500,
      });

      MetricsCollector.resetInstance();
      const instance2 = MetricsCollector.getInstance();

      expect(instance2).not.toBe(instance1);
      expect(instance2.getLLMMetrics().requestCount).toBe(0);
    });
  });

  describe('LLM Metrics', () => {
    it('should record LLM requests', () => {
      const metrics = getMetrics();

      metrics.recordLLMRequest({
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 500,
      });

      const llmMetrics = metrics.getLLMMetrics();
      expect(llmMetrics.requestCount).toBe(1);
      expect(llmMetrics.totalInputTokens).toBe(100);
      expect(llmMetrics.totalOutputTokens).toBe(50);
      expect(llmMetrics.totalLatencyMs).toBe(500);
      expect(llmMetrics.averageLatencyMs).toBe(500);
    });

    it('should calculate averages correctly', () => {
      const metrics = getMetrics();

      metrics.recordLLMRequest({ inputTokens: 100, outputTokens: 50, latencyMs: 400 });
      metrics.recordLLMRequest({ inputTokens: 200, outputTokens: 100, latencyMs: 600 });

      const llmMetrics = metrics.getLLMMetrics();
      expect(llmMetrics.requestCount).toBe(2);
      expect(llmMetrics.totalInputTokens).toBe(300);
      expect(llmMetrics.totalOutputTokens).toBe(150);
      expect(llmMetrics.averageLatencyMs).toBe(500);
    });

    it('should track min and max latency', () => {
      const metrics = getMetrics();

      metrics.recordLLMRequest({ inputTokens: 100, outputTokens: 50, latencyMs: 300 });
      metrics.recordLLMRequest({ inputTokens: 100, outputTokens: 50, latencyMs: 700 });
      metrics.recordLLMRequest({ inputTokens: 100, outputTokens: 50, latencyMs: 500 });

      const llmMetrics = metrics.getLLMMetrics();
      expect(llmMetrics.minLatencyMs).toBe(300);
      expect(llmMetrics.maxLatencyMs).toBe(700);
    });

    it('should track errors', () => {
      const metrics = getMetrics();

      metrics.recordLLMRequest({ inputTokens: 0, outputTokens: 0, latencyMs: 100, error: true });
      metrics.recordLLMRequest({ inputTokens: 100, outputTokens: 50, latencyMs: 500 });

      const llmMetrics = metrics.getLLMMetrics();
      expect(llmMetrics.errorCount).toBe(1);
      expect(llmMetrics.requestCount).toBe(2);
    });

    it('should track cache hits and misses', () => {
      const metrics = getMetrics();

      metrics.recordLLMRequest({ inputTokens: 100, outputTokens: 50, latencyMs: 500, cached: false });
      metrics.recordLLMRequest({ inputTokens: 100, outputTokens: 50, latencyMs: 5, cached: true });
      metrics.recordLLMRequest({ inputTokens: 100, outputTokens: 50, latencyMs: 5, cached: true });

      const llmMetrics = metrics.getLLMMetrics();
      expect(llmMetrics.cacheHits).toBe(2);
      expect(llmMetrics.cacheMisses).toBe(1);
    });

    it('should handle zero requests gracefully', () => {
      const metrics = getMetrics();
      const llmMetrics = metrics.getLLMMetrics();

      expect(llmMetrics.requestCount).toBe(0);
      expect(llmMetrics.averageLatencyMs).toBe(0);
      expect(llmMetrics.minLatencyMs).toBe(0); // Converted from Infinity
    });
  });

  describe('Tool Metrics', () => {
    it('should record tool executions', () => {
      const metrics = getMetrics();

      metrics.recordToolExecution({
        toolName: 'read_file',
        latencyMs: 50,
        success: true,
      });

      const toolMetrics = metrics.getToolMetrics('read_file');
      expect(toolMetrics).toBeDefined();
      expect(toolMetrics!.executionCount).toBe(1);
      expect(toolMetrics!.successCount).toBe(1);
      expect(toolMetrics!.errorCount).toBe(0);
    });

    it('should track success and error counts', () => {
      const metrics = getMetrics();

      metrics.recordToolExecution({ toolName: 'write_file', latencyMs: 100, success: true });
      metrics.recordToolExecution({ toolName: 'write_file', latencyMs: 50, success: false });
      metrics.recordToolExecution({ toolName: 'write_file', latencyMs: 80, success: true });

      const toolMetrics = metrics.getToolMetrics('write_file');
      expect(toolMetrics!.executionCount).toBe(3);
      expect(toolMetrics!.successCount).toBe(2);
      expect(toolMetrics!.errorCount).toBe(1);
    });

    it('should calculate average latency per tool', () => {
      const metrics = getMetrics();

      metrics.recordToolExecution({ toolName: 'run_test', latencyMs: 100, success: true });
      metrics.recordToolExecution({ toolName: 'run_test', latencyMs: 300, success: true });

      const toolMetrics = metrics.getToolMetrics('run_test');
      expect(toolMetrics!.averageLatencyMs).toBe(200);
    });

    it('should return undefined for unknown tools', () => {
      const metrics = getMetrics();
      expect(metrics.getToolMetrics('unknown_tool')).toBeUndefined();
    });

    it('should track multiple tools independently', () => {
      const metrics = getMetrics();

      metrics.recordToolExecution({ toolName: 'tool_a', latencyMs: 100, success: true });
      metrics.recordToolExecution({ toolName: 'tool_b', latencyMs: 200, success: false });

      expect(metrics.getToolMetrics('tool_a')!.successCount).toBe(1);
      expect(metrics.getToolMetrics('tool_b')!.errorCount).toBe(1);
    });
  });

  describe('Snapshot', () => {
    it('should return complete metrics snapshot', () => {
      const metrics = getMetrics();

      metrics.recordLLMRequest({ inputTokens: 100, outputTokens: 50, latencyMs: 500 });
      metrics.recordToolExecution({ toolName: 'test_tool', latencyMs: 50, success: true });

      const snapshot = metrics.getSnapshot();

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.uptime).toBeGreaterThanOrEqual(0);
      expect(snapshot.llm.requestCount).toBe(1);
      expect(snapshot.tools['test_tool']).toBeDefined();
    });

    it('should include uptime', async () => {
      const metrics = getMetrics();

      await new Promise((r) => setTimeout(r, 50));

      const snapshot = metrics.getSnapshot();
      expect(snapshot.uptime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      const metrics = getMetrics();

      metrics.recordLLMRequest({ inputTokens: 100, outputTokens: 50, latencyMs: 500 });
      metrics.recordToolExecution({ toolName: 'test', latencyMs: 50, success: true });

      metrics.reset();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.llm.requestCount).toBe(0);
      expect(Object.keys(snapshot.tools)).toHaveLength(0);
    });
  });

  describe('Enable/Disable', () => {
    it('should not record when disabled', () => {
      const metrics = getMetrics();

      metrics.setEnabled(false);
      metrics.recordLLMRequest({ inputTokens: 100, outputTokens: 50, latencyMs: 500 });
      metrics.recordToolExecution({ toolName: 'test', latencyMs: 50, success: true });

      const snapshot = metrics.getSnapshot();
      expect(snapshot.llm.requestCount).toBe(0);
      expect(Object.keys(snapshot.tools)).toHaveLength(0);
    });

    it('should report enabled status', () => {
      const metrics = getMetrics();

      expect(metrics.isEnabled()).toBe(true);
      metrics.setEnabled(false);
      expect(metrics.isEnabled()).toBe(false);
    });
  });
});

describe('withTiming', () => {
  it('should time async operations', async () => {
    let capturedLatency = 0;

    await withTiming(
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'result';
      },
      (latencyMs) => {
        capturedLatency = latencyMs;
      }
    );

    expect(capturedLatency).toBeGreaterThanOrEqual(50);
    expect(capturedLatency).toBeLessThan(150);
  });

  it('should return the operation result', async () => {
    const result = await withTiming(
      async () => 'test-result',
      () => {}
    );

    expect(result).toBe('test-result');
  });

  it('should pass result to callback', async () => {
    let capturedResult: string | undefined;

    await withTiming(
      async () => 'captured',
      (_, result) => {
        capturedResult = result;
      }
    );

    expect(capturedResult).toBe('captured');
  });
});
