/**
 * Error handling utilities and async error wrapper functions
 */

import { AppError, DataLoadError, NetworkError } from './AppError';

/**
 * Wraps async functions to handle errors gracefully
 */
export const handleAsyncError = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fallbackValue?: R
) => {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('Async operation failed:', error);
      
      if (error instanceof AppError) {
        // Re-throw known application errors
        throw error;
      }
      
      // Handle unknown errors
      if (error instanceof Error) {
        throw new AppError(
          error.message,
          'UNKNOWN_ERROR',
          500,
          false // Not operational since it's unexpected
        );
      }
      
      // Handle non-Error objects
      throw new AppError(
        'An unexpected error occurred',
        'UNKNOWN_ERROR',
        500,
        false
      );
    }
  };
};

/**
 * Wraps async functions with retry logic
 */
export const withRetry = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  maxRetries: number = 3,
  delayMs: number = 1000
) => {
  return async (...args: T): Promise<R> => {
    let lastError: Error = new Error('Unknown error');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on validation errors or other non-retryable errors
        if (error instanceof AppError && !shouldRetry(error)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
    
    throw new AppError(
      `Operation failed after ${maxRetries} attempts: ${lastError.message}`,
      'MAX_RETRIES_EXCEEDED',
      500
    );
  };
};

/**
 * Determines if an error should be retried
 */
const shouldRetry = (error: AppError): boolean => {
  const nonRetryableCodes = [
    'VALIDATION_ERROR',
    'CONFIGURATION_ERROR',
    'AUTHENTICATION_ERROR',
    'OPERATION_ABORTED' // Don't retry aborted operations
  ];
  
  return !nonRetryableCodes.includes(error.code);
};

/**
 * Safely executes a function and returns a result object
 */
export const safeExecute = async <T>(
  fn: () => Promise<T>
): Promise<{ data?: T; error?: AppError }> => {
  try {
    const data = await fn();
    return { data };
  } catch (error) {
    if (error instanceof AppError) {
      return { error };
    }
    
    return {
      error: new AppError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        'EXECUTION_ERROR',
        500
      )
    };
  }
};

/**
 * Creates a data loading wrapper with proper error handling
 */
export const createDataLoader = <T>(
  loader: () => Promise<T>,
  taskName?: string
) => {
  return handleAsyncError(async (): Promise<T> => {
    try {
      return await loader();
    } catch (error) {
      if (error instanceof Error) {
        throw new DataLoadError(error.message, taskName);
      }
      throw new DataLoadError('Unknown data loading error', taskName);
    }
  });
};

/**
 * Creates a network request wrapper with proper error handling
 */
export const createNetworkRequest = <T>(
  request: () => Promise<T>,
  url?: string
) => {
  return handleAsyncError(async (): Promise<T> => {
    try {
      return await request();
    } catch (error) {
      if (error instanceof Error) {
        throw new NetworkError(error.message, url);
      }
      throw new NetworkError('Network request failed', url);
    }
  });
};

/**
 * Error boundary helper for logging errors
 */
export const logError = (error: Error, errorInfo?: Record<string, unknown>): void => {
  console.error('Error caught by error boundary:', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    errorInfo,
    timestamp: new Date().toISOString()
  });
  
  // In production, you might want to send this to an error reporting service
  if (process.env.NODE_ENV === 'production') {
    // Example: Sentry, LogRocket, etc.
    // errorReportingService.captureException(error, { extra: errorInfo });
  }
};
