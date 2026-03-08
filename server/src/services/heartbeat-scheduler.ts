/**
 * heartbeat-scheduler — periodic scheduler that invokes heartbeat-enabled agents.
 *
 * Usage:
 *   startHeartbeatScheduler(30_000);  // tick every 30 seconds
 *   stopHeartbeatScheduler();
 *
 * On each tick:
 *   1. List all companies.
 *   2. For each company, list all agents where heartbeatEnabled === true.
 *   3. Invoke each agent via invokeAgent() from the heartbeat service.
 *   4. Log results and errors — never let a single agent failure abort the tick.
 */
import { getLogger } from "../middleware/logger.js";
import { listCompanies } from "./companies.js";
import { listAgents } from "./agents.js";
import { invokeAgent } from "./heartbeat.js";

let _timer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the heartbeat scheduler with the given interval in milliseconds.
 * Calling this while already running is a no-op (logs a warning).
 */
export function startHeartbeatScheduler(intervalMs: number): void {
  const logger = getLogger();

  if (_timer !== null) {
    logger.warn({ intervalMs }, "Heartbeat scheduler already running — ignoring startHeartbeatScheduler call");
    return;
  }

  logger.info({ intervalMs }, "Starting heartbeat scheduler");

  _timer = setInterval(() => {
    void runTick();
  }, intervalMs);
}

/**
 * Stop the heartbeat scheduler. Safe to call even if not running.
 */
export function stopHeartbeatScheduler(): void {
  const logger = getLogger();

  if (_timer === null) {
    logger.warn("Heartbeat scheduler is not running — ignoring stopHeartbeatScheduler call");
    return;
  }

  clearInterval(_timer);
  _timer = null;
  logger.info("Heartbeat scheduler stopped");
}

// ---------------------------------------------------------------------------
// Internal tick logic
// ---------------------------------------------------------------------------

async function runTick(): Promise<void> {
  const logger = getLogger();
  const tickStart = Date.now();

  logger.info({ tickAt: new Date().toISOString() }, "Heartbeat scheduler tick starting");

  let companies: Awaited<ReturnType<typeof listCompanies>>;
  try {
    companies = await listCompanies();
  } catch (err) {
    logger.error({ err }, "Heartbeat scheduler: failed to list companies — skipping tick");
    return;
  }

  let totalInvoked = 0;
  let totalErrors = 0;

  for (const company of companies) {
    let agents: Awaited<ReturnType<typeof listAgents>>;
    try {
      agents = await listAgents(company.id);
    } catch (err) {
      logger.error({ err, companyId: company.id }, "Heartbeat scheduler: failed to list agents for company");
      continue;
    }

    const enabledAgents = agents.filter((a) => a.heartbeatEnabled);

    if (enabledAgents.length === 0) {
      continue;
    }

    logger.debug(
      { companyId: company.id, enabledCount: enabledAgents.length },
      "Heartbeat scheduler: invoking enabled agents",
    );

    for (const agent of enabledAgents) {
      try {
        const result = await invokeAgent(agent, {
          triggeredBy: "scheduler",
          manual: false,
        });

        totalInvoked++;
        logger.info(
          {
            agentId: agent.id,
            agentName: agent.name,
            companyId: company.id,
            runId: result.runId,
            success: result.success,
            durationMs: result.durationMs,
            costUsd: result.costUsd,
          },
          "Heartbeat scheduler: agent invocation completed",
        );
      } catch (err) {
        totalErrors++;
        logger.error(
          { err, agentId: agent.id, agentName: agent.name, companyId: company.id },
          "Heartbeat scheduler: agent invocation threw unexpectedly",
        );
      }
    }
  }

  const tickDurationMs = Date.now() - tickStart;
  logger.info(
    {
      tickDurationMs,
      totalCompanies: companies.length,
      totalInvoked,
      totalErrors,
    },
    "Heartbeat scheduler tick completed",
  );
}
