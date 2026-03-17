/**
 * github-bridge service — GitHub API calls + Hopebot pipeline triggering.
 *
 * Uses fetch() for GitHub REST API (no extra deps). Talks to Hopebot
 * by fabricating webhook payloads to localhost:80/api/github/webhook.
 */
import { getDb } from "../db.js";
import { eq } from "drizzle-orm";
import { agents as agentsTable } from "@seaclip/db";
import { getConfig } from "../config.js";
import { getLogger } from "../middleware/logger.js";
import * as issuesService from "./issues.js";
import { insertActivity } from "./activity-log.js";
import { publishLiveEvent } from "./live-events.js";

/** Maps a stage label to the pipelineRole of the agent it triggers */
const STAGE_TO_ROLE: Record<string, string> = {
  plan: "research",
  researched: "architect",
  planned: "developer",
  coded: "tester",
  tested: "reviewer",
  reviewed: "release",
};

function log() {
  return getLogger().child({ service: "github-bridge" });
}

export const PIPELINE_STAGES = [
  "plan",
  "researched",
  "planned",
  "coded",
  "tested",
  "reviewed",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

const STAGE_TO_STATUS: Record<string, string> = {
  plan: "in_progress",
  researched: "in_progress",
  planned: "in_progress",
  coded: "in_progress",
  tested: "in_review",
  reviewed: "in_review",
};

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

function ghHeaders(): Record<string, string> {
  const { githubToken } = getConfig();
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${githubToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
}

export async function listOrgRepos(org?: string): Promise<GitHubRepo[]> {
  const { githubOrg } = getConfig();
  const target = org ?? githubOrg;
  const res = await fetch(
    `https://api.github.com/users/${target}/repos?per_page=100&sort=updated`,
    { headers: ghHeaders() },
  );
  if (!res.ok) {
    log().error({ status: res.status }, "Failed to list repos");
    return [];
  }
  const repos = (await res.json()) as any[];
  return repos.map((r) => ({
    name: r.name,
    full_name: r.full_name,
    html_url: r.html_url,
    description: r.description,
    private: r.private,
  }));
}

export async function createGitHubIssue(
  repo: string,
  title: string,
  body: string,
): Promise<{ number: number; url: string }> {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub create issue failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as any;
  return { number: data.number, url: data.html_url };
}

export async function addLabel(
  repo: string,
  issueNumber: number,
  label: string,
): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`,
    {
      method: "POST",
      headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ labels: [label] }),
    },
  );
  if (!res.ok) {
    log().warn({ status: res.status, repo, issueNumber, label }, "Failed to add label");
  }
}

export async function getLabels(
  repo: string,
  issueNumber: number,
): Promise<string[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`,
    { headers: ghHeaders() },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as any[];
  return data.map((l) => l.name);
}

export interface GHComment {
  id: number;
  body: string;
  user: string;
  created_at: string;
}

export async function getCommentsSince(
  repo: string,
  issueNumber: number,
  since?: string,
): Promise<GHComment[]> {
  let url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments?per_page=100`;
  if (since) url += `&since=${since}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) return [];
  const data = (await res.json()) as any[];
  return data.map((c) => ({
    id: c.id,
    body: c.body,
    user: c.user?.login ?? "unknown",
    created_at: c.created_at,
  }));
}

