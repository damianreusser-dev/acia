/**
 * Integration tests for Team workflow
 *
 * Tests the full workflow of PM planning tasks,
 * Dev implementing, and QA testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Team } from '../../src/team/team.js';
import { LLMClient } from '../../src/core/llm/client.js';
import { createFileTools } from '../../src/core/tools/file-tools.js';
import { createExecTools } from '../../src/core/tools/exec-tools.js';

describe('Team Workflow Integration', () => {
  let testWorkspace: string;
  let mockLLMClient: LLMClient;

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'acia-team-test-'));
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  it('should complete a simple dev + QA workflow', async () => {
    // This test simulates a complete workflow where:
    // 1. PM plans the task
    // 2. Dev creates a file
    // 3. QA verifies the file exists

    const mockChat = vi
      .fn()
      // PM planning response
      .mockResolvedValueOnce({
        content: `DEV_TASKS:
1. [Create greeting file] - Create a greeting.ts file with a hello function

QA_TASKS:
1. [Verify file] - Check that greeting.ts was created

EXECUTION_ORDER:
1. DEV:1
2. QA:1`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // Dev response - uses tool to write file
      .mockResolvedValueOnce({
        content: `I'll create the greeting file.
<tool_call>
{"tool": "write_file", "params": {"path": "greeting.ts", "content": "export function hello(name: string): string {\\n  return 'Hello, ' + name + '!';\\n}"}}
</tool_call>`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // Dev response after tool execution - must include tool usage evidence
      .mockResolvedValueOnce({
        content: 'Successfully created greeting.ts with the hello function. Wrote to greeting.ts.',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // QA response - reads file to verify
      .mockResolvedValueOnce({
        content: `I'll verify the file was created.
<tool_call>
{"tool": "read_file", "params": {"path": "greeting.ts"}}
</tool_call>`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // QA final response - must include tool usage evidence
      .mockResolvedValueOnce({
        content: 'Verification passed. The greeting.ts file exists and contains the hello function. All tests passed. File created successfully.',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

    mockLLMClient = { chat: mockChat } as unknown as LLMClient;

    const fileTools = createFileTools(testWorkspace);
    const execTools = createExecTools(testWorkspace);
    const allTools = [...fileTools, ...execTools];

    const team = new Team({
      workspace: testWorkspace,
      llmClient: mockLLMClient,
      tools: allTools,
    });

    const result = await team.executeTask('Create a greeting module');

    expect(result.success).toBe(true);
    expect(result.escalated).toBe(false);
    expect(result.devResults.length).toBeGreaterThan(0);
    expect(result.qaResults.length).toBeGreaterThan(0);

    // Verify the file was actually created
    const filePath = path.join(testWorkspace, 'greeting.ts');
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Verify file content
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toContain('hello');
  });

  it('should handle workflow with retry on failure', async () => {
    // With Phase 5j tool call enforcement, DevAgent requires actual tool calls.
    // This test simulates Dev making a tool call that results in failure,
    // then succeeding on Team-level retry.
    const mockChat = vi
      .fn()
      // PM planning
      .mockResolvedValueOnce({
        content: `DEV_TASKS:
1. [Create file] - Create a file

QA_TASKS:

EXECUTION_ORDER:
1. DEV:1`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // Dev first attempt - makes tool call but reports failure
      .mockResolvedValueOnce({
        content: `Let me try to create the file.
<tool_call>
{"tool": "write_file", "params": {"path": "test.ts", "content": "invalid content"}}
</tool_call>`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // Dev continues but indicates failure
      .mockResolvedValueOnce({
        content: 'Failed to create file properly. The format was wrong.',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // PM provides retry feedback
      .mockResolvedValueOnce({
        content: 'Please try again with a simpler approach.',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // Dev retry succeeds
      .mockResolvedValueOnce({
        content: `Let me create the file now.
<tool_call>
{"tool": "write_file", "params": {"path": "test.ts", "content": "// Test file"}}
</tool_call>`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // Dev final response - includes tool usage evidence
      .mockResolvedValueOnce({
        content: 'Successfully created the file. Wrote to test.ts.',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

    mockLLMClient = { chat: mockChat } as unknown as LLMClient;

    const fileTools = createFileTools(testWorkspace);
    const team = new Team({
      workspace: testWorkspace,
      llmClient: mockLLMClient,
      tools: fileTools,
      maxRetries: 3,
    });

    const result = await team.executeTask('Create a test file');

    expect(result.success).toBe(true);
    // With tool verification, both attempts should complete (tool calls made)
    expect(result.devResults.length).toBeGreaterThanOrEqual(1);
  });

  it('should track task status through workflow', async () => {
    // With Phase 5j tool call enforcement, DevAgent and QAAgent require actual tool calls.
    const mockChat = vi
      .fn()
      // PM planning
      .mockResolvedValueOnce({
        content: `DEV_TASKS:
1. [Task A] - Do A

QA_TASKS:
1. [Task B] - Do B

EXECUTION_ORDER:
1. DEV:1
2. QA:1`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // Dev makes tool call
      .mockResolvedValueOnce({
        content: `Completing task A.
<tool_call>
{"tool": "write_file", "params": {"path": "task-a.ts", "content": "// Task A"}}
</tool_call>`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // Dev final response
      .mockResolvedValueOnce({
        content: 'Completed task A successfully. Wrote to task-a.ts.',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // QA makes tool call
      .mockResolvedValueOnce({
        content: `Verifying task B.
<tool_call>
{"tool": "read_file", "params": {"path": "task-a.ts"}}
</tool_call>`,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      })
      // QA final response
      .mockResolvedValueOnce({
        content: 'All tests passed for task B. File created successfully.',
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 200 },
      });

    mockLLMClient = { chat: mockChat } as unknown as LLMClient;

    const fileTools = createFileTools(testWorkspace);
    const team = new Team({
      workspace: testWorkspace,
      llmClient: mockLLMClient,
      tools: fileTools,
    });

    const result = await team.executeTask('Complete tasks');

    expect(result.success).toBe(true);

    // Check that tasks were tracked
    const pm = team.getPMAgent();
    const activeTasks = pm.getActiveTasks();
    expect(activeTasks.length).toBeGreaterThan(0);

    // Parent task should be completed
    expect(result.task.status).toBe('completed');
  });
});
