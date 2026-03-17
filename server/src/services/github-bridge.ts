/**
 * github-bridge service — GitHub API calls + Hopebot pipeline triggering.
 *
 * Uses fetch() for GitHub REST API (no extra deps). Talks to Hopebot
 * by fabricating webhook payloads to localhost:80/api/github/webhook.
 */
import { getConfig } from "../config.js";
import { getLogger } from "../middleware/logger.js";
import * as issuesService from "./issues.js";
import { insertActivity } from "./activity-log.js";
import { publishLiveEvent } from "./live-events.js";

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
  const base = `GitHub issue #${issue.number} labeled "${stage}".\n\nIssue: ${issue.title}\nRepo: ${issue.repository}\nURL: ${issue.html_url}\n\nDescription:\n${issue.body || "No description"}\n\n`;

  const instructions: Record<string, string> = {
    plan: `Your job:\n1. Clone the repo and research the codebase\n2. Write a detailed research comment on the GitHub issue\n3. Write findings to shared/handoff/task.md\n\nCRITICAL — YOUR LAST STEP (do NOT skip):\nRun this exact command:\n  gh issue edit ${issue.number} --repo ${issue.repository} --add-label "researched"\nIf that fails, use curl:\n  curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" https://api.github.com/repos/${issue.repository}/issues/${issue.number}/labels -d '{"labels":["researched"]}'`,
    researched: `Peter Plan: Read Charlie's research comment on issue #${issue.number}, create a detailed implementation plan, comment it on the issue.\n\nCRITICAL — YOUR LAST STEP (do NOT skip):\nRun this exact command:\n  gh issue edit ${issue.number} --repo ${issue.repository} --add-label "planned"\nIf that fails, use curl:\n  curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" https://api.github.com/repos/${issue.repository}/issues/${issue.number}/labels -d '{"labels":["planned"]}'`,
    planned: `David Dev: Read Peter's plan on issue #${issue.number}, implement ALL changes, commit and push to a fix branch.\n\nCRITICAL — YOUR LAST STEP (do NOT skip):\nRun this exact command:\n  gh issue edit ${issue.number} --repo ${issue.repository} --add-label "coded"\nIf that fails, use curl:\n  curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" https://api.github.com/repos/${issue.repository}/issues/${issue.number}/labels -d '{"labels":["coded"]}'`,
    coded: `Test Tina: Read David's changes on the fix branch for issue #${issue.number}, write and run tests, comment a test report on the issue.\n\nCRITICAL — YOUR LAST STEP (do NOT skip):\nRun this exact command:\n  gh issue edit ${issue.number} --repo ${issue.repository} --add-label "tested"\nIf that fails, use curl:\n  curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" https://api.github.com/repos/${issue.repository}/issues/${issue.number}/labels -d '{"labels":["tested"]}'`,
    tested: `Sceptic Suzy: Review the code changes for issue #${issue.number} for security, quality, and correctness. Comment your verdict on the issue.\n\nCRITICAL — YOUR LAST STEP (do NOT skip):\nIf PASS, run this exact command:\n  gh issue edit ${issue.number} --repo ${issue.repository} --add-label "reviewed"\nIf that fails, use curl:\n  curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" https://api.github.com/repos/${issue.repository}/issues/${issue.number}/labels -d '{"labels":["reviewed"]}'`,
    reviewed: `Merge Matthews: Create a PR from the fix branch for issue #${issue.number}, reference the issue with "closes #${issue.number}", merge it, then close the issue.`,
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
  const repo = (payload.repository as any)?.full_name ?? "t4tarzan/seaclip-v1";

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

  log().info({ issueId, stage, repo, ghNumber }, "Pipeline started");
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