export async function isGitHubIssueClosed(
  repo: string,
  issueNumber: number,
): Promise<boolean> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues/${issueNumber}`,
    { headers: ghHeaders() },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as any;
  return data.state === "closed";
}

// ---------------------------------------------------------------------------
// Hopebot trigger — calls cluster role webhooks directly (bypasses auth)
// ---------------------------------------------------------------------------

const HOPEBOT_CLUSTER_ID = "8fb76938-b81e-489d-940e-c31ee6fc551a";
const HOPEBOT_API_KEY = "tpb_1f5f0b7705a6905f8e0acc0f234a57db6e19baf531b785bdb38107da4b358af8";
const HOPEBOT_HOST = "whitenoises-mac-studio.zapus-rohu.ts.net";

export const LABEL_TO_ROLE_ID_MAP: Record<string, { roleId: string; name: string }> = {
  plan:       { roleId: "12e09acf-8d35-4ff1-a1cf-ef45d30588f5", name: "Curious Charlie" },
  researched: { roleId: "c0e89367-115a-4f48-ae2b-c3f8a0f5bbd6", name: "Peter Plan" },
  planned:    { roleId: "462b360c-7c03-470a-8368-0e0ab85a219d", name: "David Dev" },
  coded:      { roleId: "5ed6ecf3-151a-4344-b7d4-3d3e17d64aad", name: "Test Tina" },
  tested:     { roleId: "be70cab5-5e84-43fa-ae39-09f9a6d17f7c", name: "Sceptic Suzy" },
  reviewed:   { roleId: "b46df03d-097e-4bff-999c-69c6d77f8bed", name: "Merge Matthews" },
};

function buildAgentPrompt(
  stage: string,
  issue: { number: number; title: string; body: string; html_url: string; repository: string },
): string {
  const repo = issue.repository;
  const num = issue.number;

  // Strict repo context block — every agent gets this at the top
  const repoBlock = [
    `STRICT CONTEXT — DO NOT DEVIATE:`,
    `  Repository: ${repo}`,
    `  GitHub Issue: #${num}`,
    `  Issue URL: ${issue.html_url}`,
    `  Clone URL: https://github.com/${repo}.git`,
    ``,
    `IMPORTANT: You MUST only operate on the repository "${repo}".`,
    `Do NOT clone, push to, create PRs on, or reference any other repository.`,
    `All git commands, gh CLI commands, and API calls MUST target "${repo}" and issue #${num}.`,
    ``,
  ].join("\n");

  const base = `${repoBlock}Issue: ${issue.title}\n\nDescription:\n${issue.body || "No description"}\n\n`;

  const labelCmd = (label: string) =>
    `CRITICAL — YOUR LAST STEP (do NOT skip):\nRun this exact command:\n  gh issue edit ${num} --repo ${repo} --add-label "${label}"\nIf that fails, use curl:\n  curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" https://api.github.com/repos/${repo}/issues/${num}/labels -d '{"labels":["${label}"]}'`;

  const instructions: Record<string, string> = {
    plan: [
      `Your job:`,
      `1. Clone ONLY the repo "${repo}" — run: git clone https://github.com/${repo}.git`,
      `2. Research the codebase and understand the issue`,
      `3. Write a detailed research comment on GitHub issue #${num} in repo ${repo}`,
      `4. Write findings to shared/handoff/task.md`,
      ``,
      labelCmd("researched"),
    ].join("\n"),

    researched: [
      `Peter Plan: Read Charlie's research comment on issue #${num} in repo ${repo}.`,
      `Create a detailed implementation plan and comment it on the issue.`,
      `All file paths and references MUST be relative to the ${repo} codebase.`,
      ``,
      labelCmd("planned"),
    ].join("\n"),

    planned: [
      `David Dev: Read Peter's plan on issue #${num} in repo ${repo}.`,
      `1. Clone ONLY "${repo}" — run: git clone https://github.com/${repo}.git`,
      `2. Implement ALL changes in a fix branch`,
      `3. Push ONLY to "${repo}" — run: git push origin <branch-name>`,
      `4. Comment your changes summary on issue #${num}`,
      `DO NOT push to or create branches on any other repository.`,
      ``,
      labelCmd("coded"),
    ].join("\n"),

    coded: [
      `Test Tina: Read David's changes on the fix branch for issue #${num} in repo ${repo}.`,
      `1. Clone ONLY "${repo}" — run: git clone https://github.com/${repo}.git`,
      `2. Check out David's fix branch`,
      `3. Write and run tests`,
      `4. Comment a test report on issue #${num}`,
      `DO NOT reference or test against any other repository.`,
      ``,
      labelCmd("tested"),
    ].join("\n"),

    tested: [
      `Sceptic Suzy: Review the code changes for issue #${num} in repo ${repo}.`,
      `1. Clone ONLY "${repo}" — run: git clone https://github.com/${repo}.git`,
      `2. Check out the fix branch`,
      `3. Review for security, quality, and correctness`,
      `4. Comment your verdict on issue #${num}`,
      `DO NOT reference or review code from any other repository.`,
      ``,
      `If PASS:`,
      labelCmd("reviewed"),
    ].join("\n"),

    reviewed: [
      `Merge Matthews: Create a PR and merge for issue #${num} in repo ${repo}.`,
      `1. The fix branch is in "${repo}" — create a PR ONLY in that repo`,
      `2. PR title must reference issue: "closes #${num}"`,
      `3. Run: gh pr create --repo ${repo} --title "fix: <description> (closes #${num})" --body "Closes #${num}"`,
      `4. Merge: gh pr merge --repo ${repo} --squash --delete-branch`,
      `5. Close the issue: gh issue close ${num} --repo ${repo}`,
      ``,
      `CRITICAL: The PR MUST be created in "${repo}" and ONLY in "${repo}".`,
      `Do NOT create PRs in any other repository.`,
    ].join("\n"),
  };

  return base + (instructions[stage] ?? "");
}

