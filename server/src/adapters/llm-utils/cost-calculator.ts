/**
 * Cost calculation utility for LLM providers
 * Maintains pricing tables and calculates costs based on token usage
 */

export interface ModelPricing {
  inputPer1M: number;  // USD per 1M input tokens
  outputPer1M: number; // USD per 1M output tokens
}

/**
 * Pricing table for all supported models (USD per 1M tokens)
 * Updated as of March 2026
 */
const PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI models
  'gpt-4o': { inputPer1M: 5.0, outputPer1M: 15.0 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4-turbo': { inputPer1M: 10.0, outputPer1M: 30.0 },
  'gpt-4': { inputPer1M: 30.0, outputPer1M: 60.0 },
  'gpt-3.5-turbo': { inputPer1M: 0.5, outputPer1M: 1.5 },
  'o1': { inputPer1M: 15.0, outputPer1M: 60.0 },
  'o1-mini': { inputPer1M: 3.0, outputPer1M: 12.0 },

  // Anthropic models
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-5-haiku-20241022': { inputPer1M: 1.0, outputPer1M: 5.0 },
  'claude-3-opus-20240229': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-3-sonnet-20240229': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },

  // OpenRouter models (examples - actual pricing varies)
  'anthropic/claude-3.5-sonnet': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'openai/gpt-4o': { inputPer1M: 5.0, outputPer1M: 15.0 },
  'google/gemini-pro-1.5': { inputPer1M: 1.25, outputPer1M: 5.0 },
  'meta-llama/llama-3.3-70b': { inputPer1M: 0.88, outputPer1M: 0.88 },

  // Local models (free)
  'ollama': { inputPer1M: 0, outputPer1M: 0 },
};

/**
 * Calculate cost based on token usage
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const pricing = getPricing(model);
  
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  
  return inputCost + outputCost;
}

/**
 * Get pricing for a specific model
 */
export function getPricing(model: string): ModelPricing {
  // Direct lookup
  if (PRICING_TABLE[model]) {
    return PRICING_TABLE[model];
  }

  // Fuzzy matching for model variants
  const modelLower = model.toLowerCase();
  
  // GPT-4o variants
  if (modelLower.includes('gpt-4o-mini')) {
    return PRICING_TABLE['gpt-4o-mini'];
  }
  if (modelLower.includes('gpt-4o')) {
    return PRICING_TABLE['gpt-4o'];
  }
  
  // GPT-4 variants
  if (modelLower.includes('gpt-4-turbo')) {
    return PRICING_TABLE['gpt-4-turbo'];
  }
  if (modelLower.includes('gpt-4')) {
    return PRICING_TABLE['gpt-4'];
  }
  
  // GPT-3.5 variants
  if (modelLower.includes('gpt-3.5')) {
    return PRICING_TABLE['gpt-3.5-turbo'];
  }
  
  // Claude variants
  if (modelLower.includes('claude-3-5-sonnet') || modelLower.includes('claude-3.5-sonnet')) {
    return PRICING_TABLE['claude-3-5-sonnet-20241022'];
  }
  if (modelLower.includes('claude-3-5-haiku') || modelLower.includes('claude-3.5-haiku')) {
    return PRICING_TABLE['claude-3-5-haiku-20241022'];
  }
  if (modelLower.includes('claude-3-opus')) {
    return PRICING_TABLE['claude-3-opus-20240229'];
  }
  
  // o1 variants
  if (modelLower.includes('o1-mini')) {
    return PRICING_TABLE['o1-mini'];
  }
  if (modelLower.includes('o1')) {
    return PRICING_TABLE['o1'];
  }
  
  // Ollama/local models
  if (modelLower.includes('ollama') || modelLower.includes('llama') || modelLower.includes('mistral')) {
    return PRICING_TABLE['ollama'];
  }

  // Default: return zero cost for unknown models
  return { inputPer1M: 0, outputPer1M: 0 };
}

/**
 * Format cost as USD string
 */
export function formatCost(costUsd: number): string {
  if (costUsd === 0) return '$0.00';
  if (costUsd < 0.01) return `$${costUsd.toFixed(4)}`;
  return `$${costUsd.toFixed(2)}`;
}

/**
 * Calculate cost breakdown
 */
export function calculateCostBreakdown(
  inputTokens: number,
  outputTokens: number,
  model: string,
): {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  const pricing = getPricing(model);
  
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

/**
 * Update pricing for a model (for dynamic pricing updates)
 */
export function updatePricing(model: string, pricing: ModelPricing): void {
  PRICING_TABLE[model] = pricing;
}

/**
 * Get all available pricing
 */
export function getAllPricing(): Record<string, ModelPricing> {
  return { ...PRICING_TABLE };
}
