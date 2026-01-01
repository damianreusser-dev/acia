/**
 * LLM Client - Wrapper for Anthropic Claude API
 *
 * Provides a clean interface for interacting with the Claude API.
 * This is the foundation for all agent reasoning.
 */

import Anthropic from '@anthropic-ai/sdk';

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
}

export interface LLMClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class LLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: LLMClientConfig) {
    if (!config.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }

    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens ?? 4096;
  }

  async chat(messages: LLMMessage[], systemPrompt?: string): Promise<LLMResponse> {
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

    return {
      content,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const response = await this.chat([{ role: 'user', content: prompt }], systemPrompt);
    return response.content;
  }
}
