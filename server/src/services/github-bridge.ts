/**
 * github-bridge service — GitHub API integration for SeaClip.
 *
 * Provides:
 *   - listRepos(token): list repos accessible with the given PAT
 *   - connectRepo(companyId, repoFullName): persist a connected repo
 *   - syncIssue(repoFullName, issueNumber): pull a GitHub issue into local DB
 *   - getCommentsSince(repoFullName, issueNumber, since?): fetch comments since a timestamp
 *   - validateWebhookSignature(secret, rawBody, signature): HMAC-SHA256 verification
 */
import crypto from "node:crypto";
import { getDb } from "../db.js";
import { eq, and } from "drizzle-orm";
import { githubRepos } from "@seaclip/db";
import { getConfig } from "../config.js";
import { notFound, conflict } from "../errors.js";
import { getLogger } from "../middleware/logger.js";

export interface GitHubRepo {
  id: number;
  full_name: string;
  default_branch: string;
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a GitHub webhook HMAC-SHA256 signature.
 * Expected signature format: "sha256=<hex>"
 */
export function validateWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string,
): boolean {
  if (!secret || !signature) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function githubFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List repositories accessible with the given personal access token.
 */
export async function listRepos(
  token: string,
): Promise<GitHubRepo[]> {
  const data = await githubFetch<GitHubRepo[]>(
    "/user/repos?per_page=100&sort=updated",
    token,
  );
  return data.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    default_branch: r.default_branch,
  }));
}

/**
 * Connect a GitHub repo to a company.
 * Throws ConflictError if already connected.
 */
export async function connectRepo(
  companyId: string,
  repoFullName: string,
): Promise<typeof githubRepos.$inferSelect> {
  const logger = getLogger();
  const config = getConfig();
  const db = getDb();

  // Fetch repo metadata from GitHub
  let repoData: GitHubRepo;
  try {
    repoData = await githubFetch<GitHubRepo>(
      `/repos/${repoFullName}`,
      config.githubToken,
    );
  } catch (err) {
    logger.error({ err, repoFullName }, "github-bridge: failed to fetch repo from GitHub");
    throw err;
  }

  // Check for duplicate
  const existing = await db
    .select()
    .from(githubRepos)
    .where(
      and(
        eq(githubRepos.companyId, companyId),
        eq(githubRepos.githubRepoId, repoData.id),
      ),
    );

  if (existing.length > 0) {
    throw conflict(`Repository "${repoFullName}" is already connected to this company`);
  }

  const [row] = await db
    .insert(githubRepos)
    .values({
      companyId,
      repoFullName,
      githubRepoId: repoData.id,
      defaultBranch: repoData.default_branch,
    })
    .returning();

  logger.info(
    { companyId, repoFullName, githubRepoId: repoData.id },
    "github-bridge: connected repo",
  );

  return row;
}

/**
 * List all GitHub repos connected to a company.
 */
export async function listConnectedRepos(
  companyId: string,
): Promise<(typeof githubRepos.$inferSelect)[]> {
  const db = getDb();
  return db
    .select()
    .from(githubRepos)
    .where(eq(githubRepos.companyId, companyId));
}

/**
 * Get a single connected repo by ID.
 */
export async function getConnectedRepo(
  companyId: string,
  repoId: string,
): Promise<typeof githubRepos.$inferSelect> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(githubRepos)
    .where(and(eq(githubRepos.id, repoId), eq(githubRepos.companyId, companyId)));

  if (!row) {
    throw notFound(`GitHub repo "${repoId}" not found`);
  }
  return row;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
}

/**
 * Sync a single GitHub issue by number.
 * Logs the result — callers handle storage if needed.
 */
export async function syncIssue(
  repoFullName: string,
  issueNumber: number,
): Promise<void> {
  const logger = getLogger();
  const config = getConfig();

  let issue: GitHubIssue;
  try {
    issue = await githubFetch<GitHubIssue>(
      `/repos/${repoFullName}/issues/${issueNumber}`,
      config.githubToken,
    );
  } catch (err) {
    logger.error({ err, repoFullName, issueNumber }, "github-bridge: failed to fetch issue");
    throw err;
  }

  logger.info(
    {
      repoFullName,
      issueNumber: issue.number,
      title: issue.title,
      state: issue.state,
    },
    "github-bridge: synced issue",
  );
}

export interface GitHubComment {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  user: { login: string } | null;
}

/**
 * Fetch comments for a GitHub issue created/updated since a given timestamp.
 * If `since` is undefined, fetches the first page (no time filter — first-ever poll).
 *
 * Returns up to 100 comments. If a repo has more than 100 new comments per tick,
 * the poller will catch up on the next tick (acceptable for now).
 */
export async function getCommentsSince(
  repoFullName: string,
  issueNumber: number,
  since?: string,
): Promise<GitHubComment[]> {
  const config = getConfig();
  const sinceParam = since ? `&since=${encodeURIComponent(since)}` : "";
  const path = `/repos/${repoFullName}/issues/${issueNumber}/comments?per_page=100${sinceParam}`;
  return githubFetch<GitHubComment[]>(path, config.githubToken);
}
