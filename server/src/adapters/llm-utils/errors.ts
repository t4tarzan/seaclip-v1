/**
 * Error normalizer utility for LLM providers
 * Maps provider-specific errors to standard format with retry categorization
 */

export interface NormalizedError {
  message: string;
  code: string;
  provider: string;
  retryable: boolean;
  retryAfterMs?: number;
  originalError?: unknown;
}

export type ErrorCategory = 'rate_limit' | 'auth' | 'validation' | 'server' | 'timeout' | 'network' | 'unknown';

/**
 * Normalize OpenAI errors
 */
export function normalizeOpenAIError(error: any): NormalizedError {
  const status = error?.status || error?.response?.status;
  const message = error?.message || error?.error?.message || 'Unknown OpenAI error';
  const code = error?.code || error?.error?.code || 'unknown';

  // Rate limit errors (429)
  if (status === 429) {
    const retryAfter = error?.response?.headers?.['retry-after'];
    return {
      message: 'OpenAI rate limit exceeded',
      code: 'rate_limit',
      provider: 'openai',
      retryable: true,
      retryAfterMs: retryAfter ? parseInt(retryAfter) * 1000 : 60000,
      originalError: error,
    };
  }

  // Authentication errors (401)
  if (status === 401) {
    return {
      message: 'OpenAI authentication failed - invalid API key',
      code: 'auth_error',
      provider: 'openai',
      retryable: false,
      originalError: error,
    };
  }

  // Validation errors (400)
  if (status === 400) {
    return {
      message: `OpenAI validation error: ${message}`,
      code: 'validation_error',
      provider: 'openai',
      retryable: false,
      originalError: error,
    };
  }

  // Server errors (500+)
  if (status >= 500) {
    return {
      message: `OpenAI server error: ${message}`,
      code: 'server_error',
      provider: 'openai',
      retryable: true,
      retryAfterMs: 5000,
      originalError: error,
    };
  }

  // Timeout errors
  if (code === 'ECONNABORTED' || message.includes('timeout')) {
    return {
      message: 'OpenAI request timeout',
      code: 'timeout',
      provider: 'openai',
      retryable: true,
      retryAfterMs: 1000,
      originalError: error,
    };
  }

  // Network errors
  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED') {
    return {
      message: 'OpenAI network error - cannot reach API',
      code: 'network_error',
      provider: 'openai',
      retryable: true,
      retryAfterMs: 5000,
      originalError: error,
    };
  }

  // Unknown error
  return {
    message: `OpenAI error: ${message}`,
    code: 'unknown',
    provider: 'openai',
    retryable: false,
    originalError: error,
  };
}

/**
 * Normalize Anthropic errors
 */
export function normalizeAnthropicError(error: any): NormalizedError {
  const status = error?.status || error?.response?.status;
  const message = error?.message || error?.error?.message || 'Unknown Anthropic error';
  const errorType = error?.error?.type;

  // Overloaded errors (529)
  if (status === 529 || errorType === 'overloaded_error') {
    return {
      message: 'Anthropic API is overloaded',
      code: 'overloaded',
      provider: 'anthropic',
      retryable: true,
      retryAfterMs: 10000,
      originalError: error,
    };
  }

  // Rate limit errors (429)
  if (status === 429 || errorType === 'rate_limit_error') {
    const retryAfter = error?.response?.headers?.['retry-after'];
    return {
      message: 'Anthropic rate limit exceeded',
      code: 'rate_limit',
      provider: 'anthropic',
      retryable: true,
      retryAfterMs: retryAfter ? parseInt(retryAfter) * 1000 : 60000,
      originalError: error,
    };
  }

  // Authentication errors (401)
  if (status === 401 || errorType === 'authentication_error') {
    return {
      message: 'Anthropic authentication failed - invalid API key',
      code: 'auth_error',
      provider: 'anthropic',
      retryable: false,
      originalError: error,
    };
  }

  // Validation errors (400)
  if (status === 400 || errorType === 'invalid_request_error') {
    return {
      message: `Anthropic validation error: ${message}`,
      code: 'validation_error',
      provider: 'anthropic',
      retryable: false,
      originalError: error,
    };
  }

  // Server errors (500+)
  if (status >= 500) {
    return {
      message: `Anthropic server error: ${message}`,
      code: 'server_error',
      provider: 'anthropic',
      retryable: true,
      retryAfterMs: 5000,
      originalError: error,
    };
  }

  // Unknown error
  return {
    message: `Anthropic error: ${message}`,
    code: 'unknown',
    provider: 'anthropic',
    retryable: false,
    originalError: error,
  };
}

