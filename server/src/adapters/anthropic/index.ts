/**
 * Anthropic adapter for SeaClip
 * Supports Claude 3.5 Sonnet, Haiku, and Opus models
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
import Anthropic from "@anthropic-ai/sdk";
import { calculateCost } from "../llm-utils/cost-calculator.js";
import { normalizeAnthropicError } from "../llm-utils/errors.js";

const DEFAULT_MODEL = "claude-3-5-haiku-20241022";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 120000;

export const anthropicAdapter: ServerAdapterModule = {
  type: "anthropic",
  label: "Anthropic",
  description: "Anthropic Claude models via official API",

  models: [
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", contextWindow: 200000 },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", contextWindow: 200000 },
    { id: "claude-3-opus-20240229", label: "Claude 3 Opus", contextWindow: 200000 },
    { id: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet", contextWindow: 200000 },
    { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku", contextWindow: 200000 },
  ] satisfies AdapterModel[],

  async execute(ctx: AdapterExecuteContext): Promise<AdapterExecuteResult> {
    const config = getConfig();
    const logger = getLogger();

    // Get API key from adapter config or global config
    const apiKey = (ctx.adapterConfig.apiKey as string | undefined) || config.anthropicApiKey;
    if (!apiKey) {
      throw new Error("Anthropic API key not configured");
    }

    // Get model
    const model = ctx.model || (ctx.adapterConfig.model as string | undefined) || DEFAULT_MODEL;

    // Initialize Anthropic client
    const client = new Anthropic({
      apiKey,
      timeout: ctx.timeoutMs || DEFAULT_TIMEOUT_MS,
    });

    // Build messages (Anthropic format: system is separate from messages)
    const messages: Anthropic.MessageParam[] = [];

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
      "Calling Anthropic API"
    );

    try {
      const startMs = Date.now();

      // Call Anthropic API
      const response = await client.messages.create({
        model,
        max_tokens: (ctx.adapterConfig.maxTokens as number | undefined) || DEFAULT_MAX_TOKENS,
        system: ctx.systemPrompt,
        messages,
        temperature: (ctx.adapterConfig.temperature as number | undefined) ?? 1.0,
      });

      const wallDurationMs = Date.now() - startMs;

      // Extract response
      const output = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as any).text)
        .join("\n");

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;

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
        "Anthropic API call completed"
      );

      return {
        output,
        inputTokens,
        outputTokens,
        costUsd,
        metadata: {
          model,
          stopReason: response.stop_reason,
          wallDurationMs,
        },
      };
    } catch (err) {
      const normalized = normalizeAnthropicError(err);
      logger.error(
        { error: normalized, agentId: ctx.agentId },
        "Anthropic API call failed"
      );
      throw new Error(normalized.message);
    }
  },

  async testEnvironment(config: Record<string, unknown>): Promise<AdapterEnvironmentTestResult> {
    const globalConfig = getConfig();
    const apiKey = (config.apiKey as string | undefined) || globalConfig.anthropicApiKey;

    if (!apiKey) {
      return {
        ok: false,
        message: "Anthropic API key not configured",
      };
    }

    try {
      const client = new Anthropic({ apiKey, timeout: 5000 });

      // Test with a minimal request
      await client.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 10,
        messages: [{ role: "user", content: "test" }],
      });

      return {
        ok: true,
        message: "Anthropic API is accessible",
        details: { provider: "anthropic" },
      };
    } catch (err) {
      const normalized = normalizeAnthropicError(err);
      return {
        ok: false,
        message: normalized.message,
        details: { code: normalized.code },
      };
    }
  },

  async listModels(): Promise<AdapterModel[]> {
    // Anthropic doesn't have a models list endpoint
    // Return static list
    return this.models || [];
  },

  agentConfigurationDoc: `
## Anthropic Adapter Configuration

| Field       | Type   | Required | Description                                       |
|-------------|--------|----------|---------------------------------------------------|
| apiKey      | string | No       | Anthropic API key (default: from ANTHROPIC_API_KEY env) |
| model       | string | No       | Model override (default: claude-3-5-haiku-20241022) |
| temperature | number | No       | Sampling temperature 0-1 (default: 1.0)           |
| maxTokens   | number | No       | Maximum tokens to generate (default: 4096)        |

### Available Models

- **claude-3-5-sonnet-20241022** — Most capable, 200k context
- **claude-3-5-haiku-20241022** — Fast and affordable, 200k context (recommended)
- **claude-3-opus-20240229** — Highest intelligence, 200k context
- **claude-3-sonnet-20240229** — Balanced, 200k context
- **claude-3-haiku-20240307** — Fastest, 200k context

### Pricing (as of March 2026)

- **Claude 3.5 Sonnet**: $3/$15 per 1M tokens (input/output)
- **Claude 3.5 Haiku**: $1/$5 per 1M tokens
- **Claude 3 Opus**: $15/$75 per 1M tokens

### Example Configuration

\`\`\`json
{
  "model": "claude-3-5-haiku-20241022",
  "temperature": 1.0,
  "maxTokens": 4096
}
\`\`\`

### Notes

- Anthropic requires \`max_tokens\` parameter (unlike OpenAI)
- System prompt is passed separately from messages
- All Claude 3+ models support 200k context window
`.trim(),
};
