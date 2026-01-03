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

const QA_SYSTEM_PROMPT = `You are a QA Agent. Your job is to verify that implementations meet their requirements.

## YOUR ROLE: PRACTICAL VERIFICATION

Focus on whether the implementation fulfills the ACTUAL REQUIREMENTS, not hypothetical edge cases.

## VERIFICATION PROCESS

1. **Read the requirements** - Understand what was asked for
2. **Check the implementation** - Does it do what was requested?
3. **Test the happy path** - Does the main functionality work?
4. **Report your findings** - Be clear and concise

## WHEN TO PASS

Report PASS when:
- The implementation meets the stated requirements
- Files exist where they should
- Code compiles/runs without errors
- The main functionality works as expected

## WHEN TO FAIL

Report FAIL when:
- Required files are missing
- Code has syntax errors or doesn't compile
- The implementation doesn't match requirements
- There are ACTUAL bugs that cause failures (not theoretical edge cases)

## IMPORTANT: STAY FOCUSED

- Only check what was actually requested
- Don't create elaborate test scripts for simple file creation tasks
- For "create a file with X content", just verify the file exists and has the content
- Don't report bugs in code YOU wrote (test scripts) - only in the implementation

## Reporting Format

Keep it simple:

VERDICT: PASS or FAIL

Summary: [1-2 sentence explanation]

Issues (if FAIL):
- [actual issue found]

## EXAMPLE: Simple File Task

Task: "Create hello.txt containing 'Hello World'"

Good verification:
1. Check file exists: list_directory or read_file
2. Check content matches: read_file and compare
3. Report result

VERDICT: PASS
Summary: File hello.txt exists and contains "Hello World".

BAD verification (don't do this):
- Writing elaborate test scripts
- Checking UTF-8 BOMs for simple text files
- Testing edge cases not in requirements
- Creating test harnesses`;

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
    // PRIORITY 1: Check for explicit VERDICT keyword (most reliable)
    const verdictMatch = response.match(/VERDICT:\s*(PASS|FAIL)/i);
    if (verdictMatch && verdictMatch[1]) {
      const verdict = verdictMatch[1].toUpperCase();
      return {
        total: 1,
        passed: verdict === 'PASS',
        failures: verdict === 'FAIL' ? 1 : 0,
      };
    }

    // PRIORITY 2: Look for vitest-style output
    const passMatch = response.match(/(\d+)\s+pass/i);
    const failMatch = response.match(/(\d+)\s+fail/i);
    const totalMatch = response.match(/Tests\s+(\d+)/i);

    const passedCount = passMatch && passMatch[1] ? parseInt(passMatch[1], 10) : 0;
    const failures = failMatch && failMatch[1] ? parseInt(failMatch[1], 10) : 0;
    const total = totalMatch && totalMatch[1] ? parseInt(totalMatch[1], 10) : passedCount + failures;

    // If we have test counts, use them
    if (passedCount > 0 || failures > 0) {
      return {
        total: total || passedCount + failures,
        passed: failures === 0 && passedCount > 0,
        failures,
      };
    }

    // PRIORITY 3: Check for success/failure keywords
    const lowerResponse = response.toLowerCase();

    // Success indicators
    const hasPassIndicator =
      lowerResponse.includes('all tests pass') ||
      lowerResponse.includes('tests passed') ||
      lowerResponse.includes('verification passed') ||
      lowerResponse.includes('all checks pass') ||
      lowerResponse.includes('✅ pass') ||
      response.includes('✅ ALL TESTS PASSED') ||
      response.includes('✅ PASS');

    // Failure indicators (be more specific to avoid false positives)
    const hasFailIndicator =
      lowerResponse.includes('verification failed') ||
      lowerResponse.includes('❌ fail') ||
      response.includes('❌ FAIL');

    return {
      total: hasPassIndicator || hasFailIndicator ? 1 : 0,
      passed: hasPassIndicator && !hasFailIndicator,
      failures: hasFailIndicator ? 1 : 0,
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
