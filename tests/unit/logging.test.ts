/**
 * Logger Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  Logger,
  LogEntry,
  createLogger,
  setCorrelationId,
  getCorrelationId,
  generateCorrelationId,
  withCorrelationId,
} from '../../src/core/logging/logger.js';

describe('Logger', () => {
  let capturedEntries: LogEntry[];
  let testLogger: Logger;

  beforeEach(() => {
    capturedEntries = [];
    testLogger = new Logger({
      level: 'debug',
      writer: (entry) => capturedEntries.push(entry),
    });
    setCorrelationId(undefined);
  });

  afterEach(() => {
    setCorrelationId(undefined);
  });

  describe('Log Levels', () => {
    it('should log debug messages when level is debug', () => {
      testLogger.debug('Debug message');
      expect(capturedEntries).toHaveLength(1);
      expect(capturedEntries[0].level).toBe('debug');
      expect(capturedEntries[0].message).toBe('Debug message');
    });

    it('should log info messages', () => {
      testLogger.info('Info message');
      expect(capturedEntries).toHaveLength(1);
      expect(capturedEntries[0].level).toBe('info');
    });

    it('should log warn messages', () => {
      testLogger.warn('Warn message');
      expect(capturedEntries).toHaveLength(1);
      expect(capturedEntries[0].level).toBe('warn');
    });

    it('should log error messages', () => {
      testLogger.error('Error message');
      expect(capturedEntries).toHaveLength(1);
      expect(capturedEntries[0].level).toBe('error');
    });

    it('should filter messages below log level', () => {
      const infoLogger = new Logger({
        level: 'info',
        writer: (entry) => capturedEntries.push(entry),
      });

      infoLogger.debug('Should not appear');
      infoLogger.info('Should appear');

      expect(capturedEntries).toHaveLength(1);
      expect(capturedEntries[0].level).toBe('info');
    });

    it('should filter debug and info when level is warn', () => {
      const warnLogger = new Logger({
        level: 'warn',
        writer: (entry) => capturedEntries.push(entry),
      });

      warnLogger.debug('Debug');
      warnLogger.info('Info');
      warnLogger.warn('Warn');
      warnLogger.error('Error');

      expect(capturedEntries).toHaveLength(2);
      expect(capturedEntries[0].level).toBe('warn');
      expect(capturedEntries[1].level).toBe('error');
    });
  });

  describe('Metadata', () => {
    it('should include metadata in log entries', () => {
      testLogger.info('With metadata', { key: 'value', count: 42 });

      expect(capturedEntries[0].metadata).toEqual({ key: 'value', count: 42 });
    });

    it('should handle undefined metadata', () => {
      testLogger.info('No metadata');
      expect(capturedEntries[0].metadata).toBeUndefined();
    });
  });

  describe('Timestamps', () => {
    it('should include ISO timestamp', () => {
      testLogger.info('Message');
      expect(capturedEntries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Timed Logging', () => {
    it('should include duration in timed logs', () => {
      const startTime = Date.now() - 100; // 100ms ago
      testLogger.timed('info', 'Operation complete', startTime);

      expect(capturedEntries[0].duration).toBeGreaterThanOrEqual(100);
      expect(capturedEntries[0].duration).toBeLessThan(200);
    });

    it('should include metadata in timed logs', () => {
      const startTime = Date.now();
      testLogger.timed('info', 'Operation', startTime, { operation: 'test' });

      expect(capturedEntries[0].metadata).toEqual({ operation: 'test' });
    });

    it('should respect log level for timed logs', () => {
      const infoLogger = new Logger({
        level: 'info',
        writer: (entry) => capturedEntries.push(entry),
      });

      infoLogger.timed('debug', 'Should not appear', Date.now());
      expect(capturedEntries).toHaveLength(0);
    });
  });

  describe('Component', () => {
    it('should include component in log entries', () => {
      const componentLogger = new Logger({
        component: 'TestComponent',
        writer: (entry) => capturedEntries.push(entry),
      });

      componentLogger.info('Message');
      expect(capturedEntries[0].component).toBe('TestComponent');
    });

    it('should create child logger with nested component', () => {
      const parentLogger = new Logger({
        component: 'Parent',
        writer: (entry) => capturedEntries.push(entry),
      });

      const childLogger = parentLogger.child('Child');
      childLogger.info('Message');

      expect(capturedEntries[0].component).toBe('Parent:Child');
    });
  });

  describe('Log Level Management', () => {
    it('should allow changing log level dynamically', () => {
      testLogger.setLevel('error');
      testLogger.info('Should not appear');
      testLogger.error('Should appear');

      expect(capturedEntries).toHaveLength(1);
      expect(capturedEntries[0].level).toBe('error');
    });

    it('should report current log level', () => {
      expect(testLogger.getLevel()).toBe('debug');
      testLogger.setLevel('warn');
      expect(testLogger.getLevel()).toBe('warn');
    });
  });
});

describe('Correlation ID', () => {
  afterEach(() => {
    setCorrelationId(undefined);
  });

  it('should set and get correlation ID', () => {
    expect(getCorrelationId()).toBeUndefined();

    setCorrelationId('test-123');
    expect(getCorrelationId()).toBe('test-123');
  });

  it('should generate unique correlation IDs', () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();

    expect(id1).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it('should include correlation ID in log entries', () => {
    const entries: LogEntry[] = [];
    const logger = new Logger({
      writer: (entry) => entries.push(entry),
    });

    setCorrelationId('req-456');
    logger.info('Message');

    expect(entries[0].correlationId).toBe('req-456');
  });

  it('should run function with correlation ID context', async () => {
    let capturedId: string | undefined;

    await withCorrelationId('context-id', async () => {
      capturedId = getCorrelationId();
      return 'result';
    });

    expect(capturedId).toBe('context-id');
    expect(getCorrelationId()).toBeUndefined();
  });

  it('should restore previous correlation ID after context', async () => {
    setCorrelationId('outer-id');

    await withCorrelationId('inner-id', async () => {
      expect(getCorrelationId()).toBe('inner-id');
    });

    expect(getCorrelationId()).toBe('outer-id');
  });
});

describe('createLogger', () => {
  it('should create logger with component', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger('MyComponent', {
      writer: (entry) => entries.push(entry),
    });

    logger.info('Test');
    expect(entries[0].component).toBe('MyComponent');
  });
});

describe('Pretty Output Format', () => {
  it('should format pretty output correctly', () => {
    const outputs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => outputs.push(msg);

    try {
      const logger = new Logger({
        output: 'pretty',
        component: 'Test',
      });

      setCorrelationId('req-123');
      logger.info('Hello world', { key: 'value' });

      expect(outputs).toHaveLength(1);
      expect(outputs[0]).toContain('INFO');
      expect(outputs[0]).toContain('[Test]');
      expect(outputs[0]).toContain('(req-123)');
      expect(outputs[0]).toContain('Hello world');
      expect(outputs[0]).toContain('"key":"value"');
    } finally {
      console.log = originalLog;
      setCorrelationId(undefined);
    }
  });
});
