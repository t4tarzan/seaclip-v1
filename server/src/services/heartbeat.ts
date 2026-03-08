/**
 * heartbeat service — core heartbeat engine.
 * Invokes an agent by looking up its adapter, building execution context,
 * calling adapter.execute(), and recording the run result.
 */
import { getServerAdapter } from "../adapters/registry.js";
import * as agentsService from "./agents.js";
import { insertActivity } from "./activity-log.js";
import { getLogger } from "../middleware/logger.js";
import type { Agent } from "./agents.js";

export interface HeartbeatContext {
  triggeredBy: string;
  manual: boolean;
  context?: Record<string, unknown>;
}

export interface RunResult {
  agentId: string;
  companyId: string;
  runId: string;
  success: boolean;
  output?: string;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string;
  adapterType: string;
  metadata: Record<string, unknown>;
}

/**
 * Check whether an HTTP adapter URL targets an external (non-local) host.
 * Returns true when the URL points outside localhost / private-network ranges.
 */
function isExternalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("100.") // Tailscale CGNAT range
    ) {
      return false;
    }
    // Also allow 172.16-31.x.x private range
    if (hostname.startsWith("172.")) {
      const second = parseInt(hostname.split(".")[1], 10);
      if (second >= 16 && second <= 31) return false;
    }
    return true;
  } catch {
    // If the URL cannot be parsed, treat it as external to be safe
    return true;
  }
}

export async function invokeAgent(
  agent: Agent,
  heartbeatCtx: HeartbeatContext,
): Promise<RunResult> {
  const logger = getLogger();
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const runId = crypto.randomUUID();

  // ── Environment routing guard ──────────────────────────────────────
  // If the agent is tagged "local", block invocations that would route
  // data through an external HTTP endpoint.
  if (agent.environment === "local" && agent.adapterType === "http") {
    const url = (agent.adapterConfig as Record<string, unknown>)?.url;
    if (typeof url === "string" && isExternalUrl(url)) {
      logger.warn(
        {
          agentId: agent.id,
          agentName: agent.name,
          adapterType: agent.adapterType,
          environment: agent.environment,
          url,
        },
        "Skipping invocation: local-environment agent would route to external URL",
      );
      return {
        agentId: agent.id,
        companyId: agent.companyId,
        runId,
        success: false,
        error:
          "Routing blocked: agent is tagged as 'local' but adapter targets an external URL. " +
          "Change the agent environment to 'cloud' or use a local endpoint.",
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        durationMs: 0,
        triggeredBy: heartbeatCtx.triggeredBy,
        startedAt,
        finishedAt: startedAt,
        adapterType: agent.adapterType,
        metadata: {},
      };
    }
  }

  logger.info(
    {
      agentId: agent.id,
      agentName: agent.name,
      adapterType: agent.adapterType,
      triggeredBy: heartbeatCtx.triggeredBy,
      manual: heartbeatCtx.manual,
    },
    "Invoking agent heartbeat",
  );

  // Mark agent as active
  await agentsService.setAgentStatus(agent.companyId, agent.id, "active");

  let result: RunResult;

  try {
    const adapter = getServerAdapter(agent.adapterType);

    const execContext = {
      agentId: agent.id,
      companyId: agent.companyId,
      runId,
      adapterConfig: agent.adapterConfig,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      timeoutMs: agent.timeoutMs,
      triggeredBy: heartbeatCtx.triggeredBy,
      manual: heartbeatCtx.manual,
      context: heartbeatCtx.context ?? {},
    };

    const adapterResult = await adapter.execute(execContext);

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;

    result = {
      agentId: agent.id,
      companyId: agent.companyId,
      runId,
      success: true,
      output: adapterResult.output,
      inputTokens: adapterResult.inputTokens ?? 0,
      outputTokens: adapterResult.outputTokens ?? 0,
      costUsd: adapterResult.costUsd ?? 0,
      durationMs,
      triggeredBy: heartbeatCtx.triggeredBy,
      startedAt,
      finishedAt,
      adapterType: agent.adapterType,
      metadata: adapterResult.metadata ?? {},
    };

    await agentsService.recordHeartbeat(agent.id, result.costUsd);

    logger.info(
      {
        agentId: agent.id,
        runId,
        durationMs,
        costUsd: result.costUsd,
      },
      "Agent heartbeat succeeded",
    );
  } catch (err) {
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;
    const errorMessage = err instanceof Error ? err.message : String(err);

    logger.error(
      { agentId: agent.id, runId, err, durationMs },
      "Agent heartbeat failed",
    );

    await agentsService.setAgentStatus(agent.companyId, agent.id, "error");

    result = {
      agentId: agent.id,
      companyId: agent.companyId,
      runId,
      success: false,
      error: errorMessage,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs,
      triggeredBy: heartbeatCtx.triggeredBy,
      startedAt,
      finishedAt,
      adapterType: agent.adapterType,
      metadata: {},
    };
  }

  // Log activity
  await insertActivity({
    companyId: agent.companyId,
    eventType: result.success ? "agent.heartbeat.success" : "agent.heartbeat.failure",
    agentId: agent.id,
    actorId: agent.id,
    actorType: "agent",
    summary: result.success
      ? `Agent "${agent.name}" heartbeat completed in ${result.durationMs}ms`
      : `Agent "${agent.name}" heartbeat failed: ${result.error}`,
    payload: {
      runId,
      durationMs: result.durationMs,
      costUsd: result.costUsd,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      triggeredBy: heartbeatCtx.triggeredBy,
      manual: heartbeatCtx.manual,
    },
  });

  return result;
}