export async function triggerHopebot(payload: Record<string, unknown>): Promise<void> {
  const { hopebotBaseUrl } = getConfig();
  const labelName = (payload.label as any)?.name as string;
  const role = LABEL_TO_ROLE_ID_MAP[labelName];

  if (!role) {
    log().warn({ labelName }, "No Hopebot role mapping for label");
    return;
  }

  const issue = payload.issue as any;
  const repo = (payload.repository as any)?.full_name;
  if (!repo) {
    log().error({ labelName }, "triggerHopebot called without repository — aborting");
    return;
  }

  const prompt = buildAgentPrompt(labelName, {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? "",
    html_url: issue.html_url,
    repository: repo,
  });

  // Use the Tailscale hostname directly — Traefik requires Host header matching,
  // and Node's fetch doesn't allow overriding Host when connecting to localhost.
  const baseUrl = hopebotBaseUrl.includes("localhost")
    ? `http://${HOPEBOT_HOST}`
    : hopebotBaseUrl;
  const url = `${baseUrl}/api/cluster/${HOPEBOT_CLUSTER_ID}/role/${role.roleId}/webhook`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": HOPEBOT_API_KEY,
      },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.text();
    log().info({ status: res.status, agent: role.name, url }, "Hopebot trigger: %s", data);
  } catch (err: unknown) {
    log().error({ err, agent: role.name, url }, "Failed to trigger Hopebot");
  }
}

// ---------------------------------------------------------------------------
// Repo bootstrapping — ensure pipeline labels exist
// ---------------------------------------------------------------------------

const PIPELINE_LABELS = [
  { name: "plan", color: "1d76db", description: "Pipeline: research stage" },
  { name: "researched", color: "0075ca", description: "Pipeline: research complete" },
  { name: "planned", color: "5319e7", description: "Pipeline: plan complete" },
  { name: "coded", color: "e4e669", description: "Pipeline: code complete" },
  { name: "tested", color: "0e8a16", description: "Pipeline: tests passed" },
  { name: "reviewed", color: "22c55e", description: "Pipeline: review passed" },
];

const bootstrappedRepos = new Set<string>();

export async function bootstrapRepoLabels(repo: string): Promise<void> {
  if (bootstrappedRepos.has(repo)) return;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/labels?per_page=100`,
    { headers: ghHeaders() },
  );
  const existing = res.ok
    ? ((await res.json()) as any[]).map((l) => l.name)
    : [];

  for (const label of PIPELINE_LABELS) {
    if (existing.includes(label.name)) continue;
    const createRes = await fetch(
      `https://api.github.com/repos/${repo}/labels`,
      {
        method: "POST",
        headers: { ...ghHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(label),
      },
    );
    if (createRes.ok) {
      log().info({ repo, label: label.name }, "Created pipeline label");
    } else {
      log().warn({ repo, label: label.name, status: createRes.status }, "Failed to create label");
    }
  }

  bootstrappedRepos.add(repo);
}

// ---------------------------------------------------------------------------
// Pipeline orchestration
// ---------------------------------------------------------------------------

export async function syncIssueToGitHub(
  companyId: string,
  issueId: string,
): Promise<{ githubIssueNumber: number; githubIssueUrl: string }> {
  const issue = await issuesService.getIssue(companyId, issueId);
  const repo = (issue.metadata as any)?.githubRepo;
  if (!repo) {
    throw new Error("Issue has no githubRepo in metadata");
  }

  // Ensure pipeline labels exist on this repo before creating the issue
  await bootstrapRepoLabels(repo);

  const body = `${issue.description ?? ""}\n\n---\n_SeaClip: ${issue.sequenceNumber}_`;
  const gh = await createGitHubIssue(repo, issue.title, body);

  const metadata = {
    ...(issue.metadata ?? {}),
    githubIssueNumber: gh.number,
    githubIssueUrl: gh.url,
  };

  await issuesService.updateIssue(companyId, issueId, {
    metadata,
    status: "todo" as any,
  });

  await insertActivity({
    companyId,
    eventType: "github.issue_created",
    issueId,
    actorType: "system",
    summary: `Created GitHub issue #${gh.number} in ${repo}`,
    payload: { repo, githubNumber: gh.number, githubUrl: gh.url },
  });

  return { githubIssueNumber: gh.number, githubIssueUrl: gh.url };
}

export type PipelineMode = "auto" | "manual";

