/**
 * Rate limiter utility for LLM providers
 * Token bucket rate limiting per provider and per model
 */

interface TokenBucket {
  tokens: number;
  capacity: number;
  refillRate: number; // tokens per second
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

/**
 * Rate limit configuration per provider
 */
const RATE_LIMITS: Record<string, { requestsPerMinute: number; tokensPerMinute?: number }> = {
  'openai': { requestsPerMinute: 500, tokensPerMinute: 150000 },
  'openai:gpt-4o': { requestsPerMinute: 500, tokensPerMinute: 30000 },
  'openai:gpt-4o-mini': { requestsPerMinute: 500, tokensPerMinute: 200000 },
  'anthropic': { requestsPerMinute: 50, tokensPerMinute: 40000 },
  'anthropic:claude-3-5-sonnet': { requestsPerMinute: 50, tokensPerMinute: 40000 },
  'openrouter': { requestsPerMinute: 200 },
  'litellm': { requestsPerMinute: 1000 }, // Depends on proxy config
};

/**
 * Check if request is allowed under rate limit
 */
export async function checkRateLimit(
  provider: string,
  model?: string,
  tokensNeeded = 1,
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const key = model ? `${provider}:${model}` : provider;
  const limit = RATE_LIMITS[key] || RATE_LIMITS[provider] || { requestsPerMinute: 100 };
  
  let bucket = buckets.get(key);
  
  if (!bucket) {
    bucket = {
      tokens: limit.requestsPerMinute,
      capacity: limit.requestsPerMinute,
      refillRate: limit.requestsPerMinute / 60, // per second
      lastRefill: Date.now(),
    };
    buckets.set(key, bucket);
  }

  // Refill tokens based on time elapsed
  const now = Date.now();
  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  const tokensToAdd = elapsedSeconds * bucket.refillRate;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  // Check if we have enough tokens
  if (bucket.tokens >= tokensNeeded) {
    bucket.tokens -= tokensNeeded;
    return { allowed: true };
  }

  // Calculate retry delay
  const tokensShort = tokensNeeded - bucket.tokens;
  const retryAfterMs = (tokensShort / bucket.refillRate) * 1000;

  return {
    allowed: false,
    retryAfterMs: Math.ceil(retryAfterMs),
  };
}

/**
 * Wait for rate limit to allow request
 */
export async function waitForRateLimit(
  provider: string,
  model?: string,
  tokensNeeded = 1,
  maxWaitMs = 60000,
): Promise<void> {
  const startTime = Date.now();

  while (true) {
    const result = await checkRateLimit(provider, model, tokensNeeded);
    
    if (result.allowed) {
      return;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= maxWaitMs) {
      throw new Error(`Rate limit wait timeout after ${maxWaitMs}ms`);
    }

    const waitTime = Math.min(result.retryAfterMs || 1000, maxWaitMs - elapsed);
    await sleep(waitTime);
  }
}

/**
 * Reset rate limiter for a provider (useful for testing)
 */
export function resetRateLimit(provider: string, model?: string): void {
  const key = model ? `${provider}:${model}` : provider;
  buckets.delete(key);
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(provider: string, model?: string): {
  available: number;
  capacity: number;
  refillRate: number;
} | null {
  const key = model ? `${provider}:${model}` : provider;
  const bucket = buckets.get(key);
  
  if (!bucket) {
    return null;
  }

  // Refill before returning status
  const now = Date.now();
  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  const tokensToAdd = elapsedSeconds * bucket.refillRate;
  const available = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);

  return {
    available,
    capacity: bucket.capacity,
    refillRate: bucket.refillRate,
  };
}

/**
 * Update rate limit configuration
 */
export function updateRateLimit(
  provider: string,
  config: { requestsPerMinute: number; tokensPerMinute?: number },
  model?: string,
): void {
  const key = model ? `${provider}:${model}` : provider;
  RATE_LIMITS[key] = config;
  
  // Reset bucket to apply new limits
  buckets.delete(key);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Cleanup all rate limiters
 */
export function cleanupRateLimiters(): void {
  buckets.clear();
}
