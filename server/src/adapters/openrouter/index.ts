/**
 * OpenRouter adapter for SeaClip
 * Provides access to 100+ models through OpenRouter's unified API
 */

import type {
  ServerAdapterModule,
  AdapterExecuteContext,
  AdapterExecuteResult,
  AdapterEnvironmentTestResult,
  AdapterModel,
} from "../types.js";
import { getConfig } from "../../config.js";
import { getLogger } from "../../middleware/logger.js";
import OpenAI from "openai";
import { normalizeOpenRouterError } from "../llm-utils/errors.js";

const DEFAULT_MODEL = "anthropic/claude-3.5-haiku";
const DEFAULT_TIMEOUT_MS = 120000;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const openrouterAdapter: ServerAdapterModule = {
  type: "openrouter",
  label: "OpenRouter",
  description: "Access 100+ models through OpenRouter's unified API",

  models: [
    { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", contextWindow: 200000 },
    { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku", contextWindow: 200000 },
    { id: "openai/gpt-4o", label: "GPT-4o", contextWindow: 128000 },
    { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", contextWindow: 128000 },
    { id: "google/gemini-pro-1.5", label: "Gemini Pro 1.5", contextWindow: 1000000 },
    { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", contextWindow: 128000 },
    { id: "mistralai/mistral-large", label: "Mistral Large", contextWindow: 128000 },
  ] satisfies AdapterModel[],

  async execute(ctx: AdapterExecuteContext): Promise<AdapterExecuteResult> {
    const config = getConfig();
    const logger = getLogger();

    // Get API key from adapter config or global config
    const apiKey = (ctx.adapterConfig.apiKey as string | undefined) || config.openrouterApiKey;
    if (!apiKey) {
      throw new Error("OpenRouter API key not configured");
    }

    // Get model
    const model = ctx.model || (ctx.adapterConfig.model as string | undefined) || DEFAULT_MODEL;

    // Initialize OpenAI client with OpenRouter base URL
    const client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
      timeout: ctx.timeoutMs || DEFAULT_TIMEOUT_MS,
      defaultHeaders: {
        "HTTP-Referer": (ctx.adapterConfig.httpReferer as string | undefined) || "https://seaclip.ai",
        "X-Title": (ctx.adapterConfig.xTitle as string | undefined) || "SeaClip",
      },
    });

    // Build messages
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (ctx.systemPrompt) {
      messages.push({
        role: "system",
        content: ctx.systemPrompt,
      });
    }

    // Build user message from context
    const userContent = ctx.context.prompt
      ? String(ctx.context.prompt)
      : `Perform your scheduled task. Context: ${JSON.stringify(ctx.context)}`;

    messages.push({
      role: "user",
      content: userContent,
    });

    logger.debug(
      { model, agentId: ctx.agentId, messageCount: messages.length },
      "Calling OpenRouter API"
    );

    try {
      const startMs = Date.now();

      // Call OpenRouter API
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: (ctx.adapterConfig.temperature as number | undefined) ?? 0.7,
        max_tokens: (ctx.adapterConfig.maxTokens as number | undefined),
      });

      const wallDurationMs = Date.now() - startMs;

      // Extract response
      const output = response.choices[0]?.message?.content || "";
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;

      // Extract cost from OpenRouter headers (if available)
      // Note: In actual implementation, we'd need to access response headers
      // For now, we'll estimate based on model pricing
      let costUsd = 0;
      
      // OpenRouter provides cost in response headers as x-openrouter-cost
      // Since we can't easily access headers here, we'll use a fallback
      if (model.includes('claude-3.5-sonnet')) {
        costUsd = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;
      } else if (model.includes('claude-3.5-haiku')) {
        costUsd = (inputTokens / 1_000_000) * 1.0 + (outputTokens / 1_000_000) * 5.0;
      } else if (model.includes('gpt-4o-mini')) {
        costUsd = (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.6;
      } else if (model.includes('gpt-4o')) {
        costUsd = (inputTokens / 1_000_000) * 5.0 + (outputTokens / 1_000_000) * 15.0;
      }

      logger.debug(
        {
          model,
          inputTokens,
          outputTokens,
          costUsd,
          durationMs: wallDurationMs,
        },
        "OpenRouter API call completed"
      );

      return {
        output,
        inputTokens,
        outputTokens,
        costUsd,
        metadata: {
          model,
          finishReason: response.choices[0]?.finish_reason,
          wallDurationMs,
        },
      };
    } catch (err) {
      const normalized = normalizeOpenRouterError(err);
      logger.error(
        { error: normalized, agentId: ctx.agentId },
        "OpenRouter API call failed"
      );
      throw new Error(normalized.message);
    }
  },

  async testEnvironment(config: Record<string, unknown>): Promise<AdapterEnvironmentTestResult> {
    const globalConfig = getConfig();
    const apiKey = (config.apiKey as string | undefined) || globalConfig.openrouterApiKey;

    if (!apiKey) {
      return {
        ok: false,
        message: "OpenRouter API key not configured",
      };
    }

    try {
      const client = new OpenAI({
        apiKey,
        baseURL: OPENROUTER_BASE_URL,
        timeout: 5000,
        defaultHeaders: {
          "HTTP-Referer": "https://seaclip.ai",
          "X-Title": "SeaClip",
        },
      });

      // Test with a free/cheap model
      await client.chat.completions.create({
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      });

      return {
        ok: true,
        message: "OpenRouter API is accessible",
        details: { provider: "openrouter" },
      };
    } catch (err) {
      const normalized = normalizeOpenRouterError(err);
      return {
        ok: false,
        message: normalized.message,
        details: { code: normalized.code },
      };
    }
  },

  async listModels(config: Record<string, unknown>): Promise<AdapterModel[]> {
    const globalConfig = getConfig();
    const apiKey = (config.apiKey as string | undefined) || globalConfig.openrouterApiKey;

    if (!apiKey) {
      return this.models || [];
    }

    try {
      const client = new OpenAI({
        apiKey,
        baseURL: OPENROUTER_BASE_URL,
        timeout: 10000,
      });

      const response = await client.models.list();

      // Map OpenRouter models
      const models = response.data.map((m) => ({
        id: m.id,
        label: m.id,
      }));

      return models.length > 0 ? models : (this.models || []);
    } catch (err) {
      // Fallback to static models on error
      return this.models || [];
    }
  },

  agentConfigurationDoc: `
## OpenRouter Adapter Configuration

| Field        | Type   | Required | Description                                    |
|--------------|--------|----------|------------------------------------------------|
| apiKey       | string | No       | OpenRouter API key (default: from OPENROUTER_API_KEY env) |
| model        | string | No       | Model override (default: anthropic/claude-3.5-haiku) |
| temperature  | number | No       | Sampling temperature 0-2 (default: 0.7)        |
| maxTokens    | number | No       | Maximum tokens to generate                     |
| httpReferer  | string | No       | HTTP Referer header (default: https://seaclip.ai) |
| xTitle       | string | No       | X-Title header (default: SeaClip)              |

### Available Models (100+)

Popular models include:

- **anthropic/claude-3.5-sonnet** — Claude 3.5 Sonnet, 200k context
- **anthropic/claude-3.5-haiku** — Claude 3.5 Haiku, 200k context (recommended)
- **openai/gpt-4o** — GPT-4o, 128k context
- **openai/gpt-4o-mini** — GPT-4o Mini, 128k context
- **google/gemini-pro-1.5** — Gemini Pro 1.5, 1M context
- **meta-llama/llama-3.3-70b-instruct** — Llama 3.3 70B, 128k context
- **mistralai/mistral-large** — Mistral Large, 128k context

### Pricing

OpenRouter pricing varies by model. Check https://openrouter.ai/models for current pricing.

Cost is returned in the \`x-openrouter-cost\` response header.

### Example Configuration

\`\`\`json
{
  "model": "anthropic/claude-3.5-haiku",
  "temperature": 0.7,
  "maxTokens": 4096,
  "httpReferer": "https://seaclip.ai",
  "xTitle": "SeaClip"
}
\`\`\`

### Notes

- OpenRouter uses OpenAI-compatible API
- Requires HTTP-Referer and X-Title headers
- Access to 100+ models from multiple providers
- Unified billing across all models
`.trim(),
};
