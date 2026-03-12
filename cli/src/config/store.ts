/**
 * SeaClip Config Store
 * Reads and writes ~/.seaclip/config.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface SeaClipConfig {
  server: {
    host: string;
    port: number;
    deploymentMode: 'local_trusted' | 'authenticated';
  };
  database: {
    mode: 'embedded' | 'postgres';
    connectionString?: string;
  };
  providers: {
    ollama?: {
      baseUrl: string;
    };
    openai?: {
      apiKey: string;
    };
    anthropic?: {
      apiKey: string;
    };
    openrouter?: {
      apiKey: string;
    };
    litellm?: {
      baseUrl: string;
    };
  };
  ollama: {
    baseUrl: string;
  };
  telegram: {
    botToken?: string;
    chatId?: string;
  };
  storage: {
    provider: 'local_disk';
    baseDir: string;
  };
}

export const DEFAULT_CONFIG: SeaClipConfig = {
  server: {
    host: '0.0.0.0',
    port: 3100,
    deploymentMode: 'local_trusted',
  },
  database: {
    mode: 'embedded',
  },
  providers: {},
  ollama: {
    baseUrl: 'http://localhost:11434',
  },
  telegram: {},
  storage: {
    provider: 'local_disk',
    baseDir: join(homedir(), '.seaclip', 'data'),
  },
};

export function getConfigDir(): string {
  return join(homedir(), '.seaclip');
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

export function configExists(): boolean {
  return existsSync(getConfigPath());
}

export function readConfig(): SeaClipConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SeaClipConfig>;
    return deepMerge(DEFAULT_CONFIG, parsed) as SeaClipConfig;
  } catch (err) {
    throw new Error(
      `Failed to read config at ${configPath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function writeConfig(config: SeaClipConfig): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overVal = override[key];
    if (
      overVal !== null &&
      overVal !== undefined &&
      typeof overVal === 'object' &&
      !Array.isArray(overVal) &&
      typeof baseVal === 'object' &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>
      );
    } else if (overVal !== undefined) {
      result[key] = overVal;
    }
  }
  return result;
}
