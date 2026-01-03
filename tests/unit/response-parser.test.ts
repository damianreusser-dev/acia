/**
 * Response Parser Unit Tests
 *
 * Tests for the response parsing utility.
 * Part of Phase 6a: Coordination Layer Refactoring.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeResponse,
  isSuccessfulResponse,
  extractModifiedFiles,
  extractErrors,
  parseToolResults,
  ToolCallMetrics,
} from '../../src/utils/response-parser.js';

describe('analyzeResponse', () => {
  describe('with tool call metrics', () => {
    it('should return success when tools were called successfully', () => {
      const metrics: ToolCallMetrics = {
        total: 2,
        successful: 2,
        byTool: new Map([['write_file', 2]]),
      };
      const result = analyzeResponse('Created files', metrics);
      expect(result.success).toBe(true);
      expect(result.reason).toContain('successful tool calls');
    });

    it('should return failure when hard error detected despite tool calls', () => {
      const metrics: ToolCallMetrics = {
        total: 1,
        successful: 1,
        byTool: new Map([['write_file', 1]]),
      };
      const result = analyzeResponse('Error: permission denied', metrics);
      expect(result.success).toBe(false);
      expect(result.hasHardFailure).toBe(true);
    });
  });

  describe('without tool call metrics', () => {
    it('should detect soft failure indicators', () => {
      const result = analyzeResponse('Could not complete the task');
      expect(result.success).toBe(false);
      expect(result.hasSoftFailure).toBe(true);
    });

    it('should return success with tool usage and success language', () => {
      const result = analyzeResponse('Successfully created file. wrote to src/app.ts');
      expect(result.success).toBe(true);
      expect(result.hasToolUsage).toBe(true);
      expect(result.hasSuccessIndicator).toBe(true);
    });

    it('should return success with tool usage alone', () => {
      const result = analyzeResponse('wrote to src/app.ts\nwrote to src/routes.ts');
      expect(result.success).toBe(true);
      expect(result.hasToolUsage).toBe(true);
    });

    it('should return failure without any evidence of work', () => {
      const result = analyzeResponse('I would create a file with the following content...');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('No evidence');
    });
  });

  describe('hard failure indicators', () => {
    it.each([
      'Error: Something went wrong',
      'Exception: Unexpected error',
      'Failed to write file',
      'Permission denied',
      'ENOENT: no such file',
      'EACCES: permission denied',
      'Syntax error in code',
      'Compilation failed',
    ])('should detect hard failure: %s', (response) => {
      const result = analyzeResponse(response);
      expect(result.hasHardFailure).toBe(true);
    });
  });

  describe('soft failure indicators', () => {
    it.each([
      'Failed to complete task',
      'Could not find the file',
      'Unable to proceed',
      'Cannot complete the request',
      'Blocked by missing dependency',
    ])('should detect soft failure: %s', (response) => {
      const result = analyzeResponse(response);
      expect(result.hasSoftFailure).toBe(true);
    });
  });

  describe('tool usage indicators', () => {
    it.each([
      '<tool_call>{"tool": "write_file"}</tool_call>',
      '<tool_result>success</tool_result>',
      'Wrote to src/app.ts',
      'File created at path',
      'File updated successfully',
      'Files created: 3',
      'Files written to disk',
      'Generated project structure',
      'Scaffolded the application',
      'Contents of the file:',
      'I created the component',
      'I wrote the implementation',
    ])('should detect tool usage: %s', (response) => {
      const result = analyzeResponse(response);
      expect(result.hasToolUsage).toBe(true);
    });
  });

  describe('success indicators', () => {
    it.each([
      'Task completed',
      'Created the file',
      'Implemented the feature',
      'Wrote the code',
      'Updated the component',
      'Successfully finished',
    ])('should detect success indicator: %s', (response) => {
      const result = analyzeResponse(response);
      expect(result.hasSuccessIndicator).toBe(true);
    });
  });
});

describe('isSuccessfulResponse', () => {
  it('should return true for successful response', () => {
    expect(isSuccessfulResponse('Successfully wrote to file')).toBe(true);
  });

  it('should return false for failed response', () => {
    expect(isSuccessfulResponse('Could not complete task')).toBe(false);
  });

  it('should use metrics when provided', () => {
    const metrics: ToolCallMetrics = {
      total: 1,
      successful: 1,
      byTool: new Map([['write_file', 1]]),
    };
    expect(isSuccessfulResponse('Done', metrics)).toBe(true);
  });
});

describe('extractModifiedFiles', () => {
  it('should extract "wrote to path" format', () => {
    const response = 'Wrote to src/app.ts and wrote to src/routes.ts';
    const files = extractModifiedFiles(response);
    expect(files).toContain('src/app.ts');
    expect(files).toContain('src/routes.ts');
  });

  it('should extract "created path" format', () => {
    const response = 'Created src/components/Todo.tsx';
    const files = extractModifiedFiles(response);
    expect(files).toContain('src/components/Todo.tsx');
  });

  it('should extract quoted paths', () => {
    const response = "Wrote to 'src/index.ts' and created \"src/app.ts\"";
    const files = extractModifiedFiles(response);
    expect(files).toContain('src/index.ts');
    expect(files).toContain('src/app.ts');
  });

  it('should extract "file: path" format', () => {
    const response = 'Modified file: src/utils.ts';
    const files = extractModifiedFiles(response);
    expect(files).toContain('src/utils.ts');
  });

  it('should extract "writing to path" format', () => {
    const response = 'Writing to src/config.ts';
    const files = extractModifiedFiles(response);
    expect(files).toContain('src/config.ts');
  });

  it('should deduplicate paths', () => {
    const response = 'Wrote to src/app.ts and created src/app.ts';
    const files = extractModifiedFiles(response);
    expect(files.filter(f => f === 'src/app.ts')).toHaveLength(1);
  });

  it('should return empty array when no files found', () => {
    const response = 'Task completed successfully';
    const files = extractModifiedFiles(response);
    expect(files).toHaveLength(0);
  });
});

describe('extractErrors', () => {
  it('should extract "Error: message" format', () => {
    const response = 'Error: Something went wrong';
    const errors = extractErrors(response);
    expect(errors).toContain('Something went wrong');
  });

  it('should extract "Failed to..." format', () => {
    const response = 'Failed to write file';
    const errors = extractErrors(response);
    expect(errors).toContain('Failed to write file');
  });

  it('should extract multiple errors', () => {
    const response = 'Error: First issue\nFailed to complete. Error: Second issue';
    const errors = extractErrors(response);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should return empty array when no errors', () => {
    const response = 'Task completed successfully';
    const errors = extractErrors(response);
    expect(errors).toHaveLength(0);
  });
});

describe('parseToolResults', () => {
  it('should parse JSON tool results', () => {
    const response = '<tool_result>{"tool": "write_file", "success": true, "output": "Done"}</tool_result>';
    const results = parseToolResults(response);
    expect(results).toHaveLength(1);
    expect(results[0].tool).toBe('write_file');
    expect(results[0].success).toBe(true);
    expect(results[0].output).toBe('Done');
  });

  it('should parse non-JSON tool results', () => {
    const response = '<tool_result>File written successfully</tool_result>';
    const results = parseToolResults(response);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].output).toBe('File written successfully');
  });

  it('should detect errors in non-JSON results', () => {
    const response = '<tool_result>Error: Permission denied</tool_result>';
    const results = parseToolResults(response);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });

  it('should parse multiple tool results', () => {
    const response = `
      <tool_result>{"tool": "read_file", "success": true}</tool_result>
      <tool_result>{"tool": "write_file", "success": true}</tool_result>
    `;
    const results = parseToolResults(response);
    expect(results).toHaveLength(2);
  });

  it('should return empty array when no tool results', () => {
    const response = 'Task completed';
    const results = parseToolResults(response);
    expect(results).toHaveLength(0);
  });
});
