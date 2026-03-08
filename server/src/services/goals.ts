/**
 * goals service — CRUD using Drizzle ORM against the `goals` table.
 *
 * The DB schema has: id, companyId, title, description, parentId, status, metadata (JSONB),
 * createdAt, updatedAt.
 *
 * The public Goal interface preserves all fields from the in-memory version, with extra fields
 * (targetDate, projectId, parentGoalId, metricType, metricTarget, metricCurrent, metadata)
 * stored in the JSONB `metadata` column. Plain text description is stored in the `description`
 * column directly.
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
// Metadata helpers — pack/unpack extended fields into the JSONB metadata column
// ---------------------------------------------------------------------------

interface GoalMetadata {
  targetDate?: string;
  projectId?: string;
  parentGoalId?: string;
  metricType: "boolean" | "numeric" | "percentage";
  metricTarget?: number;
  metricCurrent: number;
  extra: Record<string, unknown>;
}

function buildMetadata(input: {
  targetDate?: string;
  projectId?: string;
  parentGoalId?: string;
  metricType: "boolean" | "numeric" | "percentage";
  metricTarget?: number;
  metricCurrent: number;
  metadata: Record<string, unknown>;
}): GoalMetadata {
  return {
    targetDate: input.targetDate,
    projectId: input.projectId,
    parentGoalId: input.parentGoalId,
    metricType: input.metricType,
    metricTarget: input.metricTarget,
    metricCurrent: input.metricCurrent,
    extra: input.metadata,
  };
}

function parseMetadata(raw: unknown): GoalMetadata {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return {
      targetDate: (obj.targetDate as string) ?? undefined,
      projectId: (obj.projectId as string) ?? undefined,
      parentGoalId: (obj.parentGoalId as string) ?? undefined,
      metricType: (obj.metricType as GoalMetadata["metricType"]) ?? "boolean",
      metricTarget: (obj.metricTarget as number) ?? undefined,
      metricCurrent: (obj.metricCurrent as number) ?? 0,
      extra: (obj.extra as Record<string, unknown>) ?? {},
    };
  }
  return {
    metricType: "boolean",
    metricCurrent: 0,
    extra: {},
  };
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

type GoalRow = typeof goalsTable.$inferSelect;

function rowToGoal(row: GoalRow): Goal {
  const meta = parseMetadata((row as any).metadata);
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    description: row.description ?? undefined,
    status: (row.status as Goal["status"]) ?? "draft",
    targetDate: meta.targetDate,
    projectId: meta.projectId,
    parentGoalId: meta.parentGoalId ?? row.parentId ?? undefined,
    metricType: meta.metricType ?? "boolean",
    metricTarget: meta.metricTarget,
    metricCurrent: meta.metricCurrent ?? 0,
    metadata: meta.extra ?? {},
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

  const metadata = buildMetadata({
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
      description: input.description ?? null,
      parentId: input.parentGoalId ?? null,
      status: input.status ?? "draft",
      metadata,
    } as any)
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

  const metadata = buildMetadata(merged);

  const [row] = await db
    .update(goalsTable)
    .set({
      title: input.title !== undefined ? input.title : current.title,
      description: input.description !== undefined ? (input.description ?? null) : (current.description ?? null),
      parentId: merged.parentGoalId ?? null,
      status: input.status !== undefined ? input.status : current.status,
      metadata,
      updatedAt: new Date(),
    } as any)
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
