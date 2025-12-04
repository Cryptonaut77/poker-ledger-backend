/**
 * API Client Module
 *
 * This module provides a centralized API client for making HTTP requests to the backend.
 * It handles authentication, request formatting, error handling, and response parsing.
 */

// Import fetch from expo/fetch for React Native compatibility
// This ensures fetch works correctly across different platforms (iOS, Android, Web)
import { fetch } from "expo/fetch";

// Import the authentication client to access user session cookies
import { authClient } from "./authClient";

/**
 * Error types to help identify the source of problems
 */
export type ApiErrorType =
  | "NETWORK_ERROR"      // Can't reach the server (sandbox down, no internet)
  | "SERVER_ERROR"       // Server returned 500+ (backend code issue)
  | "VALIDATION_ERROR"   // Server returned 400 (bad request data)
  | "NOT_FOUND"          // Server returned 404 (missing resource)
  | "AUTH_ERROR"         // Server returned 401/403 (authentication issue)
  | "UNKNOWN_ERROR";     // Something unexpected happened

/**
 * Custom API Error with type classification
 */
export class ApiError extends Error {
  type: ApiErrorType;
  statusCode?: number;
  details?: string;

  constructor(type: ApiErrorType, message: string, statusCode?: number, details?: string) {
    super(message);
    this.name = "ApiError";
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
  }

  /**
   * Get a user-friendly error message based on error type
   */
  getUserMessage(): string {
    switch (this.type) {
      case "NETWORK_ERROR":
        return "Unable to connect to server. This is likely a temporary issue with the Vibecode sandbox. Please wait a moment and try again.";
      case "SERVER_ERROR":
        return `Server error (code ${this.statusCode}). This may be a bug in the app code. Details: ${this.details || "No details available"}`;
      case "VALIDATION_ERROR":
        return `Invalid data submitted. ${this.details || "Please check your input and try again."}`;
      case "NOT_FOUND":
        return "The requested data was not found. It may have been deleted.";
      case "AUTH_ERROR":
        return "Authentication error. Please restart the app.";
      default:
        return `An unexpected error occurred: ${this.message}`;
    }
  }
}

/**
 * Backend URL Configuration
 *
 * The backend URL is dynamically set by the Vibecode environment at runtime.
 * Format: https://[UNIQUE_ID].share.sandbox.dev/
 * This allows the app to connect to different backend instances without code changes.
 */
const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error("Backend URL setup has failed. Please contact support@vibecodeapp.com for help.");
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

type FetchOptions = {
  method: HttpMethod;
  body?: object; // Request body, will be JSON stringified before sending
};

/**
 * Core Fetch Function
 *
 * A generic, type-safe wrapper around the fetch API that handles all HTTP requests.
 *
 * @template T - The expected response type (for type safety)
 * @param path - The API endpoint path (e.g., "/api/posts")
 * @param options - Configuration object containing HTTP method and optional body
 * @returns Promise resolving to the typed response data
 *
 * Features:
 * - Automatic authentication: Attaches session cookies from authClient
 * - JSON handling: Automatically stringifies request bodies and parses responses
 * - Error handling: Throws descriptive errors with status codes and messages
 * - Type safety: Returns strongly-typed responses using TypeScript generics
 *
 * @throws Error if the response is not ok (status code outside 200-299 range)
 */
