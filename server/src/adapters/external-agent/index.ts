import type { ServerAdapterModule, AdapterExecuteContext, AdapterExecuteResult, AdapterEnvironmentTestResult } from "../types.js";
import { executeHttp } from "../http/execute.js";
import { getLogger } from "../../middleware/logger.js";
import crypto from "node:crypto";

type Protocol = "https" | "websocket" | "mcp" | "a2a";
type AuthType = "none" | "api-key" | "bearer" | "basic" | "custom";
type MessageFormat = "agent-zero" | "openai" | "anthropic" | "custom";

interface ExternalAgentConfig {
  baseUrl: string;
  protocol?: Protocol;
  authType?: AuthType;
  apiKey?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  customHeaders?: Record<string, string>;
  endpoints?: {
    message?: string;
    websocket?: string;
    health?: string;
  };
  messageFormat?: MessageFormat;
  contextIdField?: string;
  timeoutMs?: number;
  retries?: number;
  validateSsl?: boolean;
  seaclipApiUrl?: string;
}

interface SessionState {
  contextId: string;
  context: Record<string, unknown>;
  encodedAt: string;
}

function encodeSessionState(contextId: string, context: Record<string, unknown>): string {
  const state: SessionState = {
    contextId,
    context,
    encodedAt: new Date().toISOString(),
  };
  return Buffer.from(JSON.stringify(state)).toString("base64");
}

function decodeSessionState(encoded: string | undefined): { contextId: string | null; context: Record<string, unknown> } {
  if (!encoded) return { contextId: null, context: {} };
  try {
    const state = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as SessionState;
    return { contextId: state.contextId, context: state.context };
  } catch {
    return { contextId: null, context: {} };
  }
}

const SEACLIP_SKILL_INJECTION = `
You are operating as part of SeaClip — a hub-spoke AI agent orchestration platform.
Your run ID is: {runId}
Your agent ID is: {agentId}
Company ID: {companyId}

When completing tasks:
1. Check out issues before working on them (POST /api/companies/{companyId}/issues/{id}/checkout)
2. Post progress updates as comments
3. Mark issues as done when complete
4. Create approval requests for actions that require human sign-off

SeaClip API: {seaclipApiUrl}
`.trim();

async function callExternalAgentHttps(
  config: ExternalAgentConfig,
  contextId: string | null,
  task: string,
  ctx: AdapterExecuteContext,
): Promise<{ contextId: string; response: string }> {
  const logger = getLogger();
  const baseUrl = config.baseUrl;
  const messageEndpoint = config.endpoints?.message || "/api/message";
  const url = `${baseUrl}${messageEndpoint}`;
  const messageFormat = config.messageFormat || "agent-zero";
  const contextIdField = config.contextIdField || "context_id";
  const timeoutMs = config.timeoutMs || ctx.timeoutMs;
  const retries = config.retries || 0;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const authType = config.authType || "none";
  switch (authType) {
    case "api-key":
      if (config.apiKey) {
        headers["X-API-KEY"] = config.apiKey;
      }
      break;
    case "bearer":
      if (config.bearerToken) {
        headers["Authorization"] = `Bearer ${config.bearerToken}`;
      }
      break;
    case "basic":
      if (config.username && config.password) {
        const credentials = Buffer.from(`${config.username}:${config.password}`).toString("base64");
        headers["Authorization"] = `Basic ${credentials}`;
      }
      break;
    case "custom":
      if (config.customHeaders) {
        Object.assign(headers, config.customHeaders);
      }
      break;
  }

  let body: Record<string, unknown>;
  
  switch (messageFormat) {
    case "agent-zero":
      body = { message: task };
      if (contextId) {
        body[contextIdField] = contextId;
      }
      break;
    
    case "openai":
      body = {
        messages: [{ role: "user", content: task }],
        model: "external-agent",
      };
      if (contextId) {
        body.conversation_id = contextId;
      }
      break;
    
    case "anthropic":
      body = {
        messages: [{ role: "user", content: task }],
        model: "external-agent",
        max_tokens: 4096,
      };
      if (contextId) {
        body.metadata = { conversation_id: contextId };
      }
      break;
    
    case "custom":
    default:
      body = { task, contextId };
      break;
  }

  logger.debug({ url, messageFormat, authType }, "Calling external agent HTTPS API");

  const result = await executeHttp({
    url,
    method: "POST",
    headers,
    body: JSON.stringify(body),
    timeoutMs,
    retries,
  });

  if (result.statusCode >= 400) {
    throw new Error(`External agent API returned HTTP ${result.statusCode}: ${result.body}`);
  }

  const responseData = JSON.parse(result.body) as Record<string, unknown>;
  let newContextId = contextId || crypto.randomUUID();
  let response = "";

  switch (messageFormat) {
    case "agent-zero":
      newContextId = (responseData[contextIdField] as string) || newContextId;
      response = (responseData.response as string) || "";
      break;
    
    case "openai":
      if (responseData.choices && Array.isArray(responseData.choices) && responseData.choices.length > 0) {
        const choice = responseData.choices[0] as Record<string, unknown>;
        const message = choice.message as Record<string, unknown>;
        response = (message.content as string) || "";
      }
      if (responseData.id) {
        newContextId = responseData.id as string;
      }
      break;
    
    case "anthropic":
      if (responseData.content && Array.isArray(responseData.content) && responseData.content.length > 0) {
        const content = responseData.content[0] as Record<string, unknown>;
        response = (content.text as string) || "";
      }
      if (responseData.id) {
        newContextId = responseData.id as string;
      }
      break;
    
    case "custom":
    default:
      response = (responseData.output as string) || (responseData.response as string) || JSON.stringify(responseData);
      newContextId = (responseData.contextId as string) || (responseData.session_id as string) || newContextId;
      break;
  }

  return { contextId: newContextId, response };
}

