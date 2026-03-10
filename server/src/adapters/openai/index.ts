/**
 * OpenAI adapter for SeaClip
 * Supports GPT-4o, GPT-4o-mini, o1, o1-mini models
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
import { calculateCost } from "../llm-utils/cost-calculator.js";
import { normalizeOpenAIError } from "../llm-utils/errors.js";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 120000;

export const openaiAdapter: ServerAdapterModule = {
  type: "openai",
  label: "OpenAI",
  description: "OpenAI GPT models via official API",

  models: [
    { id: "gpt-4o", label: "GPT-4o", contextWindow: 128000 },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", contextWindow: 128000 },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo", contextWindow: 128000 },
    { id: "gpt-4", label: "GPT-4", contextWindow: 8192 },
    { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", contextWindow: 16385 },
    { id: "o1", label: "o1", contextWindow: 200000 },
    { id: "o1-mini", label: "o1 Mini", contextWindow: 128000 },
  ] satisfies AdapterModel[],

  async execute(ctx: AdapterExecuteContext): Promise<AdapterExecuteResult> {
    const config = getConfig();
    const logger = getLogger();

    // Get API key from adapter config or global config
    const apiKey = (ctx.adapterConfig.apiKey as string | undefined) || config.openaiApiKey;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    // Get model
    const model = ctx.model || (ctx.adapterConfig.model as string | undefined) || DEFAULT_MODEL;

    // Initialize OpenAI client
    const client = new OpenAI({
      apiKey,
      timeout: ctx.timeoutMs || DEFAULT_TIMEOUT_MS,
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
      "Calling OpenAI API"
    );

    try {
      const startMs = Date.now();

      // Call OpenAI API
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

      // Calculate cost
      const costUsd = calculateCost(inputTokens, outputTokens, model);

      logger.debug(
        {
          model,
          inputTokens,
          outputTokens,
          costUsd,
          durationMs: wallDurationMs,
        },
        "OpenAI API call completed"
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
      const normalized = normalizeOpenAIError(err);
      logger.error(
        { error: normalized, agentId: ctx.agentId },
        "OpenAI API call failed"
      );
      throw new Error(normalized.message);
    }
  },

  async testEnvironment(config: Record<string, unknown>): Promise<AdapterEnvironmentTestResult> {
    const globalConfig = getConfig();
    const apiKey = (config.apiKey as string | undefined) || globalConfig.openaiApiKey;

    if (!apiKey) {
      return {
        ok: false,
        message: "OpenAI API key not configured",
      };
    }

    try {
      const client = new OpenAI({ apiKey, timeout: 5000 });

      // Test with a minimal request
      await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      });

      return {
        ok: true,
        message: "OpenAI API is accessible",
        details: { provider: "openai" },
      };
    } catch (err) {
      const normalized = normalizeOpenAIError(err);
      return {
        ok: false,
        message: normalized.message,
        details: { code: normalized.code },
      };
    }
  },

  async listModels(config: Record<string, unknown>): Promise<AdapterModel[]> {
    const globalConfig = getConfig();
    const apiKey = (config.apiKey as string | undefined) || globalConfig.openaiApiKey;

    if (!apiKey) {
      return this.models || [];
    }

    try {
      const client = new OpenAI({ apiKey, timeout: 10000 });
      const response = await client.models.list();

      // Filter to chat completion models only
      const chatModels = response.data
        .filter((m) => m.id.includes("gpt") || m.id.includes("o1"))
        .map((m) => ({
          id: m.id,
          label: m.id,
        }));

      return chatModels.length > 0 ? chatModels : (this.models || []);
    } catch (err) {
      // Fallback to static models on error
      return this.models || [];
    }
  },

  agentConfigurationDoc: `
## OpenAI Adapter Configuration

| Field       | Type   | Required | Description                                    |
|-------------|--------|----------|------------------------------------------------|
| apiKey      | string | No       | OpenAI API key (default: from OPENAI_API_KEY env) |
| model       | string | No       | Model override (default: gpt-4o-mini)          |
| temperature | number | No       | Sampling temperature 0-2 (default: 0.7)        |
| maxTokens   | number | No       | Maximum tokens to generate                     |

### Available Models

- **gpt-4o** — Most capable model, 128k context
- **gpt-4o-mini** — Fast and affordable, 128k context (recommended)
- **gpt-4-turbo** — Previous generation, 128k context
- **gpt-4** — Original GPT-4, 8k context
- **gpt-3.5-turbo** — Fast and cheap, 16k context
- **o1** — Advanced reasoning model, 200k context
- **o1-mini** — Faster reasoning model, 128k context

### Pricing (as of March 2026)

- **gpt-4o**: $5/$15 per 1M tokens (input/output)
- **gpt-4o-mini**: $0.15/$0.60 per 1M tokens
- **o1**: $15/$60 per 1M tokens

### Example Configuration

\`\`\`json
{
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "maxTokens": 4096
}
\`\`\`
`.trim(),
};
