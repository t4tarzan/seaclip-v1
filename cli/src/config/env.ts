/**
 * Build environment variables from SeaClipConfig for the server process.
 */

import type { SeaClipConfig } from './store.js';

export interface ServerEnv {
  PORT: string;
  HOST: string;
  SEACLIP_DEPLOYMENT_MODE: string;
  DATABASE_URL: string;
  OLLAMA_BASE_URL: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  LITELLM_BASE_URL?: string;
  SEACLIP_STORAGE_DIR: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  SERVE_UI: string;
  NODE_ENV: string;
}

export function buildEnvFromConfig(config: SeaClipConfig): NodeJS.ProcessEnv {
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PORT: String(config.server.port),
    HOST: config.server.host,
    SEACLIP_DEPLOYMENT_MODE: config.server.deploymentMode,
    OLLAMA_BASE_URL: config.ollama.baseUrl,
    SEACLIP_STORAGE_DIR: config.storage.baseDir,
    SERVE_UI: 'true',
    NODE_ENV: process.env['NODE_ENV'] ?? 'production',
  };

  if (config.database.mode === 'postgres' && config.database.connectionString) {
    env['DATABASE_URL'] = config.database.connectionString;
  } else {
    // Embedded PGlite — server uses embedded PostgreSQL in storage dir
    env['DATABASE_URL'] = `pglite://${config.storage.baseDir}`;
  }

  // Provider API keys
  if (config.providers?.openai?.apiKey) {
    env['OPENAI_API_KEY'] = config.providers.openai.apiKey;
  }
  if (config.providers?.anthropic?.apiKey) {
    env['ANTHROPIC_API_KEY'] = config.providers.anthropic.apiKey;
  }
  if (config.providers?.openrouter?.apiKey) {
    env['OPENROUTER_API_KEY'] = config.providers.openrouter.apiKey;
  }
  if (config.providers?.litellm?.baseUrl) {
    env['LITELLM_BASE_URL'] = config.providers.litellm.baseUrl;
  }

  if (config.telegram.botToken) {
    env['TELEGRAM_BOT_TOKEN'] = config.telegram.botToken;
  }
  if (config.telegram.chatId) {
    env['TELEGRAM_CHAT_ID'] = config.telegram.chatId;
  }

  return env;
}
