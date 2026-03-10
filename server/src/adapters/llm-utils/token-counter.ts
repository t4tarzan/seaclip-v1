/**
 * Token counting utility for various LLM models
 * Uses tiktoken for accurate token counting
 */

import { encoding_for_model, get_encoding, type TiktokenModel } from 'tiktoken';

const encodingCache = new Map<string, ReturnType<typeof get_encoding>>();

/**
 * Count tokens for a given text using the appropriate tokenizer
 */
export function countTokens(text: string, model: string): number {
  if (!text) return 0;

  try {
    // Map model to tiktoken encoding
    const encoding = getEncodingForModel(model);
    const tokens = encoding.encode(text);
    return tokens.length;
  } catch (err) {
    // Fallback: rough estimate (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Get the appropriate tiktoken encoding for a model
 */
function getEncodingForModel(model: string): ReturnType<typeof get_encoding> {
  // Check cache first
  if (encodingCache.has(model)) {
    return encodingCache.get(model)!;
  }

  let encoding: ReturnType<typeof get_encoding>;

  // GPT-4, GPT-4o, GPT-3.5 models use cl100k_base
  if (model.startsWith('gpt-4') || model.startsWith('gpt-3.5')) {
    encoding = get_encoding('cl100k_base');
  }
  // Claude models - approximate with cl100k_base (close enough)
  else if (model.includes('claude')) {
    encoding = get_encoding('cl100k_base');
  }
  // Llama models - approximate with cl100k_base
  else if (model.includes('llama') || model.includes('mistral')) {
    encoding = get_encoding('cl100k_base');
  }
  // Default fallback
  else {
    encoding = get_encoding('cl100k_base');
  }

  encodingCache.set(model, encoding);
  return encoding;
}

/**
 * Count tokens for messages (system + user prompts)
 */
export function countMessageTokens(
  messages: Array<{ role: string; content: string }>,
  model: string,
): number {
  let total = 0;

  for (const msg of messages) {
    // Count content tokens
    total += countTokens(msg.content, model);
    // Add overhead for message formatting (role, delimiters, etc.)
    total += 4; // Approximate overhead per message
  }

  // Add overhead for conversation formatting
  total += 3;

  return total;
}

/**
 * Estimate cost based on token count and model pricing
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const pricing = getModelPricing(model);
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return inputCost + outputCost;
}

/**
 * Get pricing for a model (USD per 1M tokens)
 */
function getModelPricing(model: string): { inputPer1M: number; outputPer1M: number } {
  // OpenAI pricing
  if (model === 'gpt-4o') return { inputPer1M: 5.0, outputPer1M: 15.0 };
  if (model === 'gpt-4o-mini') return { inputPer1M: 0.15, outputPer1M: 0.6 };
  if (model === 'gpt-4-turbo') return { inputPer1M: 10.0, outputPer1M: 30.0 };
  if (model === 'o1') return { inputPer1M: 15.0, outputPer1M: 60.0 };
  if (model === 'o1-mini') return { inputPer1M: 3.0, outputPer1M: 12.0 };

  // Anthropic pricing
  if (model === 'claude-3-5-sonnet-20241022') return { inputPer1M: 3.0, outputPer1M: 15.0 };
  if (model === 'claude-3-5-haiku-20241022') return { inputPer1M: 1.0, outputPer1M: 5.0 };
  if (model === 'claude-3-opus-20240229') return { inputPer1M: 15.0, outputPer1M: 75.0 };

  // Default fallback
  return { inputPer1M: 0, outputPer1M: 0 };
}

/**
 * Clean up cached encodings (call on shutdown)
 */
export function cleanupTokenCounter(): void {
  for (const encoding of encodingCache.values()) {
    encoding.free();
  }
  encodingCache.clear();
}