export async function startPipeline(
  companyId: string,
  issueId: string,
  stage: PipelineStage = "plan",
  mode: PipelineMode = "auto",
): Promise<void> {
  const issue = await issuesService.getIssue(companyId, issueId);
  const meta = issue.metadata as Record<string, unknown>;
  const repo = meta.githubRepo as string;
  const ghNumber = meta.githubIssueNumber as number;

  if (!repo || !ghNumber) {
    throw new Error("Issue not linked to GitHub. Sync first.");
  }

  // Add the label on GitHub
  await addLabel(repo, ghNumber, stage);

  // Fire fabricated webhook to Hopebot
  await triggerHopebot({
    action: "labeled",
    label: { name: stage },
    issue: {
      number: ghNumber,
      title: issue.title,
      body: issue.description ?? "",
      html_url: `https://github.com/${repo}/issues/${ghNumber}`,
    },
    repository: { full_name: repo },
  });

  // Update SeaClip issue status + pipeline stage + mode
  const newStatus = STAGE_TO_STATUS[stage] ?? "in_progress";
  await issuesService.updateIssue(companyId, issueId, {
    status: newStatus as any,
    metadata: { ...meta, pipelineStage: stage, pipelineMode: mode, pipelineWaiting: null },
  });

  await insertActivity({
    companyId,
    eventType: "pipeline.started",
    issueId,
    actorType: "system",
    summary: `Pipeline started at "${stage}" stage`,
    payload: { stage, repo, githubNumber: ghNumber },
  });

  await publishLiveEvent(companyId, {
    type: "pipeline.started",
    issueId,
    stage,
  });

  // Mark the triggered agent as active
  const targetRole = STAGE_TO_ROLE[stage];
  if (targetRole) {
    const db = getDb();
    const allAgents = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.companyId, companyId));

    for (const agent of allAgents) {
      const agentMeta = (agent.metadata as Record<string, unknown>) ?? {};
      if (agentMeta.pipelineRole === targetRole) {
        await db.update(agentsTable).set({
          status: "active",
          metadata: {
            ...agentMeta,
            currentIssueId: issueId,
            currentIssueTitle: issue.title,
            activeAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        }).where(eq(agentsTable.id, agent.id));
        break;
      }
    }
  }

  log().info({ issueId, stage, repo, ghNumber }, "Pipeline started");
}

/**
 * Resume a manual pipeline — triggers the next agent without changing pipelineStage.
 * The poller will advance pipelineStage when the agent finishes and adds a label.
 */
export async function resumePipeline(
  companyId: string,
  issueId: string,
  stage: PipelineStage,
  mode: PipelineMode = "manual",
): Promise<void> {
  const issue = await issuesService.getIssue(companyId, issueId);
  const meta = issue.metadata as Record<string, unknown>;
  const repo = meta.githubRepo as string;
  const ghNumber = meta.githubIssueNumber as number;

  if (!repo || !ghNumber) {
    throw new Error("Issue not linked to GitHub. Sync first.");
  }

  // Trigger Hopebot for the stage — the agent will add the label when done
  await triggerHopebot({
    action: "labeled",
    label: { name: stage },
    issue: {
      number: ghNumber,
      title: issue.title,
      body: issue.description ?? "",
      html_url: `https://github.com/${repo}/issues/${ghNumber}`,
    },
    repository: { full_name: repo },
  });

  // Clear pipelineWaiting but do NOT change pipelineStage —
  // the poller advances pipelineStage when it sees the new label from the agent
  await issuesService.updateIssue(companyId, issueId, {
    metadata: { ...meta, pipelineWaiting: null, pipelineMode: mode },
  });

  // Mark the triggered agent as active so the Agents page shows it highlighted
  const targetRole = STAGE_TO_ROLE[stage];
  if (targetRole) {
    const db = getDb();
    const allAgents = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.companyId, companyId));

    for (const agent of allAgents) {
      const agentMeta = (agent.metadata as Record<string, unknown>) ?? {};
      if (agentMeta.pipelineRole === targetRole) {
        await db.update(agentsTable).set({
          status: "active",
          metadata: {
            ...agentMeta,
            currentIssueId: issueId,
            currentIssueTitle: issue.title,
            activeAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        }).where(eq(agentsTable.id, agent.id));
        log().info({ agentName: agent.name, stage }, "Agent marked active on resume");
        break;
      }
    }
  }

  await insertActivity({
    companyId,
    eventType: "pipeline.resumed",
    issueId,
    actorType: "user",
    summary: `Pipeline resumed — triggering agent for "${stage}" stage`,
    payload: { stage, repo, githubNumber: ghNumber },
  });

  await publishLiveEvent(companyId, {
    type: "pipeline.resumed",
    issueId,
    stage,
  });

  log().info({ issueId, stage, repo, ghNumber }, "Pipeline resumed (manual)");
}

/**
 * Determine the furthest pipeline stage from a set of labels.
 */
export function latestStageFromLabels(labels: string[]): PipelineStage | null {
  let latest: PipelineStage | null = null;
  let latestIdx = -1;
  for (const label of labels) {
    const idx = PIPELINE_STAGES.indexOf(label as PipelineStage);
    if (idx > latestIdx) {
      latestIdx = idx;
      latest = label as PipelineStage;
    }
  }
  return latest;
}
