/**
 * Base Agent Class
 *
 * Foundation for all ACIA agents. Provides:
 * - LLM integration for reasoning
 * - Tool execution capabilities
 * - Message handling
 * - Basic lifecycle management
 */

import { LLMClient, LLMMessage, LLMResponse, ChatOptions } from '../../core/llm/client.js';
import { Tool, ToolResult } from '../../core/tools/types.js';

export interface AgentConfig {
  name: string;
  role: string;
  systemPrompt: string;
  llmClient: LLMClient;
  tools?: Tool[];
}

/**
 * Metrics for tracking tool call execution.
 * Used to verify agents actually make tool calls instead of just describing actions.
 */
export interface ToolCallMetrics {
  total: number;
  byTool: Map<string, number>;
  successful: number;
  failed: number;
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

  /**
   * Tracks tool call execution for verification purposes.
   * Reset at the start of each task to measure per-task tool usage.
   */
  protected toolCallMetrics: ToolCallMetrics = {
    total: 0,
    byTool: new Map(),
    successful: 0,
    failed: 0,
  };

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
   * Get the base system prompt (for testing/debugging purposes)
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
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
   * Supports native function calling when options.tools is provided.
   */
  async processMessageWithTools(
    message: string,
    maxIterations: number = Agent.DEFAULT_MAX_ITERATIONS,
    options?: ChatOptions
  ): Promise<string> {
    this.addToHistory({
      role: 'user',
      content: message,
    });

    const systemPromptWithTools = this.buildSystemPrompt();
    let iterations = 0;
    let finalResponse = '';

    // Get tools array for native function calling (if not provided in options)
    const toolsArray = options?.tools ?? Array.from(this.tools.values());

    while (iterations < maxIterations) {
      iterations++;

      // Call LLM with tools for native function calling
      const response = await this.llmClient.chat(
        this.conversationHistory,
        systemPromptWithTools,
        { tools: toolsArray, toolChoice: options?.toolChoice }
      );

      this.addToHistory({
        role: 'assistant',
        content: response.content,
      });

      // Check for tool calls (supports both native and text-based formats)
      const toolCall = this.parseToolCall(response);

      if (!toolCall) {
        // No tool call, this is the final response
        finalResponse = response.content;
        break;
      }

      // Execute the tool
      const toolResult = await this.executeTool(toolCall.tool, toolCall.params);

      // Track tool call metrics
      this.toolCallMetrics.total++;
      const currentCount = this.toolCallMetrics.byTool.get(toolCall.tool) ?? 0;
      this.toolCallMetrics.byTool.set(toolCall.tool, currentCount + 1);
      if (toolResult.success) {
        this.toolCallMetrics.successful++;
      } else {
        this.toolCallMetrics.failed++;
      }

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
   * Parse a tool call from LLM response.
   * Supports both native function calls (OpenAI) and text-based format.
   */
  private parseToolCall(
    response: LLMResponse
  ): { tool: string; params: Record<string, unknown> } | null {
    // Strategy 1: Native function calls (from OpenAI with tools enabled)
    if (response.toolCalls && response.toolCalls.length > 0) {
      const firstCall = response.toolCalls[0]!;
      return {
        tool: firstCall.name,
        params: firstCall.arguments,
      };
    }

    // Strategy 2: Text-based parsing (existing logic)
    return this.parseTextToolCall(response.content);
  }

  /**
   * Parse tool call from text content using XML format.
   * Robust to common LLM output errors like </tool_call} instead of </tool_call>
   */
  private parseTextToolCall(
    content: string
  ): { tool: string; params: Record<string, unknown> } | null {
    // Flexible regex that handles common LLM output errors:
    // - </tool_call> (correct)
    // - </tool_call} (} instead of >)
    // - </tool_call  (missing >)
    // - </ tool_call> (extra space)
    const toolCallMatch = content.match(/<tool_call>\s*([\s\S]*?)\s*<\/?[/\s]*tool_call[>}]?/i);

    if (!toolCallMatch || !toolCallMatch[1]) {
      return null;
    }

    try {
      // Clean up the JSON - remove any trailing incomplete content
      let jsonStr = toolCallMatch[1].trim();

      // Handle case where JSON might have trailing garbage after the closing brace
      const lastBrace = jsonStr.lastIndexOf('}');
      if (lastBrace > 0) {
        jsonStr = jsonStr.substring(0, lastBrace + 1);
      }

      const parsed = JSON.parse(jsonStr);

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

  /**
   * Get a copy of current tool call metrics.
   * Used by subclasses to verify tool usage.
   */
  getToolCallMetrics(): ToolCallMetrics {
    return {
      ...this.toolCallMetrics,
      byTool: new Map(this.toolCallMetrics.byTool),
    };
  }

  /**
   * Reset tool call metrics.
   * Should be called at the start of each new task.
   */
  resetToolCallMetrics(): void {
    this.toolCallMetrics = {
      total: 0,
      byTool: new Map(),
      successful: 0,
      failed: 0,
    };
  }
}
