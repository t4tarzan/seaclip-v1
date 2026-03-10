import "dotenv/config";

export interface Config {
  deploymentMode: "local_trusted" | "authenticated";
  host: string;
  port: number;
  databaseUrl: string;
  serveUi: boolean;
  ollamaBaseUrl: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  openrouterApiKey: string;
  litellmBaseUrl: string;
  telegramBotToken: string;
  heartbeatSchedulerEnabled: boolean;
  heartbeatSchedulerIntervalMs: number;
  seaclipHome: string;
  jwtSecret: string;
  apiKeyHash: string;
  corsOrigins: string[];
  logLevel: string;
  nodeEnv: string;
}

let _config: Config | null = null;

function parseBool(val: string | undefined, def: boolean): boolean {
  if (val === undefined) return def;
  return val.toLowerCase() === "true" || val === "1";
}

function parseInt10(val: string | undefined, def: number): number {
  if (val === undefined) return def;
  const n = parseInt(val, 10);
  return isNaN(n) ? def : n;
}

function parseList(val: string | undefined, def: string[]): string[] {
  if (!val) return def;
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

export function loadConfig(): Config {
  if (_config) return _config;

  const mode = (process.env.DEPLOYMENT_MODE ?? "local_trusted") as
    | "local_trusted"
    | "authenticated";

  if (mode !== "local_trusted" && mode !== "authenticated") {
    throw new Error(
      `Invalid DEPLOYMENT_MODE "${mode}". Must be "local_trusted" or "authenticated".`,
    );
  }

  _config = {
    deploymentMode: mode,
    host: process.env.HOST ?? "0.0.0.0",
    port: parseInt10(process.env.PORT, 3001),
    databaseUrl:
      process.env.DATABASE_URL ??
      "pglite://.seaclip/data",
    serveUi: parseBool(process.env.SERVE_UI, false),
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
    litellmBaseUrl: process.env.LITELLM_BASE_URL ?? "",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    heartbeatSchedulerEnabled: parseBool(
      process.env.HEARTBEAT_SCHEDULER_ENABLED,
      true,
    ),
    heartbeatSchedulerIntervalMs: parseInt10(
      process.env.HEARTBEAT_SCHEDULER_INTERVAL_MS,
      30_000,
    ),
    seaclipHome:
      process.env.SEACLIP_HOME ??
      `${process.env.HOME ?? "/var/seaclip"}/.seaclip`,
    jwtSecret:
      process.env.JWT_SECRET ?? "change-me-in-production-jwt-secret-32chars",
    apiKeyHash: process.env.API_KEY_HASH ?? "",
    corsOrigins: parseList(
      process.env.CORS_ORIGINS,
      ["http://localhost:3000", "http://localhost:5173"],
    ),
    logLevel: process.env.LOG_LEVEL ?? "info",
    nodeEnv: process.env.NODE_ENV ?? "development",
  };

  return _config;
}

export function getConfig(): Config {
  if (!_config) {
    throw new Error("Config not loaded. Call loadConfig() first.");
  }
  return _config;
}

/** Reset config (useful in tests) */
export function resetConfig(): void {
  _config = null;
}
