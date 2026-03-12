/**
 * Agent Zero adapter.
 *
 * Starts an Agent Zero session via its HTTP API or spawns the process.
 * Injects SeaClip skill for task management. Captures conversation
 * output and tool calls.
 */
import type {
  ServerAdapterModule,
  AdapterExecuteContext,
  AdapterExecuteResult,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { executeHttp } from "../http/execute.js";
import { spawnProcess } from "../process/execute.js";
import { getLogger } from "../../middleware/logger.js";
import WebSocket from "ws";

// Agent Zero skill injection for SeaClip task management
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

interface AgentZeroApiResponse {
  context_id: string;
  response: string;
}

interface AgentZeroWebSocketMessage {
  type: string;
  content?: string;
  data?: unknown;
  context_id?: string;
}

async function callAgentZeroWebSocket(
  baseUrl: string,
  contextId: string | null,
  task: string,
  apiKey: string | undefined,
  timeoutMs: number,
): Promise<AgentZeroApiResponse> {
  const logger = getLogger();
  const wsUrl = baseUrl.replace(/^http/, "ws") + "/ws";

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Agent Zero WebSocket timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    let responseText = "";
    let newContextId = contextId || crypto.randomUUID();

    const ws = new WebSocket(wsUrl, {
      headers: apiKey ? { "X-API-KEY": apiKey } : {},
    });

    ws.on("open", () => {
      logger.debug({ wsUrl }, "WebSocket connected to Agent Zero");
      
      const message = {
        type: "message",
        content: task,
        context_id: contextId,
      };
      
      ws.send(JSON.stringify(message));
    });

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString()) as AgentZeroWebSocketMessage;
        
        logger.debug({ type: msg.type }, "Received WebSocket message from Agent Zero");

        if (msg.type === "response" || msg.type === "message") {
          if (msg.content) {
            responseText += msg.content;
          }
          if (msg.context_id) {
            newContextId = msg.context_id;
          }
        }
        
        if (msg.type === "done" || msg.type === "complete") {
          clearTimeout(timeout);
          ws.close();
          resolve({
            context_id: newContextId,
            response: responseText || "Agent Zero completed task",
          });
        }
      } catch (err) {
        logger.error({ error: err }, "Failed to parse WebSocket message");
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timeout);
      logger.error({ error }, "WebSocket error");
      reject(new Error(`Agent Zero WebSocket error: ${error.message}`));
    });

    ws.on("close", () => {
      clearTimeout(timeout);
      if (responseText) {
        resolve({
          context_id: newContextId,
          response: responseText,
        });
      }
    });
  });
}

async function callAgentZeroApi(
  baseUrl: string,
  contextId: string | null,
  task: string,
  apiKey: string | undefined,
  timeoutMs: number,
): Promise<AgentZeroApiResponse> {
  const url = `${baseUrl}/api_message`;

  const body: Record<string, unknown> = {
    message: task,
  };

  if (contextId) {
    body.context_id = contextId;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["X-API-KEY"] = apiKey;
  }

  const result = await executeHttp({
    url,
    method: "POST",
    headers,
    body: JSON.stringify(body),
    timeoutMs,
    retries: 0,
  });

  if (result.statusCode >= 400) {
    throw new Error(`Agent Zero API returned HTTP ${result.statusCode}: ${result.body}`);
  }

  return JSON.parse(result.body) as AgentZeroApiResponse;
}

// Session codec for persisting Agent Zero state across heartbeats
export function encodeSessionState(sessionId: string, context: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify({ sessionId, context, encodedAt: new Date().toISOString() })).toString("base64");
}

export function decodeSessionState(encoded: string): { sessionId: string; context: Record<string, unknown>; encodedAt: string } | null {
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
      sessionId: string;
      context: Record<string, unknown>;
      encodedAt: string;
    };
  } catch {
    return null;
  }
}

