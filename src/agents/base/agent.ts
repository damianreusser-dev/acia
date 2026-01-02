/**
 * Base Agent Class
 *
 * Foundation for all ACIA agents. Provides:
 * - LLM integration for reasoning
 * - Tool execution capabilities
 * - Message handling
 * - Basic lifecycle management
 */

import { LLMClient, LLMMessage } from '../../core/llm/client.js';
import { Tool, ToolResult } from '../../core/tools/types.js';

export interface AgentConfig {
  name: string;
  role: string;
  systemPrompt: string;
  llmClient: LLMClient;
  tools?: Tool[];
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
  private tools: Map<string, Tool> = new Map();

  /** Maximum number of messages to retain in conversation history */
  private static readonly MAX_HISTORY_SIZE = 100;

  /** Default maximum iterations for tool execution loop */
  private static readonly DEFAULT_MAX_ITERATIONS = 10;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.llmClient = config.llmClient;

    if (config.tools) {
      for (const tool of config.tools) {
        this.tools.set(tool.definition.name, tool);
      }
    }
  }

  /**
   * Add a message to conversation history with bounds enforcement.
   * Removes oldest messages when limit is exceeded.
   */
  private addToHistory(message: LLMMessage): void {
    this.conversationHistory.push(message);
    // Enforce memory bounds - keep conversation manageable
    while (this.conversationHistory.length > Agent.MAX_HISTORY_SIZE) {
      this.conversationHistory.shift();
    }
  }

  /**
   * Process an incoming message and generate a response
   */
  async processMessage(message: string): Promise<string> {
    this.addToHistory({
      role: 'user',
      content: message,
    });

    const systemPromptWithTools = this.buildSystemPrompt();
    const response = await this.llmClient.chat(
      this.conversationHistory,
      systemPromptWithTools
    );

    this.addToHistory({
      role: 'assistant',
      content: response.content,
    });

    return response.content;
  }

  /**
   * Process a message with automatic tool execution loop.
   * Continues until the LLM responds without a tool call or max iterations reached.
   */
  async processMessageWithTools(
    message: string,
    maxIterations: number = Agent.DEFAULT_MAX_ITERATIONS
  ): Promise<string> {
    this.addToHistory({
      role: 'user',
      content: message,
    });

    const systemPromptWithTools = this.buildSystemPrompt();
    let iterations = 0;
    let finalResponse = '';

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.llmClient.chat(
        this.conversationHistory,
        systemPromptWithTools
      );

      this.addToHistory({
        role: 'assistant',
        content: response.content,
      });

      // Check for tool calls
      const toolCall = this.parseToolCall(response.content);

      if (!toolCall) {
        // No tool call, this is the final response
        finalResponse = response.content;
        break;
      }

      // Execute the tool
      const toolResult = await this.executeTool(toolCall.tool, toolCall.params);

      // Add tool result to conversation
      const resultMessage = toolResult.success
        ? `Tool "${toolCall.tool}" executed successfully:\n${toolResult.output}`
        : `Tool "${toolCall.tool}" failed:\n${toolResult.error}`;

      this.addToHistory({
        role: 'user',
        content: `<tool_result>\n${resultMessage}\n</tool_result>`,
      });

      finalResponse = response.content;
    }

    if (iterations >= maxIterations) {
      finalResponse += '\n\n[Max iterations reached]';
    }

    return finalResponse;
  }

  /**
   * Parse a tool call from LLM response
   */
  private parseToolCall(
    content: string
  ): { tool: string; params: Record<string, unknown> } | null {
    const toolCallMatch = content.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/);

    if (!toolCallMatch || !toolCallMatch[1]) {
      return null;
    }

    try {
      const parsed = JSON.parse(toolCallMatch[1]);

      if (typeof parsed.tool !== 'string') {
        return null;
      }

      return {
        tool: parsed.tool,
        params: parsed.params ?? {},
      };
    } catch {
      return null;
    }
  }

  /**
   * Execute a tool by name with given parameters
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: 'Tool not found: ' + toolName,
      };
    }

    return tool.execute(params);
  }

  /**
   * Get list of available tool names
   */
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is available
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Build system prompt including tool descriptions
   */
  private buildSystemPrompt(): string {
    if (this.tools.size === 0) {
      return this.systemPrompt;
    }

    const toolDescriptions = Array.from(this.tools.values())
      .map((tool) => {
        const params = tool.definition.parameters
          .map((p) => {
            const req = p.required ? ', required' : '';
            return '  - ' + p.name + ' (' + p.type + req + '): ' + p.description;
          })
          .join('\n');
        return '**' + tool.definition.name + '**: ' + tool.definition.description + '\nParameters:\n' + params;
      })
      .join('\n\n');

    return this.systemPrompt + '\n\n## Available Tools\n\nYou have access to the following tools. To use a tool, respond with a tool call in this exact format:\n<tool_call>\n{"tool": "tool_name", "params": {"param1": "value1", "param2": "value2"}}\n</tool_call>\n\n' + toolDescriptions + '\n\nWhen you need to use a tool, output the tool_call block. The system will execute it and provide the result.';
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
  getInfo(): { name: string; role: string; historyLength: number; toolCount: number } {
    return {
      name: this.name,
      role: this.role,
      historyLength: this.conversationHistory.length,
      toolCount: this.tools.size,
    };
  }
}
