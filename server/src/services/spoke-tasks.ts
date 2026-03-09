/**
 * spoke-tasks service — hub-to-spoke task assignment with git workflow.
 * Uses raw SQL via sql.raw() since spoke_tasks table is not in Drizzle schema.
 */
import { getDb } from "../db.js";
import { sql } from "drizzle-orm";
import { notFound, conflict } from "../errors.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw SQL result type varies by driver
type RawResult = { rows: Record<string, unknown>[] };

export type SpokeTaskStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "pr_raised"
  | "merged"
  | "done";

const VALID_TRANSITIONS: Record<SpokeTaskStatus, SpokeTaskStatus[]> = {
  pending: ["assigned"],
  assigned: ["in_progress"],
  in_progress: ["pr_raised"],
  pr_raised: ["merged"],
  merged: ["done"],
  done: [],
};

export interface SpokeTask {
  id: string;
  companyId: string;
  deviceId: string;
  issueId: string | null;
  title: string;
  description: string | null;
  repoUrl: string;
  branch: string | null;
  worktreePath: string | null;
  status: SpokeTaskStatus;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpokeTaskInput {
  deviceId: string;
  issueId?: string;
  title: string;
  description?: string;
  repoUrl: string;
  branch?: string;
  worktreePath?: string;
}

export interface ListSpokeTasksFilters {
  deviceId?: string;
  status?: string;
}

function toISOString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function rowToSpokeTask(row: Record<string, unknown>): SpokeTask {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    deviceId: row.device_id as string,
    issueId: (row.issue_id as string) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? null,
    repoUrl: row.repo_url as string,
    branch: (row.branch as string) ?? null,
    worktreePath: (row.worktree_path as string) ?? null,
    status: row.status as SpokeTaskStatus,
    assignedAt: toISOString(row.assigned_at),
    startedAt: row.started_at ? toISOString(row.started_at) : null,
    completedAt: row.completed_at ? toISOString(row.completed_at) : null,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
  };
}

export async function createTask(
  companyId: string,
  input: CreateSpokeTaskInput,
): Promise<SpokeTask> {
  const db = getDb();
  const result = await db.execute(sql.raw(`
    INSERT INTO spoke_tasks (company_id, device_id, issue_id, title, description, repo_url, branch, worktree_path)
    VALUES (
      '${companyId}',
      '${input.deviceId}',
      ${input.issueId ? `'${input.issueId}'` : "NULL"},
      '${input.title.replace(/'/g, "''")}',
      ${input.description ? `'${input.description.replace(/'/g, "''")}'` : "NULL"},
      '${input.repoUrl.replace(/'/g, "''")}',
      ${input.branch ? `'${input.branch.replace(/'/g, "''")}'` : "NULL"},
      ${input.worktreePath ? `'${input.worktreePath.replace(/'/g, "''")}'` : "NULL"}
    )
    RETURNING *
  `)) as unknown as RawResult;
  return rowToSpokeTask(result.rows[0]);
}

export async function listTasks(
  companyId: string,
  filters?: ListSpokeTasksFilters,
): Promise<SpokeTask[]> {
  const db = getDb();
  const conditions: string[] = [`company_id = '${companyId}'`];
  if (filters?.deviceId) conditions.push(`device_id = '${filters.deviceId}'`);
  if (filters?.status) conditions.push(`status = '${filters.status}'`);

  const where = `WHERE ${conditions.join(" AND ")}`;
  const result = await db.execute(
    sql.raw(`SELECT * FROM spoke_tasks ${where} ORDER BY created_at DESC`),
  ) as unknown as RawResult;
  return result.rows.map(rowToSpokeTask);
}

export async function getTask(id: string): Promise<SpokeTask> {
  const db = getDb();
  const result = await db.execute(
    sql.raw(`SELECT * FROM spoke_tasks WHERE id = '${id}'`),
  ) as unknown as RawResult;
  const row = result.rows[0];
  if (!row) throw notFound(`Spoke task "${id}" not found`);
  return rowToSpokeTask(row);
}

export async function updateTaskStatus(
  id: string,
  newStatus: SpokeTaskStatus,
): Promise<SpokeTask> {
  const task = await getTask(id);
  const currentStatus = task.status;

  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw conflict(
      `Invalid status transition: "${currentStatus}" → "${newStatus}". Allowed: ${allowed?.join(", ") || "none"}`,
    );
  }

  const sets: string[] = [`status = '${newStatus}'`, `updated_at = now()`];
  if (newStatus === "in_progress") sets.push(`started_at = COALESCE(started_at, now())`);
  if (newStatus === "done") sets.push(`completed_at = now()`);

  const db = getDb();
  const result = await db.execute(
    sql.raw(`UPDATE spoke_tasks SET ${sets.join(", ")} WHERE id = '${id}' RETURNING *`),
  ) as unknown as RawResult;
  return rowToSpokeTask(result.rows[0]);
}

export async function listTasksByDevice(deviceId: string): Promise<SpokeTask[]> {
  const db = getDb();
  const result = await db.execute(
    sql.raw(`SELECT * FROM spoke_tasks WHERE device_id = '${deviceId}' ORDER BY created_at DESC`),
  ) as unknown as RawResult;
  return result.rows.map(rowToSpokeTask);
}
