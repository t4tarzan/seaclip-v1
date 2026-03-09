/**
 * pull-requests service — PR tracking from spokes.
 * Uses raw SQL via sql.raw() since pull_requests table is not in Drizzle schema.
 */
import { getDb } from "../db.js";
import { sql } from "drizzle-orm";
import { notFound, conflict } from "../errors.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw SQL result type varies by driver
type RawResult = { rows: Record<string, unknown>[] };

export type PRStatus = "open" | "closed" | "merged";
export type PRReviewStatus = "pending" | "approved" | "rejected";

export interface PullRequest {
  id: string;
  companyId: string;
  spokeTaskId: string;
  deviceId: string;
  title: string;
  description: string | null;
  sourceBranch: string;
  targetBranch: string;
  status: PRStatus;
  reviewStatus: PRReviewStatus;
  diffStat: Record<string, unknown> | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  mergedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePRInput {
  spokeTaskId: string;
  deviceId: string;
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch?: string;
  diffStat?: Record<string, unknown>;
}

export interface ListPRsFilters {
  status?: string;
  reviewStatus?: string;
  deviceId?: string;
}

function toISOString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function rowToPR(row: Record<string, unknown>): PullRequest {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    spokeTaskId: row.spoke_task_id as string,
    deviceId: row.device_id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    sourceBranch: row.source_branch as string,
    targetBranch: row.target_branch as string,
    status: row.status as PRStatus,
    reviewStatus: row.review_status as PRReviewStatus,
    diffStat: (row.diff_stat as Record<string, unknown>) ?? null,
    reviewedBy: (row.reviewed_by as string) ?? null,
    reviewedAt: row.reviewed_at ? toISOString(row.reviewed_at) : null,
    mergedAt: row.merged_at ? toISOString(row.merged_at) : null,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
  };
}

export async function createPR(
  companyId: string,
  input: CreatePRInput,
): Promise<PullRequest> {
  const db = getDb();
  const diffStatJson = input.diffStat ? JSON.stringify(input.diffStat).replace(/'/g, "''") : null;
  const result = await db.execute(sql.raw(`
    INSERT INTO pull_requests (company_id, spoke_task_id, device_id, title, description, source_branch, target_branch, diff_stat)
    VALUES (
      '${companyId}',
      '${input.spokeTaskId}',
      '${input.deviceId}',
      '${input.title.replace(/'/g, "''")}',
      ${input.description ? `'${input.description.replace(/'/g, "''")}'` : "NULL"},
      '${input.sourceBranch.replace(/'/g, "''")}',
      '${(input.targetBranch ?? "main").replace(/'/g, "''")}',
      ${diffStatJson ? `'${diffStatJson}'::jsonb` : "NULL"}
    )
    RETURNING *
  `)) as unknown as RawResult;
  return rowToPR(result.rows[0]);
}

export async function listPRs(
  companyId: string,
  filters?: ListPRsFilters,
): Promise<PullRequest[]> {
  const db = getDb();
  const conditions: string[] = [`company_id = '${companyId}'`];
  if (filters?.status) conditions.push(`status = '${filters.status}'`);
  if (filters?.reviewStatus) conditions.push(`review_status = '${filters.reviewStatus}'`);
  if (filters?.deviceId) conditions.push(`device_id = '${filters.deviceId}'`);

  const where = `WHERE ${conditions.join(" AND ")}`;
  const result = await db.execute(
    sql.raw(`SELECT * FROM pull_requests ${where} ORDER BY created_at DESC`),
  ) as unknown as RawResult;
  return result.rows.map(rowToPR);
}

export async function getPR(id: string): Promise<PullRequest> {
  const db = getDb();
  const result = await db.execute(
    sql.raw(`SELECT * FROM pull_requests WHERE id = '${id}'`),
  ) as unknown as RawResult;
  const row = result.rows[0];
  if (!row) throw notFound(`Pull request "${id}" not found`);
  return rowToPR(row);
}

export async function reviewPR(
  id: string,
  action: "approved" | "rejected",
  reviewedBy: string,
): Promise<PullRequest> {
  const pr = await getPR(id);
  if (pr.status !== "open") {
    throw conflict(`Cannot review a pull request with status "${pr.status}"`);
  }

  const db = getDb();
  const result = await db.execute(sql.raw(`
    UPDATE pull_requests
    SET review_status = '${action}',
        reviewed_by = '${reviewedBy.replace(/'/g, "''")}',
        reviewed_at = now(),
        updated_at = now()
    WHERE id = '${id}'
    RETURNING *
  `)) as unknown as RawResult;
  return rowToPR(result.rows[0]);
}

export async function mergePR(id: string): Promise<PullRequest> {
  const pr = await getPR(id);
  if (pr.status !== "open") {
    throw conflict(`Cannot merge a pull request with status "${pr.status}"`);
  }
  if (pr.reviewStatus !== "approved") {
    throw conflict(`Cannot merge a pull request that is not approved (current: "${pr.reviewStatus}")`);
  }

  const db = getDb();
  const result = await db.execute(sql.raw(`
    UPDATE pull_requests
    SET status = 'merged',
        merged_at = now(),
        updated_at = now()
    WHERE id = '${id}'
    RETURNING *
  `)) as unknown as RawResult;
  return rowToPR(result.rows[0]);
}
