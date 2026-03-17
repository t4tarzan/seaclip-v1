/**
 * github-poller — periodic poller for connected GitHub repos.
 *
 * Each tick polls comments for all issues linked to a GitHub repo.
 * INVARIANT: lastCommentCheckAt is ALWAYS stamped after every comment poll,
 * even when zero new comments are found. This prevents the next tick from
 * fetching all comment history when `since` is undefined.
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
import { eq, isNotNull, and } from "drizzle-orm";
import { githubRepos, issues as issuesTable } from "@seaclip/db";
import { getCommentsSince } from "./github-bridge.js";
import { issuesService, approvalsService } from "./index.js";

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

  const db = getDb();

  // Find all issues that have a linked GitHub issue number
  let linkedIssues: (typeof issuesTable.$inferSelect)[];
  try {
    linkedIssues = await db
      .select()
      .from(issuesTable)
      .where(isNotNull(issuesTable.githubIssueId));
  } catch (err) {
    logger.error({ err }, "GitHub poller: failed to list linked issues — skipping tick");
    return;
  }

  if (linkedIssues.length === 0) {
    logger.debug("GitHub poller: no GitHub-linked issues — skipping tick");
    return;
  }

  // Load all connected repos to build a lookup by id
  let repoMap: Map<string, typeof githubRepos.$inferSelect>;
  try {
    const repos = await db.select().from(githubRepos);
    repoMap = new Map(repos.map((r) => [r.id, r]));
  } catch (err) {
    logger.error({ err }, "GitHub poller: failed to list connected repos — skipping tick");
    return;
  }

  let stamped = 0;
  let errors = 0;

  for (const issue of linkedIssues) {
    if (!issue.githubIssueId || !issue.githubRepoId) {
      continue;
    }

    const repo = repoMap.get(issue.githubRepoId);
    if (!repo) {
      logger.warn(
        { issueId: issue.id, githubRepoId: issue.githubRepoId },
        "GitHub poller: no connected repo found for issue — skipping",
      );
      continue;
    }

    const githubIssueNumber = issue.githubIssueId;
    const liveMeta = (issue.metadata as Record<string, unknown>) ?? {};
    const lastCheckedAt = liveMeta.lastCommentCheckAt as string | undefined;

    let newComments: Awaited<ReturnType<typeof getCommentsSince>>;
    try {
      newComments = await getCommentsSince(
        repo.repoFullName,
        githubIssueNumber,
        lastCheckedAt,
      );
    } catch (err: unknown) {
      // On rate-limit (403/429) or other GitHub error: log and skip stamping.
      // Do NOT stamp — next tick will retry the same window.
      const msg = (err as { message?: string }).message ?? "";
      const status = msg.match(/GitHub API error (\d+)/)?.[1];
      if (status === "403" || status === "429") {
        logger.warn(
          { err, repoFullName: repo.repoFullName, issueId: issue.id, status },
          "GitHub poller: rate limited — skipping stamp for this issue",
        );
      } else {
        logger.error(
          { err, repoFullName: repo.repoFullName, issueId: issue.id },
          "GitHub poller: failed to fetch comments — skipping stamp for this issue",
        );
      }
      errors++;
      continue;
    }

    // Import any new comments into the local DB
    for (const comment of newComments) {
      try {
        await issuesService.addComment(repo.companyId, issue.id, {
          body: comment.body,
          authorId: comment.user?.login,
          authorType: "human",
        });
      } catch (err) {
        logger.warn(
          { err, commentId: comment.id, issueId: issue.id },
          "GitHub poller: failed to save comment — continuing",
        );
      }
    }

    // ALWAYS stamp lastCommentCheckAt — even if zero new comments found.
    // This is the core invariant: prevents the next tick calling getCommentsSince(undefined).
    const updatedMeta: Record<string, unknown> = {
      ...liveMeta,
      lastCommentCheckAt: new Date().toISOString(),
    };

    try {
      await issuesService.updateIssue(repo.companyId, issue.id, {
        metadata: updatedMeta,
      });
      stamped++;
    } catch (err) {
      logger.error(
        { err, issueId: issue.id },
        "GitHub poller: failed to stamp lastCommentCheckAt",
      );
      errors++;
    }
  }

  const tickDurationMs = Date.now() - tickStart;
  logger.info(
    { tickDurationMs, totalIssues: linkedIssues.length, stamped, errors },
    "GitHub poller tick completed",
  );
}
