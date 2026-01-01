/**
 * Base Agent Class
 *
 * Foundation for all ACIA agents. Provides:
 * - LLM integration for reasoning
 * - Message handling
 * - Basic lifecycle management
 */

import { LLMClient, LLMMessage } from '../../core/llm/client.js';

export interface AgentConfig {
  name: string;
  role: string;
  systemPrompt: string;
  llmClient: LLMClient;
}

export interface AgentMessage {
  from: string;
  to: string;
  content: string;
  timestamp: Date;
}

export class Agent {
  readonly name: string;
  readonly role: string;
  private systemPrompt: string;
  private llmClient: LLMClient;
  private conversationHistory: LLMMessage[] = [];

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.llmClient = config.llmClient;
  }

  /**
   * Process an incoming message and generate a response
   */
  async processMessage(message: string): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: message,
    });

    const response = await this.llmClient.chat(this.conversationHistory, this.systemPrompt);

    this.conversationHistory.push({
      role: 'assistant',
      content: response.content,
    });

    return response.content;
  }

  /**
   * Get the full conversation history
   */
  getHistory(): LLMMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get agent info for logging/debugging
   */
  getInfo(): { name: string; role: string; historyLength: number } {
    return {
      name: this.name,
      role: this.role,
      historyLength: this.conversationHistory.length,
    };
  }
}
