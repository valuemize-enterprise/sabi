/**
 * Error Handler Utility for Sabi Intelligence Suite
 * Provides graceful error handling without breaking the app
 */

import toast from 'react-hot-toast';

/**
 * Formats error messages for user display
 * Converts technical errors to user-friendly messages
 */
export function formatErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred';

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message;
    
    // Network errors
    if (message === 'Failed to fetch' || message.includes('fetch')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }
    
    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'Request timed out. Please try again.';
    }
    
    // Session/Auth errors
    if (message.includes('Session expired') || message.includes('401')) {
      return 'Your session has expired. Please log in again.';
    }
    
    // Permission errors
    if (message.includes('403') || message.includes('Forbidden')) {
      return 'You don\'t have permission to perform this action.';
    }
    
    // Not found errors
    if (message.includes('404') || message.includes('Not found')) {
      return 'The requested resource was not found.';
    }
    
    // Server errors
    if (message.includes('500') || message.includes('Internal Server Error')) {
      return 'Server error. Our team has been notified. Please try again later.';
    }
    
    // Return the original message if it's already user-friendly
    return message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    if (error === 'Failed to fetch') {
      return 'Network connection issue. Please check your internet connection and try again.';
    }
    return error;
  }

  // Handle objects with error/message properties
  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    if (err.error) return formatErrorMessage(err.error);
    if (err.message) return formatErrorMessage(err.message);
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Handles errors gracefully by showing toast notifications
 * Returns null to prevent app crashes
 */
export function handleError(error: unknown, customMessage?: string): null {
  const message = customMessage || formatErrorMessage(error);
  
  // Log error to console for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.error('Error caught:', error);
  }
  
  // Show toast notification
  toast.error(message, {
    duration: 5000,
    position: 'top-right',
  });
  
  return null;
}

/**
 * Wraps async functions with error handling
 * Shows toast on error and prevents crashes
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  customErrorMessage?: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, customErrorMessage);
      throw error; // Re-throw to allow caller to handle if needed
    }
  }) as T;
}

/**
 * Safe API request wrapper that handles errors gracefully
 * Use this instead of direct fetch calls
 */
export async function safeApiRequest<T>(
  requestFn: () => Promise<T>,
  options?: {
    errorMessage?: string;
    onError?: (error: unknown) => void;
    silent?: boolean; // Don't show toast
  }
): Promise<T | null> {
  try {
    return await requestFn();
  } catch (error) {
    // Call custom error handler if provided
    if (options?.onError) {
      options.onError(error);
    }
    
    // Show toast unless silent mode
    if (!options?.silent) {
      handleError(error, options?.errorMessage);
    }
    
    return null;
  }
}