const fetchFn = async <T>(path: string, options: FetchOptions): Promise<T> => {
  const { method, body } = options;
  // Step 1: Authentication - Retrieve session cookies from the auth client
  // These cookies are used to identify the user and maintain their session
  const headers = new Map<string, string>();
  const cookies = authClient.getCookie();
  if (cookies) {
    headers.set("Cookie", cookies);
  }

  // Step 2: Make the HTTP request
  try {
    // Construct the full URL by combining the base backend URL with the endpoint path
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers: {
        // Always send JSON content type since our API uses JSON
        "Content-Type": "application/json",
        // Include authentication cookies if available
        Cookie: cookies,
      },
      // Stringify the body if present (for POST, PUT, PATCH requests)
      body: body ? JSON.stringify(body) : undefined,
      // Use "omit" to prevent browser from automatically sending credentials
      // We manually handle cookies via the Cookie header for more control
      credentials: "omit",
    });

    // Step 3: Error handling - Check if the response was successful
    if (!response.ok) {
      // Parse the error details from the response body
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Response might not be JSON
      }

      // Classify the error based on status code
      const status = response.status;
      let errorType: ApiErrorType;

      if (status === 400) {
        errorType = "VALIDATION_ERROR";
      } else if (status === 401 || status === 403) {
        errorType = "AUTH_ERROR";
      } else if (status === 404) {
        errorType = "NOT_FOUND";
      } else if (status >= 500) {
        errorType = "SERVER_ERROR";
      } else {
        errorType = "UNKNOWN_ERROR";
      }

      const details = errorData?.error || errorData?.message || JSON.stringify(errorData);
      console.error(`[API ${errorType}] ${method} ${path} - Status ${status}: ${details}`);

      throw new ApiError(errorType, `${method} ${path} failed`, status, details);
    }

    // Step 4: Parse and return the successful response as JSON
    // The response is cast to the expected type T for type safety
    return response.json() as Promise<T>;
  } catch (error: any) {
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }

    // Check if this is a network error (can't reach server)
    const isNetworkError =
      error.message?.includes("Network request failed") ||
      error.message?.includes("Failed to fetch") ||
      error.message?.includes("network") ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("timeout") ||
      error.name === "TypeError";

    if (isNetworkError) {
      console.error(`[API NETWORK_ERROR] ${method} ${path} - ${error.message}`);
      throw new ApiError(
        "NETWORK_ERROR",
        "Cannot connect to server",
        undefined,
        error.message
      );
    }

    // Unknown error
    console.error(`[API UNKNOWN_ERROR] ${method} ${path} - ${error.message}`);
    throw new ApiError("UNKNOWN_ERROR", error.message);
  }
};

/**
 * API Client Object
 *
 * Provides convenient methods for making HTTP requests with different methods.
 * Each method is a thin wrapper around fetchFn with the appropriate HTTP verb.
 *
 * Usage Examples:
 *
 * // GET request - Fetch data
 * const posts = await api.get<Post[]>('/api/posts');
 *
 * // POST request - Create new data
 * const newPost = await api.post<Post>('/api/posts', {
 *   title: 'My Post',
 *   content: 'Hello World'
 * });
 *
 * // PUT request - Replace existing data
 * const updatedPost = await api.put<Post>('/api/posts/123', {
 *   title: 'Updated Title',
 *   content: 'Updated Content'
 * });
 *
 * // PATCH request - Partially update existing data
 * const patchedPost = await api.patch<Post>('/api/posts/123', {
 *   title: 'New Title Only'
 * });
 *
 * // DELETE request - Remove data
 * await api.delete('/api/posts/123');
 */
const api = {
  /**
   * GET - Retrieve data from the server
   * @template T - Expected response type
   * @param path - API endpoint path
   */
  get: <T>(path: string) => fetchFn<T>(path, { method: "GET" }),

  /**
   * POST - Create new data on the server
   * @template T - Expected response type
   * @param path - API endpoint path
   * @param body - Optional request body containing data to create
   */
  post: <T>(path: string, body?: object) => fetchFn<T>(path, { method: "POST", body }),

  /**
   * PUT - Replace existing data on the server
   * @template T - Expected response type
   * @param path - API endpoint path
   * @param body - Optional request body containing data to replace
   */
  put: <T>(path: string, body?: object) => fetchFn<T>(path, { method: "PUT", body }),

  /**
   * PATCH - Partially update existing data on the server
   * @template T - Expected response type
   * @param path - API endpoint path
   * @param body - Optional request body containing partial data to update
   */
  patch: <T>(path: string, body?: object) => fetchFn<T>(path, { method: "PATCH", body }),

  /**
   * DELETE - Remove data from the server
   * @template T - Expected response type
   * @param path - API endpoint path
   */
  delete: <T>(path: string) => fetchFn<T>(path, { method: "DELETE" }),
};

// Export the API client and backend URL to be used in other modules
export { api, BACKEND_URL };
