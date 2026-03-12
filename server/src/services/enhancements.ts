/**
 * Enhancements service — internal task tracking for development.
 * Stores the full enhancement plan in the DB so context can be loaded
 * efficiently across sessions.
 */
import { getDb } from "../db.js";
import { sql } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw SQL result type varies by driver
type RawResult = { rows: Record<string, unknown>[] };

export interface Enhancement {
  id: string;
  parentId: string | null;
  phase: string;
  category: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  sortOrder: number;
  files: string[];
  tests: string[];
  dependsOn: string[];
  notes: string | null;
  codeGenerated: boolean;
  codeTested: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toISOString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function rowToEnhancement(row: Record<string, unknown>): Enhancement {
  return {
    id: row.id as string,
    parentId: row.parent_id as string | null,
    phase: row.phase as string,
    category: row.category as string,
    title: row.title as string,
    description: row.description as string | null,
    status: row.status as string,
    priority: row.priority as number,
    sortOrder: row.sort_order as number,
    files: (row.files as string[]) ?? [],
    tests: (row.tests as string[]) ?? [],
    dependsOn: (row.depends_on as string[]) ?? [],
    notes: row.notes as string | null,
    codeGenerated: Boolean(row.code_generated),
    codeTested: Boolean(row.code_tested),
    startedAt: row.started_at ? toISOString(row.started_at) : null,
    completedAt: row.completed_at ? toISOString(row.completed_at) : null,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
  };
}

export async function listEnhancements(filters?: {
  phase?: string;
  status?: string;
  category?: string;
  parentId?: string | null;
}): Promise<Enhancement[]> {
  const db = getDb();
  const conditions: string[] = [];
  if (filters?.phase) conditions.push(`phase = '${filters.phase}'`);
  if (filters?.status) conditions.push(`status = '${filters.status}'`);
  if (filters?.category) conditions.push(`category = '${filters.category}'`);
  if (filters?.parentId !== undefined) {
    conditions.push(
      filters.parentId === null
        ? `parent_id IS NULL`
        : `parent_id = '${filters.parentId}'`,
    );
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.execute(
    sql.raw(`SELECT * FROM enhancements ${where} ORDER BY phase, sort_order, priority DESC, created_at`),
  ) as unknown as RawResult;
  return result.rows.map(rowToEnhancement);
}

export async function getEnhancement(id: string): Promise<Enhancement | null> {
  const db = getDb();
  const result = await db.execute(
    sql.raw(`SELECT * FROM enhancements WHERE id = '${id}'`),
  ) as unknown as RawResult;
  const row = result.rows[0];
  return row ? rowToEnhancement(row) : null;
}

export async function createEnhancement(data: {
  parentId?: string | null;
  phase: string;
  category: string;
  title: string;
  description?: string;
  status?: string;
  priority?: number;
  sortOrder?: number;
  files?: string[];
  tests?: string[];
  dependsOn?: string[];
  notes?: string;
  codeGenerated?: boolean;
  codeTested?: boolean;
}): Promise<Enhancement> {
  const db = getDb();
  const result = await db.execute(sql.raw(`
    INSERT INTO enhancements (parent_id, phase, category, title, description, status, priority, sort_order, files, tests, depends_on, notes, code_generated, code_tested)
    VALUES (
      ${data.parentId ? `'${data.parentId}'` : "NULL"},
      '${data.phase}',
      '${data.category}',
      '${data.title.replace(/'/g, "''")}',
      ${data.description ? `'${data.description.replace(/'/g, "''")}'` : "NULL"},
      '${data.status ?? "pending"}',
      ${data.priority ?? 50},
      ${data.sortOrder ?? 0},
      '${JSON.stringify(data.files ?? [])}'::jsonb,
      '${JSON.stringify(data.tests ?? [])}'::jsonb,
      '${JSON.stringify(data.dependsOn ?? [])}'::jsonb,
      ${data.notes ? `'${data.notes.replace(/'/g, "''")}'` : "NULL"},
      ${data.codeGenerated ?? false},
      ${data.codeTested ?? false}
    )
    RETURNING *
  `)) as unknown as RawResult;
  return rowToEnhancement(result.rows[0]);
}

export async function updateEnhancement(
  id: string,
  data: Partial<{
    status: string;
    notes: string;
    priority: number;
    sortOrder: number;
    codeGenerated: boolean;
    codeTested: boolean;
  }>,
): Promise<Enhancement | null> {
  const db = getDb();
  const sets: string[] = [];
  if (data.status !== undefined) {
    sets.push(`status = '${data.status}'`);
    if (data.status === "in_progress") sets.push(`started_at = now()`);
    if (data.status === "done") sets.push(`completed_at = now()`);
  }
  if (data.notes !== undefined) sets.push(`notes = '${data.notes.replace(/'/g, "''")}'`);
  if (data.priority !== undefined) sets.push(`priority = ${data.priority}`);
  if (data.sortOrder !== undefined) sets.push(`sort_order = ${data.sortOrder}`);
  if (data.codeGenerated !== undefined) sets.push(`code_generated = ${data.codeGenerated}`);
  if (data.codeTested !== undefined) sets.push(`code_tested = ${data.codeTested}`);
  sets.push(`updated_at = now()`);

  const result = await db.execute(
    sql.raw(`UPDATE enhancements SET ${sets.join(", ")} WHERE id = '${id}' RETURNING *`),
  ) as unknown as RawResult;
  const row = result.rows[0];
  return row ? rowToEnhancement(row) : null;
}

export async function deleteAll(): Promise<void> {
  const db = getDb();
  await db.execute(sql.raw(`DELETE FROM enhancements`));
}

export async function getStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byPhase: Record<string, number>;
}> {
  const db = getDb();
  const totalResult = await db.execute(sql.raw(`SELECT count(*) as cnt FROM enhancements`)) as unknown as RawResult;
  const statusResult = await db.execute(
    sql.raw(`SELECT status, count(*) as cnt FROM enhancements GROUP BY status`),
  ) as unknown as RawResult;
  const phaseResult = await db.execute(
    sql.raw(`SELECT phase, count(*) as cnt FROM enhancements GROUP BY phase`),
  ) as unknown as RawResult;

  const byStatus: Record<string, number> = {};
  for (const r of statusResult.rows) {
    byStatus[r.status as string] = Number(r.cnt);
  }
  const byPhase: Record<string, number> = {};
  for (const r of phaseResult.rows) {
    byPhase[r.phase as string] = Number(r.cnt);
  }

  return {
    total: Number(totalResult.rows[0].cnt),
    byStatus,
    byPhase,
  };
}
