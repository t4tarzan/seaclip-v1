import { seaclawAdapter } from "./seaclaw/index.js";
import { ollamaLocalAdapter } from "./ollama-local/index.js";
import { agentZeroAdapter } from "./agent-zero/index.js";
import { externalAgentAdapter } from "./external-agent/index.js";
import { telegramBridgeAdapter } from "./telegram-bridge/index.js";
import { processAdapter } from "./process/index.js";
import { httpAdapter } from "./http/index.js";
import { claudeCodeAdapter } from "./claude-code/index.js";
import { openaiAdapter } from "./openai/index.js";
import { anthropicAdapter } from "./anthropic/index.js";
import { openrouterAdapter } from "./openrouter/index.js";
import { litellmAdapter } from "./litellm/index.js";
import type { ServerAdapterModule } from "./types.js";
import { notFound } from "../errors.js";

const adaptersByType = new Map<string, ServerAdapterModule>([
  ["seaclaw", seaclawAdapter],
  ["ollama_local", ollamaLocalAdapter],
  ["openai", openaiAdapter],
  ["anthropic", anthropicAdapter],
  ["openrouter", openrouterAdapter],
  ["litellm", litellmAdapter],
  ["agent_zero", agentZeroAdapter],
  ["external_agent", externalAgentAdapter],
  ["telegram_bridge", telegramBridgeAdapter],
  ["process", processAdapter],
  ["http", httpAdapter],
  ["claude_code", claudeCodeAdapter],
]);

export function getServerAdapter(type: string): ServerAdapterModule {
  const adapter = adaptersByType.get(type);
  if (!adapter) {
    throw notFound(
      `Unknown adapter type "${type}". Available: ${listServerAdapters()
        .map((a) => a.type)
        .join(", ")}`,
    );
  }
  return adapter;
}

export function listServerAdapters(): ServerAdapterModule[] {
  return Array.from(adaptersByType.values());
}

export function registerAdapter(adapter: ServerAdapterModule): void {
  adaptersByType.set(adapter.type, adapter);
}