/**
 * Normalize OpenRouter errors
 */
export function normalizeOpenRouterError(error: any): NormalizedError {
  const status = error?.status || error?.response?.status;
  const message = error?.message || 'Unknown OpenRouter error';

  // OpenRouter uses OpenAI-compatible errors, so similar handling
  if (status === 429) {
    return {
      message: 'OpenRouter rate limit exceeded',
      code: 'rate_limit',
      provider: 'openrouter',
      retryable: true,
      retryAfterMs: 60000,
      originalError: error,
    };
  }

  if (status === 401) {
    return {
      message: 'OpenRouter authentication failed - invalid API key',
      code: 'auth_error',
      provider: 'openrouter',
      retryable: false,
      originalError: error,
    };
  }

  if (status === 402) {
    return {
      message: 'OpenRouter insufficient credits',
      code: 'insufficient_credits',
      provider: 'openrouter',
      retryable: false,
      originalError: error,
    };
  }

  if (status >= 500) {
    return {
      message: `OpenRouter server error: ${message}`,
      code: 'server_error',
      provider: 'openrouter',
      retryable: true,
      retryAfterMs: 5000,
      originalError: error,
    };
  }

  return {
    message: `OpenRouter error: ${message}`,
    code: 'unknown',
    provider: 'openrouter',
    retryable: false,
    originalError: error,
  };
}

/**
 * Normalize LiteLLM proxy errors
 */
export function normalizeLiteLLMError(error: any): NormalizedError {
  const status = error?.status || error?.response?.status;
  const message = error?.message || 'Unknown LiteLLM error';

  if (status === 503) {
    return {
      message: 'LiteLLM proxy unavailable',
      code: 'proxy_unavailable',
      provider: 'litellm',
      retryable: true,
      retryAfterMs: 5000,
      originalError: error,
    };
  }

  if (status >= 500) {
    return {
      message: `LiteLLM proxy error: ${message}`,
      code: 'server_error',
      provider: 'litellm',
      retryable: true,
      retryAfterMs: 5000,
      originalError: error,
    };
  }

  return {
    message: `LiteLLM error: ${message}`,
    code: 'unknown',
    provider: 'litellm',
    retryable: false,
    originalError: error,
  };
}

/**
 * Categorize error for logging/monitoring
 */
export function categorizeError(error: NormalizedError): ErrorCategory {
  if (error.code === 'rate_limit' || error.code === 'overloaded') return 'rate_limit';
  if (error.code === 'auth_error') return 'auth';
  if (error.code === 'validation_error') return 'validation';
  if (error.code === 'server_error') return 'server';
  if (error.code === 'timeout') return 'timeout';
  if (error.code === 'network_error') return 'network';
  return 'unknown';
}

/**
 * Determine if error should be retried
 */
export function shouldRetry(error: NormalizedError, attemptNumber: number, maxAttempts = 3): boolean {
  if (!error.retryable) return false;
  if (attemptNumber >= maxAttempts) return false;
  return true;
}

/**
 * Calculate backoff delay for retry
 */
export function calculateBackoff(attemptNumber: number, baseDelayMs = 1000): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber - 1);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 60000); // Cap at 60 seconds
}
