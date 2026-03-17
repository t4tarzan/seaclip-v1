/**
 * github-poller — periodically checks GitHub for pipeline progress and
 * updates SeaClip issues accordingly (status, comments, activity).
 */
import { getDb } from "../db.js";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { issues as issuesTable, agents as agentsTable } from "@seaclip/db";
import { getConfig } from "../config.js";
import { getLogger } from "../middleware/logger.js";
import * as bridge from "./github-bridge.js";
import * as issuesService from "./issues.js";
import * as approvalsService from "./approvals.js";
import { insertActivity } from "./activity-log.js";
import { publishLiveEvent } from "./live-events.js";

/**
 * Maps a pipeline stage (label that just appeared) to which agent is NOW
 * active and which one just finished.
 *
 * Stage labels represent output of the previous agent:
 *   "plan"       → Charlie starts (plan label triggers Charlie)
 *   "researched" → Charlie done,  Peter now active
 *   "planned"    → Peter done,    David now active
 *   "coded"      → David done,    Tina  now active
 *   "tested"     → Tina done,     Suzy  now active
 *   "reviewed"   → Suzy done,     Matthews now active
 *   (closed)     → Matthews done
 */
const STAGE_TO_ACTIVE_ROLE: Record<string, { activeRole: string; finishedRole?: string }> = {
  plan:       { activeRole: "research" },
  researched: { activeRole: "architect",  finishedRole: "research" },
  planned:    { activeRole: "developer",  finishedRole: "architect" },
  coded:      { activeRole: "tester",     finishedRole: "developer" },
  tested:     { activeRole: "reviewer",   finishedRole: "tester" },
  reviewed:   { activeRole: "release",    finishedRole: "reviewer" },
  completed:  { activeRole: "",           finishedRole: "release" },
};

async function updateAgentStatuses(
  companyId: string,
  stage: string,
  issueId: string,
  issueTitle: string,
): Promise<void> {
  const mapping = STAGE_TO_ACTIVE_ROLE[stage];
  if (!mapping) return;

  const db = getDb();

  // Find agents with matching pipelineRole in metadata
  const allAgents = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.companyId, companyId));

  for (const agent of allAgents) {
    const meta = (agent.metadata as Record<string, unknown>) ?? {};
    const role = meta.pipelineRole as string | undefined;
    if (!role) continue;

    if (role === mapping.activeRole) {
      // Mark as active + record what it's working on
      await db.update(agentsTable).set({
        status: "active",
        metadata: {
          ...meta,
          currentIssueId: issueId,
          currentIssueTitle: issueTitle,
          activeAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      }).where(eq(agentsTable.id, agent.id));

      log().info({ agentId: agent.id, agentName: agent.name, stage }, "Agent now active");
    } else if (role === mapping.finishedRole) {
      // Mark as idle + record completion
      await db.update(agentsTable).set({
        status: "idle",
        metadata: {
          ...meta,
          currentIssueId: null,
          currentIssueTitle: null,
          lastCompletedAt: new Date().toISOString(),
          lastCompletedIssueId: issueId,
          lastCompletedIssueTitle: issueTitle,
        },
        updatedAt: new Date(),
      }).where(eq(agentsTable.id, agent.id));

      log().info({ agentId: agent.id, agentName: agent.name, stage }, "Agent finished");
    }
  }

  // Publish live event so the dashboard updates instantly
  await publishLiveEvent(companyId, {
    type: "agent.status_changed",
    stage,
    activeRole: mapping.activeRole,
    finishedRole: mapping.finishedRole,
  });
}

