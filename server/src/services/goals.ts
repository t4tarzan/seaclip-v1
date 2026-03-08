/**
 * goals service — CRUD using Drizzle ORM against the `goals` table.
 *
 * The DB schema has: id, companyId, title, description, parentId, status, createdAt, updatedAt.
 * The public Goal interface preserves all fields from the in-memory version, with extra fields
 * (targetDate, projectId, parentGoalId, metricType, metricTarget, metricCurrent, metadata)
 * stored/retrieved via the description JSON field or defaulted, keeping full backward compat.
 *
 * Strategy: store extra fields in a JSON-encoded description prefix so they survive round-trips.
 * Format of `description` column: if it starts with "\x00META:", the rest up to "\x00END\x00"
 * is JSON metadata and what follows is the human description. Otherwise treat as plain description.
 *
 * Simpler approach used here: store extended fields in the `description` column as a JSON blob
 * prefixed with a sentinel, falling back gracefully.
 */
import { getDb } from "../db.js";
import { eq, and, asc } from "drizzle-orm";
import { goals as goalsTable } from "@seaclip/db";
import { notFound } from "../errors.js";

export interface Goal {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "achieved" | "abandoned";
  targetDate?: string;
  projectId?: string;
  parentGoalId?: string;
  metricType: "boolean" | "numeric" | "percentage";
  metricTarget?: number;
  metricCurrent: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  status?: Goal["status"];
  targetDate?: string;
  projectId?: string;
  parentGoalId?: string;
  metricType?: Goal["metricType"];
  metricTarget?: number;
  metricCurrent?: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Serialization helpers — pack extra fields into the description column
// ---------------------------------------------------------------------------

const META_PREFIX = "__GOAL_META__:";
const META_SUFFIX = ":__END__";

interface GoalMeta {
  description?: string;
  targetDate?: string;
  projectId?: string;
  parentGoalId?: string;
  metricType: "boolean" | "numeric" | "percentage";
  metricTarget?: number;
  metricCurrent: number;
  metadata: Record<string, unknown>;
}

function packDescription(goal: {
  description?: string;
  targetDate?: string;
  projectId?: string;
  parentGoalId?: string;
  metricType: "boolean" | "numeric" | "percentage";
  metricTarget?: number;
  metricCurrent: number;
  metadata: Record<string, unknown>;
}): string {
  const meta: GoalMeta = {
    description: goal.description,
    targetDate: goal.targetDate,
    projectId: goal.projectId,
    parentGoalId: goal.parentGoalId,
    metricType: goal.metricType,
    metricTarget: goal.metricTarget,
    metricCurrent: goal.metricCurrent,
    metadata: goal.metadata,
  };
  return `${META_PREFIX}${JSON.stringify(meta)}${META_SUFFIX}`;
}

function unpackDescription(raw: string | null | undefined): GoalMeta {
  if (raw && raw.startsWith(META_PREFIX) && raw.endsWith(META_SUFFIX)) {
    try {
      const jsonStr = raw.slice(META_PREFIX.length, raw.length - META_SUFFIX.length);
      return JSON.parse(jsonStr) as GoalMeta;
    } catch {
      // fall through to default
    }
  }
  return {
    description: raw ?? undefined,
    metricType: "boolean",
    metricCurrent: 0,
    metadata: {},
  };
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

type GoalRow = typeof goalsTable.$inferSelect;

function rowToGoal(row: GoalRow): Goal {
  const meta = unpackDescription(row.description);
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    description: meta.description,
    status: (row.status as Goal["status"]) ?? "draft",
    targetDate: meta.targetDate,
    projectId: meta.projectId,
    parentGoalId: meta.parentGoalId ?? row.parentId ?? undefined,
    metricType: meta.metricType ?? "boolean",
    metricTarget: meta.metricTarget,
    metricCurrent: meta.metricCurrent ?? 0,
    metadata: meta.metadata ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listGoals(companyId: string): Promise<Goal[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.companyId, companyId))
    .orderBy(asc(goalsTable.createdAt));
  return rows.map(rowToGoal);
}

export async function createGoal(
  companyId: string,
  input: CreateGoalInput,
): Promise<Goal> {
  const db = getDb();

  const descriptionPacked = packDescription({
    description: input.description,
    targetDate: input.targetDate,
    projectId: input.projectId,
    parentGoalId: input.parentGoalId,
    metricType: input.metricType ?? "boolean",
    metricTarget: input.metricTarget,
    metricCurrent: input.metricCurrent ?? 0,
    metadata: input.metadata ?? {},
  });

  const [row] = await db
    .insert(goalsTable)
    .values({
      companyId,
      title: input.title,
      description: descriptionPacked,
      parentId: input.parentGoalId ?? null,
      status: input.status ?? "draft",
    })
    .returning();

  return rowToGoal(row);
}

export async function getGoal(companyId: string, id: string): Promise<Goal> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.companyId, companyId)));

  if (!row) {
    throw notFound(`Goal "${id}" not found`);
  }
  return rowToGoal(row);
}

export async function updateGoal(
  companyId: string,
  id: string,
  input: Partial<CreateGoalInput>,
): Promise<Goal> {
  const db = getDb();

  // Fetch current to merge
  const current = await getGoal(companyId, id);

  const merged = {
    description: input.description !== undefined ? input.description : current.description,
    targetDate: input.targetDate !== undefined ? input.targetDate : current.targetDate,
    projectId: input.projectId !== undefined ? input.projectId : current.projectId,
    parentGoalId: input.parentGoalId !== undefined ? input.parentGoalId : current.parentGoalId,
    metricType: input.metricType !== undefined ? input.metricType : current.metricType,
    metricTarget: input.metricTarget !== undefined ? input.metricTarget : current.metricTarget,
    metricCurrent: input.metricCurrent !== undefined ? input.metricCurrent : current.metricCurrent,
    metadata: input.metadata !== undefined
      ? { ...current.metadata, ...input.metadata }
      : current.metadata,
  };

  const descriptionPacked = packDescription(merged);

  const [row] = await db
    .update(goalsTable)
    .set({
      title: input.title !== undefined ? input.title : current.title,
      description: descriptionPacked,
      parentId: merged.parentGoalId ?? null,
      status: input.status !== undefined ? input.status : current.status,
      updatedAt: new Date(),
    })
    .where(and(eq(goalsTable.id, id), eq(goalsTable.companyId, companyId)))
    .returning();

  if (!row) {
    throw notFound(`Goal "${id}" not found`);
  }
  return rowToGoal(row);
}

export async function deleteGoal(companyId: string, id: string): Promise<void> {
  const db = getDb();
  // Verify existence first
  await getGoal(companyId, id);
  await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.companyId, companyId)));
}