export const agentZeroAdapter: ServerAdapterModule = {
  type: "agent_zero",
  label: "Agent Zero",
  description: "Executes tasks using an Agent Zero instance with SeaClip skill injection.",

  async execute(ctx: AdapterExecuteContext): Promise<AdapterExecuteResult> {
    const logger = getLogger();
    const baseUrl = ctx.adapterConfig.agentZeroUrl as string | undefined;
    const apiKey = ctx.adapterConfig.apiKey as string | undefined;
    const useWebSocket = (ctx.adapterConfig.useWebSocket as boolean | undefined) ?? true;
    const useProcess = ctx.adapterConfig.useProcess as boolean | undefined;
    const agentZeroPath = ctx.adapterConfig.agentZeroPath as string | undefined;
    const seaclipApiUrl = (ctx.adapterConfig.seaclipApiUrl as string | undefined) ?? "http://localhost:3001";

    // Build the task prompt with SeaClip skill injection
    const skillPrompt = SEACLIP_SKILL_INJECTION
      .replace("{runId}", ctx.runId)
      .replace("{agentId}", ctx.agentId)
      .replace("{companyId}", ctx.companyId)
      .replace("{companyId}", ctx.companyId)
      .replace("{seaclipApiUrl}", seaclipApiUrl);

    const fullTask = ctx.systemPrompt
      ? `${skillPrompt}\n\n${ctx.systemPrompt}\n\nTask: ${JSON.stringify(ctx.context)}`
      : `${skillPrompt}\n\nTask: ${JSON.stringify(ctx.context)}`;

    // Restore previous context if state is encoded in context
    let contextId: string | null = null;
    if (ctx.context.sessionState && typeof ctx.context.sessionState === "string") {
      const decoded = decodeSessionState(ctx.context.sessionState);
      if (decoded) {
        contextId = decoded.sessionId;
        logger.debug({ contextId, agentId: ctx.agentId }, "Restored Agent Zero context");
      }
    }

    if (baseUrl && !useProcess) {
      // Use Agent Zero WebSocket or HTTP API
      let response: AgentZeroApiResponse;
      
      if (useWebSocket) {
        logger.debug({ baseUrl }, "Using WebSocket connection to Agent Zero");
        response = await callAgentZeroWebSocket(baseUrl, contextId, fullTask, apiKey, ctx.timeoutMs);
      } else {
        logger.debug({ baseUrl }, "Using HTTP API connection to Agent Zero");
        response = await callAgentZeroApi(baseUrl, contextId, fullTask, apiKey, ctx.timeoutMs);
      }

      const newContextId = response.context_id;
      const sessionState = encodeSessionState(newContextId, ctx.context);

      const output = response.response || "Agent Zero completed task with no output";

      return {
        output,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        metadata: {
          contextId: newContextId,
          sessionState,
        },
      };
    } else if (useProcess && agentZeroPath) {
      // Spawn Agent Zero as a subprocess
      const result = await spawnProcess({
        command: `python ${agentZeroPath}/run_ui.py --task "${fullTask.replace(/"/g, '\\"')}" --no-ui`,
        shell: "/bin/sh",
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][],
          ),
          SEACLIP_AGENT_ID: ctx.agentId,
          SEACLIP_RUN_ID: ctx.runId,
        },
        timeoutMs: ctx.timeoutMs,
      });

      return {
        output: result.stdout,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        metadata: {
          exitCode: result.exitCode,
          stderr: result.stderr,
          durationMs: result.durationMs,
        },
      };
    } else {
      throw new Error(
        "agentZeroAdapter: either adapterConfig.agentZeroUrl or (useProcess=true + agentZeroPath) is required",
      );
    }
  },

  async testEnvironment(
    config: Record<string, unknown>,
  ): Promise<AdapterEnvironmentTestResult> {
    const baseUrl = config.agentZeroUrl as string | undefined;
    const useProcess = config.useProcess as boolean | undefined;
    const agentZeroPath = config.agentZeroPath as string | undefined;

    if (baseUrl) {
      try {
        const result = await executeHttp({
          url: `${baseUrl}/api/health`,
          method: "GET",
          timeoutMs: 5000,
          retries: 0,
        });
        return {
          ok: result.statusCode < 400,
          message: result.statusCode < 400 ? "Agent Zero API is reachable" : `HTTP ${result.statusCode}`,
          details: { baseUrl, statusCode: result.statusCode },
        };
      } catch (err) {
        return {
          ok: false,
          message: `Cannot reach Agent Zero at ${baseUrl}: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
      }
    }

    if (useProcess && agentZeroPath) {
      try {
        const result = await spawnProcess({
          command: `test -f ${agentZeroPath}/run_ui.py && echo "found"`,
          timeoutMs: 5000,
        });
        return {
          ok: result.stdout.includes("found"),
          message: result.stdout.includes("found")
            ? "Agent Zero installation found"
            : `run_ui.py not found at ${agentZeroPath}`,
        };
      } catch (err) {
        return { ok: false, message: String(err) };
      }
    }

    return {
      ok: false,
      message: "Either agentZeroUrl or (useProcess=true + agentZeroPath) must be configured",
    };
  },

  agentConfigurationDoc: `
## Agent Zero Adapter Configuration

| Field          | Type    | Required | Description                                         |
|----------------|---------|----------|-----------------------------------------------------|
| agentZeroUrl   | string  | *        | HTTP/WebSocket URL of a running Agent Zero instance |
| apiKey         | string  | **       | API key for Agent Zero authentication (X-API-KEY header) |
| useWebSocket   | boolean | No       | Use WebSocket connection (default: true)            |
| useProcess     | boolean | *        | Set to true to spawn Agent Zero as a subprocess     |
| agentZeroPath  | string  | ***      | Path to Agent Zero installation (required with useProcess) |
| seaclipApiUrl  | string  | No       | SeaClip server URL injected into agent context      |

\* Either \`agentZeroUrl\` or (\`useProcess=true\` + \`agentZeroPath\`) is required.
\*\* Required when using \`agentZeroUrl\` (Agent Zero's mcp_server_token from settings).
\*\*\* Required when \`useProcess=true\`.

### Connection Methods

- **WebSocket (default)**: Real-time bidirectional communication with streaming responses
- **HTTP API**: Fallback synchronous REST API (set useWebSocket: false)
- **Process**: Local subprocess execution (set useProcess: true)

### SeaClip Skill

The adapter automatically injects a SeaClip skill context that tells the agent how to:
- Check out issues before working on them
- Post progress as comments
- Create approval requests for sensitive actions
`.trim(),
};
