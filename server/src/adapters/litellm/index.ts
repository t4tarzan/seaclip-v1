/**
 * LiteLLM adapter for SeaClip
 * Connects to a LiteLLM proxy server for unified access to multiple providers
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
import { normalizeLiteLLMError } from "../llm-utils/errors.js";

const DEFAULT_MODEL = "gpt-3.5-turbo";
const DEFAULT_TIMEOUT_MS = 120000;

export const litellmAdapter: ServerAdapterModule = {
  type: "litellm",
  label: "LiteLLM Proxy",
  description: "Connect to a LiteLLM proxy for unified multi-provider access",

  models: [
    { id: "gpt-4o", label: "GPT-4o (via proxy)", contextWindow: 128000 },
    { id: "gpt-4o-mini", label: "GPT-4o Mini (via proxy)", contextWindow: 128000 },
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (via proxy)", contextWindow: 200000 },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (via proxy)", contextWindow: 200000 },
  ] satisfies AdapterModel[],

  async execute(ctx: AdapterExecuteContext): Promise<AdapterExecuteResult> {
    const config = getConfig();
    const logger = getLogger();

    // Get proxy base URL from adapter config or global config
    const baseUrl = (ctx.adapterConfig.baseUrl as string | undefined) || config.litellmBaseUrl;
    if (!baseUrl) {
      throw new Error("LiteLLM proxy base URL not configured");
    }

    // Validate URL format
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      throw new Error("LiteLLM proxy base URL must start with http:// or https://");
    }

    // Get model
    const model = ctx.model || (ctx.adapterConfig.model as string | undefined) || DEFAULT_MODEL;

    // Get optional API key (some LiteLLM proxies require auth)
    const apiKey = (ctx.adapterConfig.apiKey as string | undefined) || "dummy-key";

    // Initialize OpenAI client with LiteLLM proxy URL
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
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
      { model, agentId: ctx.agentId, messageCount: messages.length, proxyUrl: baseUrl },
      "Calling LiteLLM proxy"
    );

    try {
      const startMs = Date.now();

      // Call LiteLLM proxy
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

      // LiteLLM may include cost in metadata
      let costUsd = 0;
      if ((response as any)._response_ms) {
        // LiteLLM includes cost in response metadata
        costUsd = (response as any).cost || 0;
      }

      logger.debug(
        {
          model,
          inputTokens,
          outputTokens,
          costUsd,
          durationMs: wallDurationMs,
        },
        "LiteLLM proxy call completed"
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
          proxyUrl: baseUrl,
        },
      };
    } catch (err) {
      const normalized = normalizeLiteLLMError(err);
      logger.error(
        { error: normalized, agentId: ctx.agentId },
        "LiteLLM proxy call failed"
      );
      throw new Error(normalized.message);
    }
  },

  async testEnvironment(config: Record<string, unknown>): Promise<AdapterEnvironmentTestResult> {
    const globalConfig = getConfig();
    const baseUrl = (config.baseUrl as string | undefined) || globalConfig.litellmBaseUrl;

    if (!baseUrl) {
      return {
        ok: false,
        message: "LiteLLM proxy base URL not configured",
      };
    }

    // Validate URL format
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      return {
        ok: false,
        message: "LiteLLM proxy base URL must start with http:// or https://",
      };
    }

    try {
      const apiKey = (config.apiKey as string | undefined) || "dummy-key";
      
      // Test proxy health endpoint first
      const healthUrl = `${baseUrl.replace(/\/$/, '')}/health`;
      const healthResponse = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      
      if (!healthResponse.ok) {
        return {
          ok: false,
          message: `LiteLLM proxy health check failed: ${healthResponse.status}`,
        };
      }

      // Test with a minimal request
      const client = new OpenAI({
        apiKey,
        baseURL: baseUrl,
        timeout: 5000,
      });

      await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      });

      return {
        ok: true,
        message: "LiteLLM proxy is accessible",
        details: { provider: "litellm", proxyUrl: baseUrl },
      };
    } catch (err) {
      const normalized = normalizeLiteLLMError(err);
      return {
        ok: false,
        message: normalized.message,
        details: { code: normalized.code },
      };
    }
  },

  async listModels(config: Record<string, unknown>): Promise<AdapterModel[]> {
    const globalConfig = getConfig();
    const baseUrl = (config.baseUrl as string | undefined) || globalConfig.litellmBaseUrl;

    if (!baseUrl) {
      return this.models || [];
    }

    try {
      const apiKey = (config.apiKey as string | undefined) || "dummy-key";
      const client = new OpenAI({
        apiKey,
        baseURL: baseUrl,
        timeout: 10000,
      });

      const response = await client.models.list();

      // Map models from proxy
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
## LiteLLM Proxy Adapter Configuration

| Field       | Type   | Required | Description                                    |
|-------------|--------|----------|------------------------------------------------|
| baseUrl     | string | Yes      | LiteLLM proxy URL (e.g., http://localhost:4000) |
| apiKey      | string | No       | Proxy API key if authentication is enabled     |
| model       | string | No       | Model to use (default: gpt-3.5-turbo)          |
| temperature | number | No       | Sampling temperature 0-2 (default: 0.7)        |
| maxTokens   | number | No       | Maximum tokens to generate                     |

### Setup

1. **Install LiteLLM**:
   \`\`\`bash
   pip install litellm[proxy]
   \`\`\`

2. **Start proxy**:
   \`\`\`bash
   litellm --port 4000
   \`\`\`

3. **Configure SeaClip**:
   Set \`LITELLM_BASE_URL=http://localhost:4000\` or configure in adapter settings.

### Available Models

LiteLLM supports 100+ models from multiple providers:

- **OpenAI**: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
- **Anthropic**: claude-3-5-sonnet, claude-3-5-haiku
- **Google**: gemini-pro, gemini-pro-1.5
- **Meta**: llama-3.3-70b, llama-3.1-405b
- **Mistral**: mistral-large, mistral-medium
- **And many more...**

### Model Format

Use provider/model format:
- \`openai/gpt-4o\`
- \`anthropic/claude-3-5-sonnet\`
- \`google/gemini-pro\`

### Example Configuration

\`\`\`json
{
  "baseUrl": "http://localhost:4000",
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "maxTokens": 4096
}
\`\`\`

### Notes

- LiteLLM provides unified API across all providers
- Supports load balancing, fallbacks, and caching
- Cost tracking included in response metadata
- Health check endpoint: \`/health\`
`.trim(),
};
