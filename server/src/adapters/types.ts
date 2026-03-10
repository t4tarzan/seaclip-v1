/**
 * Shared types for all server adapter modules.
 */

export interface AdapterExecuteContext {
  agentId: string;
  companyId: string;
  runId: string;
  adapterConfig: Record<string, unknown>;
  systemPrompt?: string;
  model?: string;
  timeoutMs: number;
  triggeredBy: string;
  manual: boolean;
  context: Record<string, unknown>;
}

/**
 * OpenAI adapter configuration
 */
export interface OpenAIAdapterConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Anthropic adapter configuration
 */
export interface AnthropicAdapterConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * OpenRouter adapter configuration
 */
export interface OpenRouterAdapterConfig {
  apiKey?: string;
  model?: string;
  httpReferer?: string;
  xTitle?: string;
}

/**
 * LiteLLM adapter configuration
 */
export interface LiteLLMAdapterConfig {
  baseUrl: string;
  model?: string;
  apiKey?: string;
}

export interface AdapterExecuteResult {
  output?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  metadata?: Record<string, unknown>;
}

export interface AdapterModel {
  id: string;
  label: string;
  contextWindow?: number;
}

export interface AdapterEnvironmentTestResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ServerAdapterModule {
  type: string;
  label: string;
  description: string;
  execute(context: AdapterExecuteContext): Promise<AdapterExecuteResult>;
  testEnvironment(config: Record<string, unknown>): Promise<AdapterEnvironmentTestResult>;
  listModels?(config: Record<string, unknown>): Promise<AdapterModel[]>;
  models?: AdapterModel[];
  agentConfigurationDoc?: string;
}
