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

  // Use a mutable ref for metadata so all sections see the latest state
  let liveMeta = { ...meta };

  // 1. Check labels for stage advancement
  const labels = await bridge.getLabels(repo, ghNumber);
  const currentStage = bridge.latestStageFromLabels(labels);
  const previousStage = liveMeta.pipelineStage as string | undefined;

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

    liveMeta = { ...liveMeta, pipelineStage: currentStage };

    await issuesService.updateIssue(companyId, issueId, {
      status: newStatus as any,
      metadata: liveMeta,
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

    // Check pipeline mode — manual mode pauses for human trigger,
    // auto mode fires the next agent immediately.
    const pipelineMode = liveMeta.pipelineMode as string | undefined;

    if (pipelineMode === "manual") {
      // ALWAYS pause in manual mode — every agent requires explicit approval,
      // including Matthews (the final merge agent).
      //
      // pipelineWaiting = the current stage label, which is used to trigger
      // the NEXT agent. e.g. when "tested" label appears, Tina is done,
      // and "tested" triggers Suzy. So we store "tested" as the waiting value.
      liveMeta = { ...liveMeta, pipelineWaiting: currentStage };
      await issuesService.updateIssue(companyId, issueId, {
        metadata: liveMeta,
      });

      await publishLiveEvent(companyId, {
        type: "pipeline.waiting_for_trigger",
        issueId,
        stage: currentStage,
        nextStage: currentStage,
      });

      log().info({ issueId, stage: currentStage, nextStage }, "Manual mode — waiting for user trigger");
    } else {
      // Auto mode: trigger the next agent via Hopebot.
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
  const lastCheck = liveMeta.lastCommentCheckAt as string | undefined;
  const importedIds = (liveMeta.importedGhCommentIds as number[]) ?? [];
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

    // Update liveMeta with comment tracking fields
    const latestCommentTime = newComments[newComments.length - 1].created_at;
    liveMeta = {
      ...liveMeta,
      lastCommentCheckAt: latestCommentTime,
      importedGhCommentIds: newImportedIds,
    };
    await issuesService.updateIssue(companyId, issueId, {
      metadata: liveMeta,
    });
  }

  // 3. Check if GitHub issue is closed → mark SeaClip issue as done
  const closed = await bridge.isGitHubIssueClosed(repo, ghNumber);

  if (closed && row.status !== "done") {
    liveMeta = { ...liveMeta, pipelineStage: "completed", pipelineWaiting: null };
    await issuesService.updateIssue(companyId, issueId, {
      status: "done" as any,
      metadata: liveMeta,
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
