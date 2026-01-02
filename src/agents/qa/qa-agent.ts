/**
 * QA Agent
 *
 * Specializes in testing code, writing test cases, and verifying implementations.
 * Focuses on quality assurance and finding bugs.
 */

import { Agent, AgentConfig } from '../base/agent.js';
import { Task, TaskResult } from '../../core/tasks/types.js';
import { Tool } from '../../core/tools/types.js';
import { LLMClient } from '../../core/llm/client.js';

const QA_SYSTEM_PROMPT = `You are a QA Agent in an autonomous software development team.

Your responsibilities:
1. Write comprehensive test cases for implementations
2. Run tests and analyze results
3. Identify bugs and issues in code
4. Verify that code meets requirements
5. Report test results clearly

When testing code:
1. First read the code to understand what needs to be tested
2. Write test cases that cover main functionality
3. Write edge case tests
4. Run the tests
5. Report results with details on what passed/failed

When reviewing code:
1. Check for common bugs and issues
2. Verify error handling
3. Check for security concerns
4. Ensure code follows patterns

Available tools allow you to:
- Read files to understand the code
- Write test files
- Run test files with vitest
- List directories to find related files

Always respond with clear test results and specific issues found.`;

export interface QAAgentConfig {
  name?: string;
  llmClient: LLMClient;
  tools: Tool[];
  workspace: string;
}

export class QAAgent extends Agent {
  private workspace: string;

  constructor(config: QAAgentConfig) {
    const agentConfig: AgentConfig = {
      name: config.name ?? 'QAAgent',
      role: 'Quality Assurance',
      systemPrompt: QA_SYSTEM_PROMPT,
      llmClient: config.llmClient,
      tools: config.tools,
    };
    super(agentConfig);
    this.workspace = config.workspace;
  }

  /**
   * Execute a QA task (testing or review)
   */
  async executeTask(task: Task): Promise<TaskResult> {
    const prompt = this.buildTaskPrompt(task);

    try {
      const response = await this.processMessageWithTools(prompt);

      // Parse test results from response
      const testResults = this.parseTestResults(response);
      const success = testResults.passed && testResults.failures === 0;

      return {
        success,
        output: response,
        testsRun: testResults.total,
        testsPassed: testResults.passed ? testResults.total - testResults.failures : 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Build a prompt for the QA task
   */
  private buildTaskPrompt(task: Task): string {
    let prompt = `## QA Task: ${task.title}\n\n`;
    prompt += `**Type**: ${task.type}\n`;
    prompt += `**Priority**: ${task.priority}\n\n`;
    prompt += `**Description**:\n${task.description}\n\n`;

    if (task.context) {
      prompt += `**Additional Context**:\n${JSON.stringify(task.context, null, 2)}\n\n`;
    }

    prompt += `**Workspace**: ${this.workspace}\n\n`;

    if (task.type === 'test') {
      prompt += `Please write tests for this code and run them. Report the results.`;
    } else if (task.type === 'review') {
      prompt += `Please review this code for bugs, issues, and improvements.`;
    } else {
      prompt += `Please complete this QA task and report your findings.`;
    }

    return prompt;
  }

  /**
   * Parse test results from response
   */
  private parseTestResults(response: string): {
    total: number;
    passed: boolean;
    failures: number;
  } {
    // Look for vitest-style output
    const passMatch = response.match(/(\d+)\s+pass/i);
    const failMatch = response.match(/(\d+)\s+fail/i);
    const totalMatch = response.match(/Tests\s+(\d+)/i);

    const passed = passMatch && passMatch[1] ? parseInt(passMatch[1], 10) : 0;
    const failures = failMatch && failMatch[1] ? parseInt(failMatch[1], 10) : 0;
    const total = totalMatch && totalMatch[1] ? parseInt(totalMatch[1], 10) : passed + failures;

    // Check for success/failure keywords (more comprehensive)
    const lowerResponse = response.toLowerCase();

    // Success indicators - various formats the LLM might use
    const hasPassIndicator =
      lowerResponse.includes('all tests pass') ||
      lowerResponse.includes('tests passed') ||
      lowerResponse.includes('verification passed') ||
      lowerResponse.includes('all checks pass') ||
      lowerResponse.includes('✅ pass') ||
      lowerResponse.includes('status: ✅') ||
      lowerResponse.includes('approved') ||
      lowerResponse.includes('success rate: 100%') ||
      lowerResponse.includes('tests failed: 0') ||
      lowerResponse.includes('0 failed') ||
      response.includes('✅ ALL TESTS PASSED') ||
      response.includes('✅ PASS') ||
      (passed > 0 && failures === 0);

    // Failure indicators
    const hasFailIndicator =
      lowerResponse.includes('test failed') ||
      lowerResponse.includes('tests failed') ||
      lowerResponse.includes('verification failed') ||
      lowerResponse.includes('❌ fail') ||
      lowerResponse.includes('status: ❌') ||
      lowerResponse.includes('rejected') ||
      (failures > 0);

    return {
      total: total || (hasPassIndicator || hasFailIndicator ? 1 : 0),
      passed: hasPassIndicator && !hasFailIndicator,
      failures,
    };
  }

  /**
   * Create a test task for a specific file
   */
  createTestTask(
    filePath: string,
    createdBy: string,
    context?: Record<string, unknown>
  ): Task {
    return {
      id: `test_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      type: 'test',
      title: `Write tests for ${filePath}`,
      description: `Create comprehensive tests for the file: ${filePath}\n\nEnsure tests cover:\n- Main functionality\n- Edge cases\n- Error handling`,
      status: 'pending',
      priority: 'medium',
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      context: {
        targetFile: filePath,
        ...context,
      },
    };
  }

  /**
   * Get the workspace path
   */
  getWorkspace(): string {
    return this.workspace;
  }
}
