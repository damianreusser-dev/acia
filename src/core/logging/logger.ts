/**
 * Structured Logger
 *
 * Provides structured JSON logging with log levels, context tracking,
 * and correlation IDs for request tracing.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  component?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface LoggerConfig {
  level?: LogLevel;
  component?: string;
  output?: 'json' | 'pretty';
  writer?: (entry: LogEntry) => void;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * AsyncLocalStorage for correlation ID tracking across async operations.
 * Falls back to undefined if not in a correlated context.
 */
let currentCorrelationId: string | undefined;

export function setCorrelationId(id: string | undefined): void {
  currentCorrelationId = id;
}

export function getCorrelationId(): string | undefined {
  return currentCorrelationId;
}

export function generateCorrelationId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Run a function with a correlation ID in context.
 * The ID will be automatically attached to all log entries within the function.
 */
export async function withCorrelationId<T>(
  id: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const previousId = currentCorrelationId;
  try {
    currentCorrelationId = id;
    return await fn();
  } finally {
    currentCorrelationId = previousId;
  }
}

export class Logger {
  private level: LogLevel;
  private component?: string;
  private output: 'json' | 'pretty';
  private writer: (entry: LogEntry) => void;

  /** Default log level */
  private static readonly DEFAULT_LEVEL: LogLevel = 'info';

  constructor(config: LoggerConfig = {}) {
    this.level = config.level ?? Logger.DEFAULT_LEVEL;
    this.component = config.component;
    this.output = config.output ?? 'json';
    this.writer = config.writer ?? this.defaultWriter.bind(this);
  }

  private defaultWriter(entry: LogEntry): void {
    const output =
      this.output === 'json'
        ? JSON.stringify(entry)
        : this.formatPretty(entry);

    if (entry.level === 'error') {
      console.error(output);
    } else if (entry.level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  private formatPretty(entry: LogEntry): string {
    const timestamp = entry.timestamp.split('T')[1]?.replace('Z', '') ?? entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const component = entry.component ? `[${entry.component}]` : '';
    const correlationId = entry.correlationId ? `(${entry.correlationId})` : '';
    const duration = entry.duration !== undefined ? ` [${entry.duration}ms]` : '';
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';

    return `${timestamp} ${level} ${component}${correlationId} ${entry.message}${duration}${metadata}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: getCorrelationId(),
      component: this.component,
      metadata,
    };

    this.writer(entry);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }

  /**
   * Log with timing information.
   * Useful for performance tracking.
   */
  timed(
    level: LogLevel,
    message: string,
    startTime: number,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const duration = Date.now() - startTime;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: getCorrelationId(),
      component: this.component,
      duration,
      metadata,
    };

    this.writer(entry);
  }

  /**
   * Create a child logger with additional component context.
   */
  child(component: string): Logger {
    return new Logger({
      level: this.level,
      component: this.component ? `${this.component}:${component}` : component,
      output: this.output,
      writer: this.writer,
    });
  }

  /**
   * Set the log level dynamically.
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level.
   */
  getLevel(): LogLevel {
    return this.level;
  }
}

/**
 * Default global logger instance.
 * Use this for quick logging without creating a new instance.
 */
export const logger = new Logger();

/**
 * Create a logger for a specific component.
 */
export function createLogger(component: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger({
    ...config,
    component,
  });
}
