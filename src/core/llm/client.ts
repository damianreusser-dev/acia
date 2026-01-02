/**
 * LLM Client - Wrapper for Anthropic Claude API
 *
 * Provides a clean interface for interacting with the Claude API.
 * Includes caching, metrics, and structured logging.
 */

import Anthropic from '@anthropic-ai/sdk';
import { LLMResponseCache, LLMCacheEntry } from '../cache/cache.js';
import { getMetrics } from '../metrics/metrics.js';
import { createLogger, getCorrelationId } from '../logging/logger.js';

const logger = createLogger('LLMClient');

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  cached?: boolean;
}

export interface LLMClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  cacheMaxSize?: number;
}

export class LLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private cache: LLMResponseCache | null;

  constructor(config: LLMClientConfig) {
    if (!config.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }

    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens ?? 4096;

    // Initialize cache if enabled
    if (config.cacheEnabled ?? false) {
      this.cache = new LLMResponseCache({
        ttlMs: config.cacheTtlMs,
        maxSize: config.cacheMaxSize,
      });
      logger.info('LLM response cache enabled', {
        maxSize: config.cacheMaxSize ?? 1000,
        ttlMs: config.cacheTtlMs ?? 3600000,
      });
    } else {
      this.cache = null;
    }
  }

  async chat(messages: LLMMessage[], systemPrompt?: string): Promise<LLMResponse> {
    const startTime = Date.now();
    const correlationId = getCorrelationId();
    const metrics = getMetrics();

    // Check cache first
    if (this.cache) {
      const cached = this.cache.getResponse(messages, systemPrompt, this.model);
      if (cached) {
        const latencyMs = Date.now() - startTime;
        logger.debug('Cache hit', {
          correlationId,
          inputTokens: cached.usage.inputTokens,
          outputTokens: cached.usage.outputTokens,
          latencyMs,
        });

        metrics.recordLLMRequest({
          inputTokens: cached.usage.inputTokens,
          outputTokens: cached.usage.outputTokens,
          latencyMs,
          cached: true,
        });

        return {
          content: cached.content,
          stopReason: cached.stopReason,
          usage: cached.usage,
          cached: true,
        };
      }
    }

    // Make the API request
    logger.debug('Sending request to Anthropic API', {
      correlationId,
      model: this.model,
      messageCount: messages.length,
    });

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const textContent = response.content.find((c) => c.type === 'text');
      const content = textContent && 'text' in textContent ? textContent.text : '';
      const latencyMs = Date.now() - startTime;

      const result: LLMResponse = {
        content,
        stopReason: response.stop_reason,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        cached: false,
      };

      // Record metrics
      metrics.recordLLMRequest({
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        latencyMs,
        cached: false,
      });

      logger.debug('Received response from Anthropic API', {
        correlationId,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        latencyMs,
        stopReason: result.stopReason,
      });

      // Cache the response
      if (this.cache) {
        const cacheEntry: LLMCacheEntry = {
          content: result.content,
          stopReason: result.stopReason,
          usage: result.usage,
        };
        this.cache.setResponse(messages, cacheEntry, systemPrompt, this.model);
      }

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      metrics.recordLLMRequest({
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        error: true,
        cached: false,
      });

      logger.error('Anthropic API request failed', {
        correlationId,
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const response = await this.chat([{ role: 'user', content: prompt }], systemPrompt);
    return response.content;
  }

  /**
   * Get cache statistics (if caching is enabled).
   */
  getCacheStats(): { enabled: boolean; stats?: ReturnType<LLMResponseCache['getStats']> } {
    if (!this.cache) {
      return { enabled: false };
    }
    return {
      enabled: true,
      stats: this.cache.getStats(),
    };
  }

  /**
   * Clear the cache.
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Enable or disable caching.
   */
  setCacheEnabled(enabled: boolean): void {
    if (this.cache) {
      this.cache.setEnabled(enabled);
    }
  }
}
