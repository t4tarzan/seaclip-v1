/**
 * github-poller — periodic poller for connected GitHub repos.
 *
 * Usage:
 *   startGithubPoller();   // begins polling at configured interval
 *   stopGithubPoller();    // clears the interval
 *
 * Pattern mirrors heartbeat-scheduler.ts.
 * Default interval: 5 minutes (configurable via GITHUB_POLLER_INTERVAL_MS).
 */
import { getLogger } from "../middleware/logger.js";
import { getDb } from "../db.js";
import { githubRepos } from "@seaclip/db";
import { syncIssue } from "./github-bridge.js";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _timer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the GitHub poller.
 * Calling while already running is a no-op (logs a warning).
 */
export function startGithubPoller(
  intervalMs: number = DEFAULT_INTERVAL_MS,
): void {
  const logger = getLogger();

  if (_timer !== null) {
    logger.warn({ intervalMs }, "GitHub poller already running — ignoring startGithubPoller call");
    return;
  }

  logger.info({ intervalMs }, "Starting GitHub poller");

  _timer = setInterval(() => {
    void runPollTick();
  }, intervalMs);
}

/**
 * Stop the GitHub poller. Safe to call even if not running.
 */
export function stopGithubPoller(): void {
  const logger = getLogger();

  if (_timer === null) {
    logger.warn("GitHub poller is not running — ignoring stopGithubPoller call");
    return;
  }

  clearInterval(_timer);
  _timer = null;
  logger.info("GitHub poller stopped");
}

// ---------------------------------------------------------------------------
// Internal poll tick
// ---------------------------------------------------------------------------

async function runPollTick(): Promise<void> {
  const logger = getLogger();
  const tickStart = Date.now();

  logger.info({ tickAt: new Date().toISOString() }, "GitHub poller tick starting");

  let repos: (typeof githubRepos.$inferSelect)[];
  try {
    const db = getDb();
    repos = await db.select().from(githubRepos);
  } catch (err) {
    logger.error({ err }, "GitHub poller: failed to list connected repos — skipping tick");
    return;
  }

  if (repos.length === 0) {
    logger.debug("GitHub poller: no connected repos — skipping tick");
    return;
  }

  let synced = 0;
  let errors = 0;

  for (const repo of repos) {
    try {
      // Sync the most recent issue (issue #1 as a lightweight connectivity check)
      // In a real scenario this would fetch events since last poll
      await syncIssue(repo.repoFullName, 1);
      synced++;
    } catch (err) {
      errors++;
      logger.warn(
        { err, repoFullName: repo.repoFullName },
        "GitHub poller: failed to sync repo — continuing",
      );
    }
  }

  const tickDurationMs = Date.now() - tickStart;
  logger.info(
    { tickDurationMs, totalRepos: repos.length, synced, errors },
    "GitHub poller tick completed",
  );
}