export const externalAgentAdapter: ServerAdapterModule = {
  type: "external_agent",
  label: "External Agent",
  description: "Connect to any external autonomous AI agent via HTTPS, WebSocket, MCP, or A2A protocols",

  agentConfigurationDoc: `
# External Agent Adapter

Connect to any external autonomous AI agent that lives outside SeaClip.

## Supported Protocols
- **HTTPS/REST** - Standard HTTP API calls
- **WebSocket** - Real-time bidirectional communication (coming soon)
- **MCP** - Model Context Protocol (coming soon)
- **A2A** - Agent-to-Agent protocol (coming soon)

## Configuration

### Required Fields
- \`baseUrl\` - Agent endpoint URL (e.g., "http://187.77.185.88:50001")
- \`protocol\` - Communication protocol (default: "https")

### Authentication
- \`authType\` - Authentication method: "none", "api-key", "bearer", "basic", "custom"
- \`apiKey\` - API key for api-key authentication
- \`bearerToken\` - Token for bearer authentication
- \`username\` + \`password\` - Credentials for basic authentication
- \`customHeaders\` - Custom headers for custom authentication

### Endpoints (Optional)
- \`endpoints.message\` - Message endpoint path (default: "/api/message")
- \`endpoints.health\` - Health check endpoint (default: "/health")

### Message Format
- \`messageFormat\` - Format: "agent-zero", "openai", "anthropic", "custom"
- \`contextIdField\` - Context ID field name (default: "context_id")

### Advanced
- \`timeoutMs\` - Request timeout in milliseconds
- \`retries\` - Number of retries on failure
- \`seaclipApiUrl\` - SeaClip API URL for agent callbacks

## Example: Agent Zero

\`\`\`json
{
  "baseUrl": "http://187.77.185.88:50001",
  "protocol": "https",
  "authType": "api-key",
  "apiKey": "your-api-key",
  "endpoints": {
    "message": "/api_message"
  },
  "messageFormat": "agent-zero",
  "contextIdField": "context_id"
}
\`\`\`

## Example: OpenAI-Compatible Agent

\`\`\`json
{
  "baseUrl": "https://agent.example.com",
  "protocol": "https",
  "authType": "bearer",
  "bearerToken": "your-bearer-token",
  "endpoints": {
    "message": "/v1/chat/completions"
  },
  "messageFormat": "openai"
}
\`\`\`

## Example: Custom Agent

\`\`\`json
{
  "baseUrl": "https://custom-agent.example.com",
  "protocol": "https",
  "authType": "custom",
  "customHeaders": {
    "X-Custom-Auth": "your-auth-value"
  },
  "endpoints": {
    "message": "/api/execute"
  },
  "messageFormat": "custom"
}
\`\`\`
  `.trim(),

  async execute(ctx: AdapterExecuteContext): Promise<AdapterExecuteResult> {
    const config = ctx.adapterConfig as Partial<ExternalAgentConfig>;
    
    if (!config.baseUrl) {
      throw new Error("baseUrl is required in adapterConfig");
    }

    const protocol = config.protocol || "https";
    
    if (protocol !== "https") {
      throw new Error(`Protocol "${protocol}" is not yet supported. Currently only "https" is available.`);
    }

    let contextId: string | null = null;
    if (ctx.context.sessionState && typeof ctx.context.sessionState === "string") {
      const decoded = decodeSessionState(ctx.context.sessionState);
      contextId = decoded.contextId;
    }

    const seaclipApiUrl = config.seaclipApiUrl || process.env.SEACLIP_API_URL || "http://localhost:3001";
    
    const skillPrompt = SEACLIP_SKILL_INJECTION
      .replace("{runId}", ctx.runId)
      .replace("{agentId}", ctx.agentId)
      .replace("{companyId}", ctx.companyId)
      .replace("{companyId}", ctx.companyId)
      .replace("{seaclipApiUrl}", seaclipApiUrl);

    const taskDescription = ctx.systemPrompt
      ? `${skillPrompt}\n\n${ctx.systemPrompt}\n\nTask: ${JSON.stringify(ctx.context)}`
      : `${skillPrompt}\n\nTask: ${JSON.stringify(ctx.context)}`;

    const result = await callExternalAgentHttps(config as ExternalAgentConfig, contextId, taskDescription, ctx);
    
    const newContextId = result.contextId;
    const sessionState = encodeSessionState(newContextId, ctx.context);
    const output = result.response || "External agent completed task with no output";

    return {
      output,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      metadata: {
        contextId: newContextId,
        sessionState,
        protocol,
        messageFormat: config.messageFormat || "agent-zero",
      },
    };
  },

  async testEnvironment(config: Record<string, unknown>): Promise<AdapterEnvironmentTestResult> {
    const externalConfig = config as Partial<ExternalAgentConfig>;
    
    if (!externalConfig.baseUrl) {
      return {
        ok: false,
        message: "baseUrl is required",
      };
    }

    const protocol = externalConfig.protocol || "https";
    
    if (protocol !== "https") {
      return {
        ok: false,
        message: `Protocol "${protocol}" is not yet supported`,
      };
    }

    const healthEndpoint = externalConfig.endpoints?.health || "/health";
    const url = `${externalConfig.baseUrl}${healthEndpoint}`;

    try {
      const headers: Record<string, string> = {};
      
      const authType = externalConfig.authType || "none";
      if (authType === "api-key" && externalConfig.apiKey) {
        headers["X-API-KEY"] = externalConfig.apiKey;
      } else if (authType === "bearer" && externalConfig.bearerToken) {
        headers["Authorization"] = `Bearer ${externalConfig.bearerToken}`;
      } else if (authType === "basic" && externalConfig.username && externalConfig.password) {
        const credentials = Buffer.from(`${externalConfig.username}:${externalConfig.password}`).toString("base64");
        headers["Authorization"] = `Basic ${credentials}`;
      } else if (authType === "custom" && externalConfig.customHeaders) {
        Object.assign(headers, externalConfig.customHeaders);
      }

      const result = await executeHttp({
        url,
        method: "GET",
        headers,
        timeoutMs: 10000,
        retries: 0,
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return {
          ok: true,
          message: `External agent is reachable at ${externalConfig.baseUrl}`,
        };
      } else if (result.statusCode === 404) {
        return {
          ok: true,
          message: `External agent base URL is reachable (health endpoint not found, but that's OK)`,
        };
      } else {
        return {
          ok: false,
          message: `External agent returned HTTP ${result.statusCode}`,
        };
      }
    } catch (error) {
      return {
        ok: false,
        message: `Failed to connect to external agent: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
