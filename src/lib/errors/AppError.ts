/**
 * Custom error classes for better error handling throughout the application
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

export class DataLoadError extends AppError {
  constructor(message: string, task?: string) {
    super(
      `Data loading failed${task ? ` for task: ${task}` : ''}: ${message}`,
      'DATA_LOAD_ERROR',
      500
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(
      `Validation failed${field ? ` for field: ${field}` : ''}: ${message}`,
      'VALIDATION_ERROR',
      400
    );
  }
}

export class NetworkError extends AppError {
  constructor(message: string, url?: string) {
    super(
      `Network request failed${url ? ` for URL: ${url}` : ''}: ${message}`,
      'NETWORK_ERROR',
      503
    );
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, configKey?: string) {
    super(
      `Configuration error${configKey ? ` for key: ${configKey}` : ''}: ${message}`,
      'CONFIGURATION_ERROR',
      500
    );
  }
}

export class ProcessingError extends AppError {
  constructor(message: string, operation?: string) {
    super(
      `Processing failed${operation ? ` during operation: ${operation}` : ''}: ${message}`,
      'PROCESSING_ERROR',
      500
    );
  }
}

export class OperationAbortedError extends AppError {
  constructor(operation?: string) {
    super(
      `Operation was aborted${operation ? `: ${operation}` : ''}`,
      'OPERATION_ABORTED',
      499, // 499 Client Closed Request
      true
    );
  }
}