function log() {
  return getLogger().child({ service: "github-poller" });
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startGitHubPoller(): void {
  const { githubPollIntervalMs, githubToken } = getConfig();
  if (!githubToken) {
    log().warn("GITHUB_TOKEN not set — GitHub poller disabled");
    return;
  }

  log().info({ intervalMs: githubPollIntervalMs }, "Starting GitHub poller");

  // Run immediately, then on interval
  void pollOnce();
  pollTimer = setInterval(() => void pollOnce(), githubPollIntervalMs);
}

export function stopGitHubPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollOnce(): Promise<void> {
  try {
    const db = getDb();

    // Find all issues with githubUrl set and not yet done
    const rows = await db
      .select()
      .from(issuesTable)
      .where(
        and(
          isNotNull(issuesTable.metadata),
          isNotNull(issuesTable.githubUrl),
          ne(issuesTable.status, "done"),
          ne(issuesTable.status, "cancelled"),
        ),
      );

    for (const row of rows) {
      try {
        await pollIssue(row);
      } catch (err: unknown) {
        log().error({ err, issueId: row.id }, "Error polling issue");
      }
    }
  } catch (err: unknown) {
    log().error({ err }, "GitHub poller tick failed");
  }
}

async function pollIssue(row: typeof issuesTable.$inferSelect): Promise<void> {
  const meta = (row.metadata as Record<string, unknown>) ?? {};
  const repo = meta.githubRepo as string;
  const ghNumber = meta.githubIssueNumber as number;
  if (!repo || !ghNumber) return;

  const companyId = row.companyId;
  const issueId = row.id;

  // 1. Check labels for stage advancement
  const labels = await bridge.getLabels(repo, ghNumber);
  const currentStage = bridge.latestStageFromLabels(labels);
  const previousStage = meta.pipelineStage as string | undefined;

  if (
    currentStage &&
    currentStage !== previousStage &&
    bridge.PIPELINE_STAGES.indexOf(currentStage) >
      bridge.PIPELINE_STAGES.indexOf((previousStage as any) ?? "")
  ) {
    const newStatus =
      currentStage === "tested" || currentStage === "reviewed"
        ? "in_review"
        : "in_progress";

    await issuesService.updateIssue(companyId, issueId, {
      status: newStatus as any,
      metadata: { ...meta, pipelineStage: currentStage },
    });

    await insertActivity({
      companyId,
      eventType: "pipeline.stage_changed",
      issueId,
      actorType: "system",
      summary: `Pipeline advanced to "${currentStage}"`,
      payload: { stage: currentStage, previousStage, labels },
    });

    await publishLiveEvent(companyId, {
      type: "pipeline.stage_changed",
      issueId,
      stage: currentStage,
      previousStage,
    });

    // Update agent statuses for ALL intermediate stages (handles multi-stage jumps)
    const prevIdx = previousStage ? bridge.PIPELINE_STAGES.indexOf(previousStage as any) : -1;
    const currIdx = bridge.PIPELINE_STAGES.indexOf(currentStage as any);
    const STAGES_WITH_COMPLETED = [...bridge.PIPELINE_STAGES, "completed"] as const;

    for (let i = prevIdx + 1; i <= currIdx; i++) {
      await updateAgentStatuses(companyId, STAGES_WITH_COMPLETED[i], issueId, row.title);
    }

    log().info({ issueId, stage: currentStage, previousStage }, "Pipeline stage advanced");

    // Check pipeline mode — manual mode creates an approval for human review
    // instead of auto-triggering the next agent.
    const pipelineMode = meta.pipelineMode as string | undefined;

    if (pipelineMode === "manual") {
      // Set pipelineWaiting flag so the UI shows a "Start Next Agent" button
      const nextStageIdx = bridge.PIPELINE_STAGES.indexOf(currentStage) + 1;
      const nextStage = bridge.PIPELINE_STAGES[nextStageIdx] as string | undefined;

      if (nextStage) {
        await issuesService.updateIssue(companyId, issueId, {
          metadata: { ...meta, pipelineStage: currentStage, pipelineWaiting: nextStage },
        });
      }

      await publishLiveEvent(companyId, {
        type: "pipeline.waiting_for_trigger",
        issueId,
        stage: currentStage,
        nextStage: nextStage ?? null,
      });

      log().info({ issueId, stage: currentStage, nextStage }, "Manual mode — waiting for user trigger");
    } else {
      // Auto mode: trigger the next agent via Hopebot.
      // This makes the pipeline self-healing — even if the original webhook
      // was lost (runners down, network blip), the poller picks it up.
      try {
        await bridge.triggerHopebot({
          action: "labeled",
          label: { name: currentStage },
          issue: {
            number: ghNumber,
            title: row.title,
            body: row.description ?? "",
            html_url: `https://github.com/${repo}/issues/${ghNumber}`,
          },
          repository: { full_name: repo },
        });
        log().info({ issueId, stage: currentStage }, "Poller re-triggered Hopebot for stage");
      } catch (err: unknown) {
        log().error({ err, issueId, stage: currentStage }, "Poller failed to trigger Hopebot");
      }
    }
  }

  // 2. Check for new GitHub comments → insert as issue comments
  const lastCheck = meta.lastCommentCheckAt as string | undefined;
  const importedIds = (meta.importedGhCommentIds as number[]) ?? [];
  const comments = await bridge.getCommentsSince(repo, ghNumber, lastCheck);

  // Filter out already-imported comments by GitHub comment ID
  const newComments = comments.filter((c) => !importedIds.includes(c.id));

  if (newComments.length > 0) {
    const newImportedIds = [...importedIds];

    for (const comment of newComments) {
      try {
        await issuesService.addComment(companyId, issueId, {
          body: `**${comment.user}** (GitHub):\n\n${comment.body}`,
          authorType: "system",
        });
        newImportedIds.push(comment.id);
      } catch {
        // Duplicate or error — skip
      }
    }

    // Update last check timestamp (add 1s to avoid inclusive re-fetch)
    const latestCommentTime = newComments[newComments.length - 1].created_at;
    await issuesService.updateIssue(companyId, issueId, {
      metadata: {
        ...meta,
        pipelineStage: currentStage ?? previousStage,
        lastCommentCheckAt: latestCommentTime,
        importedGhCommentIds: newImportedIds,
      },
    });
  }

  // 3. Check if GitHub issue is closed → mark SeaClip issue as done
  // Re-read current metadata in case stage advancement updated it above
  const closed = await bridge.isGitHubIssueClosed(repo, ghNumber);
  const currentMeta = currentStage !== previousStage
    ? { ...meta, pipelineStage: currentStage ?? previousStage }
    : meta;

  if (closed && row.status !== "done") {
    await issuesService.updateIssue(companyId, issueId, {
      status: "done" as any,
      metadata: { ...currentMeta, pipelineStage: "completed" },
    });

    await insertActivity({
      companyId,
      eventType: "pipeline.completed",
      issueId,
      actorType: "system",
      summary: "Pipeline completed — GitHub issue closed",
      payload: { repo, githubNumber: ghNumber },
    });

    await publishLiveEvent(companyId, {
      type: "pipeline.completed",
      issueId,
    });

    // Process all remaining stages up to completed so every agent is set idle
    const lastStage = (currentStage ?? previousStage) as string;
    const lastIdx = bridge.PIPELINE_STAGES.indexOf(lastStage as any);
    const STAGES_WITH_COMPLETED = [...bridge.PIPELINE_STAGES, "completed"] as const;

    for (let i = lastIdx + 1; i < STAGES_WITH_COMPLETED.length; i++) {
      await updateAgentStatuses(companyId, STAGES_WITH_COMPLETED[i], issueId, row.title);
    }

    log().info({ issueId }, "Pipeline completed — issue closed");
  }
}
