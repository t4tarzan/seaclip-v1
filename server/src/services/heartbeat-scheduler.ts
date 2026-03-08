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
 * Tracks the last minute-window (floored to the minute) each agent was invoked,
 * so we don't double-fire within the same cron window.
 */
const _lastInvoked: Map<string, number> = new Map();

// ---------------------------------------------------------------------------
// Cron matching helpers (no external dependency)
// ---------------------------------------------------------------------------

function matchesCronField(field: string, value: number): boolean {
  if (field === "*") return true;

  // Handle step: */N
  if (field.startsWith("*/")) {
    const step = parseInt(field.slice(2), 10);
    return !isNaN(step) && step > 0 && value % step === 0;
  }

  // Handle comma-separated values: 1,5,10
  const parts = field.split(",");
  return parts.some((p) => {
    // Handle range: 1-5
    if (p.includes("-")) {
      const [lo, hi] = p.split("-").map(Number);
      return !isNaN(lo) && !isNaN(hi) && value >= lo && value <= hi;
    }
    return parseInt(p, 10) === value;
  });
}

/**
 * Check whether a standard 5-field cron expression matches the given date.
 * Fields: minute  hour  day-of-month  month  day-of-week
 * Supports: *, specific numbers, step syntax, comma lists, and ranges.
 */
function matchesCron(cronExpr: string, date: Date): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const fields = [
    date.getMinutes(),   // minute 0-59
    date.getHours(),     // hour 0-23
    date.getDate(),      // day of month 1-31
    date.getMonth() + 1, // month 1-12
    date.getDay(),       // day of week 0-6 (0=Sunday)
  ];

  return parts.every((part, i) => matchesCronField(part, fields[i]));
}

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

    const now = new Date();
    // Floor to the current minute so we can deduplicate within the same window
    const minuteTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()).getTime();

    for (const agent of enabledAgents) {
      // --- Per-agent cron gating ---
      if (agent.heartbeatCron) {
        if (!matchesCron(agent.heartbeatCron, now)) {
          logger.debug(
            { agentId: agent.id, agentName: agent.name, heartbeatCron: agent.heartbeatCron },
            "Heartbeat scheduler: cron expression does not match current time — skipping agent",
          );
          continue;
        }

        // Prevent double-fire within the same minute window
        const lastTs = _lastInvoked.get(agent.id);
        if (lastTs === minuteTs) {
          logger.debug(
            { agentId: agent.id, agentName: agent.name },
            "Heartbeat scheduler: agent already invoked in this minute window — skipping",
          );
          continue;
        }
      }

      try {
        const result = await invokeAgent(agent, {
          triggeredBy: "scheduler",
          manual: false,
        });

        // Record invocation time so we don't re-fire in the same minute
        _lastInvoked.set(agent.id, minuteTs);

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
