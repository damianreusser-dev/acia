/**
 * LLM Client - Multi-provider LLM abstraction
 *
 * Supports both Anthropic Claude and OpenAI APIs.
 * Includes caching, metrics, and structured logging.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { LLMResponseCache, LLMCacheEntry } from '../cache/cache.js';
import { getMetrics } from '../metrics/metrics.js';
import { createLogger, getCorrelationId } from '../logging/logger.js';
import { Tool } from '../tools/types.js';

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
  /** Native function calls from OpenAI (when tools are enabled) */
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

/** Options for chat requests with tool support */
export interface ChatOptions {
  tools?: Tool[];
  toolChoice?: 'auto' | 'required' | { name: string };
}

/**
 * Convert our Tool definitions to OpenAI's function calling format.
 */
function toOpenAITools(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.definition.name,
      description: tool.definition.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          tool.definition.parameters.map(p => [
            p.name,
            { type: p.type, description: p.description }
          ])
        ),
        required: tool.definition.parameters
          .filter(p => p.required)
          .map(p => p.name),
      },
    },
  }));
}

export type LLMProvider = 'anthropic' | 'openai';

export interface LLMClientConfig {
  provider?: LLMProvider;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  cacheMaxSize?: number;
}

export class LLMClient {
  private readonly provider: LLMProvider;
  private readonly anthropicClient?: Anthropic;
  private readonly openaiClient?: OpenAI;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly cache: LLMResponseCache | null;

  constructor(config: LLMClientConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    this.provider = config.provider ?? 'openai';
    this.maxTokens = config.maxTokens ?? 4096;

    if (this.provider === 'anthropic') {
      this.anthropicClient = new Anthropic({ apiKey: config.apiKey });
      this.model = config.model ?? 'claude-sonnet-4-20250514';
    } else {
      this.openaiClient = new OpenAI({ apiKey: config.apiKey });
      this.model = config.model ?? 'gpt-5-mini';
    }

    // Initialize cache if enabled
    if (config.cacheEnabled ?? false) {
      this.cache = new LLMResponseCache({
        ttlMs: config.cacheTtlMs,
        maxSize: config.cacheMaxSize,
      });
      logger.info('LLM response cache enabled', {
        provider: this.provider,
        model: this.model,
        maxSize: config.cacheMaxSize ?? 1000,
        ttlMs: config.cacheTtlMs ?? 3600000,
      });
    } else {
      this.cache = null;
    }
  }

  async chat(
    messages: LLMMessage[],
    systemPrompt?: string,
    options?: ChatOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const correlationId = getCorrelationId();
    const metrics = getMetrics();

    // Check cache first (skip cache if tools are provided - responses vary)
    if (this.cache && !options?.tools) {
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
    logger.debug(`Sending request to ${this.provider} API`, {
      correlationId,
      provider: this.provider,
      model: this.model,
      messageCount: messages.length,
      hasTools: !!options?.tools,
    });

    try {
      const result =
        this.provider === 'anthropic'
          ? await this.chatAnthropic(messages, systemPrompt)
          : await this.chatOpenAI(messages, systemPrompt, options);

      const latencyMs = Date.now() - startTime;

      // Record metrics
      metrics.recordLLMRequest({
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        latencyMs,
        cached: false,
      });

      logger.debug(`Received response from ${this.provider} API`, {
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

      logger.error(`${this.provider} API request failed`, {
        correlationId,
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Make a chat request to Anthropic Claude API.
   */
  private async chatAnthropic(
    messages: LLMMessage[],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    const response = await this.anthropicClient.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content.find(
      (c): c is Anthropic.TextBlock => c.type === 'text'
    );
    const content = textContent?.text ?? '';

    return {
      content,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      cached: false,
    };
  }

  /**
   * Make a chat request to OpenAI API.
   * Supports native function calling when tools are provided.
   */
  private async chatOpenAI(
    messages: LLMMessage[],
    systemPrompt?: string,
    options?: ChatOptions
  ): Promise<LLMResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      openaiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const m of messages) {
      openaiMessages.push({ role: m.role, content: m.content });
    }

    // Build tool_choice parameter if tools are provided
    let toolChoice: OpenAI.ChatCompletionToolChoiceOption | undefined;
    if (options?.tools && options.toolChoice) {
      if (typeof options.toolChoice === 'string') {
        toolChoice = options.toolChoice;
      } else {
        toolChoice = { type: 'function', function: { name: options.toolChoice.name } };
      }
    }

    const response = await this.openaiClient.chat.completions.create({
      model: this.model,
      max_completion_tokens: this.maxTokens,
      messages: openaiMessages,
      tools: options?.tools ? toOpenAITools(options.tools) : undefined,
      tool_choice: options?.tools ? (toolChoice ?? 'auto') : undefined,
    });

    // Extract native tool calls if present
    const nativeToolCalls = response.choices[0]?.message?.tool_calls;
    const toolCalls = nativeToolCalls
      ?.filter((tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall & { type: 'function' } =>
        tc.type === 'function'
      )
      .map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>,
      }));

    return {
      content: response.choices[0]?.message?.content ?? '',
      stopReason: response.choices[0]?.finish_reason ?? null,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      cached: false,
      toolCalls,
    };
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
