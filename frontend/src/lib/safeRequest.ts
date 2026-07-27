/**
 * Safe Request Wrapper
 * Use this to wrap fetch calls and handle errors gracefully
 */

/**
 * Safe fetch wrapper for inline fetch calls
 * Catches "Failed to fetch" and converts to network error message
 */
export async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(input, init);
    return response;
  } catch (error) {
    // Convert "Failed to fetch" to user-friendly error
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network connection issue. Please check your internet connection and try again.');
    }
    throw error;
  }
}

/**
 * Safe JSON response handler
 * Converts API errors to user-friendly messages
 */
export async function handleJsonResponse<T = any>(response: Response): Promise<T> {
  const body = await response.json();
  
  if (!response.ok) {
    const errorMessage = body.error || body.message || `Request failed: ${response.status}`;
    throw new Error(errorMessage);
  }
  
  return body;
}

/**
 * Complete safe API call wrapper
 * Use this for inline fetch + json parsing
 */
export async function safeApiCall<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  try {
    const response = await safeFetch(input, init);
    return await handleJsonResponse<T>(response);
  } catch (error) {
    // Error is already formatted from safeFetch or handleJsonResponse
    throw error;
  }
}

/**
 * Helper to create fetch functions with automatic error handling
 * Example:
 * const fetchData = createSafeFetch(() => 
 *   fetch('/api/data').then(r => r.json())
 * );
 */
export function createSafeFetch<T>(
  fetchFn: () => Promise<T>
): () => Promise<T> {
  return async () => {
    try {
      return await fetchFn();
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Network connection issue. Please check your internet connection and try again.');
      }
      throw error;
    }
  };
}
