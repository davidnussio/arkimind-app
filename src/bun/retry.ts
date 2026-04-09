/**
 * Retry utility with exponential backoff for transient errors.
 * Designed for Google Drive API calls (429 rate limiting, 5xx server errors).
 */

export interface RetryOptions {
  /** Max number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelayMs?: number;
  /** Max delay in ms (default: 30000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Predicate to decide if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  isRetryable: isTransientError,
};

/** Check if a Google API error is transient (429 or 5xx). */
export function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  // googleapis errors expose `code` or `status`
  const err = error as Record<string, unknown>;
  const code = typeof err.code === "number" ? err.code : typeof err.status === "number" ? err.status : null;

  if (code !== null) {
    return code === 429 || (code >= 500 && code < 600);
  }

  // Check nested response status
  const response = err.response as Record<string, unknown> | undefined;
  if (response && typeof response.status === "number") {
    return response.status === 429 || (response.status >= 500 && response.status < 600);
  }

  // Network errors
  const message = typeof err.message === "string" ? err.message : "";
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|network/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with retry and exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier, isRetryable } = {
    ...DEFAULT_OPTIONS,
    ...opts,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }

      const jitter = Math.random() * 0.3 + 0.85; // 0.85–1.15
      const delay = Math.min(initialDelayMs * backoffMultiplier ** attempt * jitter, maxDelayMs);
      console.warn(
        `[retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay)}ms...`,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
