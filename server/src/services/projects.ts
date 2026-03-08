/**
 * projects service — CRUD using Drizzle ORM against the `projects` table.
 *
 * DB schema: id, companyId, name, description, color, status, archived, metadata (JSONB),
 * createdAt, updatedAt.
 *
 * Extra fields (startDate, endDate, user metadata) are stored in the JSONB `metadata` column.
 * Plain text description is stored in the `description` column directly.
 */
import { getDb } from "../db.js";
import { eq, and, asc } from "drizzle-orm";
import { projects as projectsTable } from "@seaclip/db";
import { notFound } from "../errors.js";

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  status: "active" | "paused" | "completed" | "archived";
  startDate?: string;
  endDate?: string;
  color?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: Project["status"];
  startDate?: string;
  endDate?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Metadata helpers — pack/unpack extended fields into the JSONB metadata column
// ---------------------------------------------------------------------------

interface ProjectMetadata {
  startDate?: string;
  endDate?: string;
  extra: Record<string, unknown>;
}

function buildMetadata(input: {
  startDate?: string;
  endDate?: string;
  metadata: Record<string, unknown>;
}): ProjectMetadata {
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    extra: input.metadata,
  };
}

function parseMetadata(raw: unknown): ProjectMetadata {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return {
      startDate: (obj.startDate as string) ?? undefined,
      endDate: (obj.endDate as string) ?? undefined,
      extra: (obj.extra as Record<string, unknown>) ?? {},
    };
  }
  return {
    extra: {},
  };
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

type ProjectRow = typeof projectsTable.$inferSelect;

function rowToProject(row: ProjectRow): Project {
  const meta = parseMetadata((row as any).metadata);
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description ?? undefined,
    status: (row.status as Project["status"]) ?? "active",
    startDate: meta.startDate,
    endDate: meta.endDate,
    color: row.color ?? undefined,
    metadata: meta.extra ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listProjects(companyId: string): Promise<Project[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.companyId, companyId))
    .orderBy(asc(projectsTable.createdAt));
  return rows.map(rowToProject);
}

export async function createProject(
  companyId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const db = getDb();

  const metadata = buildMetadata({
    startDate: input.startDate,
    endDate: input.endDate,
    metadata: input.metadata ?? {},
  });

  const [row] = await db
    .insert(projectsTable)
    .values({
      companyId,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? null,
      status: input.status ?? "active",
      archived: false,
      metadata,
    } as any)
    .returning();

  return rowToProject(row);
}

export async function getProject(companyId: string, id: string): Promise<Project> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.companyId, companyId)));

  if (!row) {
    throw notFound(`Project "${id}" not found`);
  }
  return rowToProject(row);
}

export async function updateProject(
  companyId: string,
  id: string,
  input: Partial<CreateProjectInput>,
): Promise<Project> {
  const db = getDb();

  // Fetch current to merge
  const current = await getProject(companyId, id);

  const merged = {
    startDate: input.startDate !== undefined ? input.startDate : current.startDate,
    endDate: input.endDate !== undefined ? input.endDate : current.endDate,
    metadata: input.metadata !== undefined
      ? { ...current.metadata, ...input.metadata }
      : current.metadata,
  };

  const metadata = buildMetadata(merged);

  const [row] = await db
    .update(projectsTable)
    .set({
      name: input.name !== undefined ? input.name : current.name,
      description: input.description !== undefined ? (input.description ?? null) : (current.description ?? null),
      color: input.color !== undefined ? (input.color ?? null) : (current.color ?? null),
      status: input.status !== undefined ? input.status : current.status,
      metadata,
      updatedAt: new Date(),
    } as any)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.companyId, companyId)))
    .returning();

  if (!row) {
    throw notFound(`Project "${id}" not found`);
  }
  return rowToProject(row);
}

export async function deleteProject(companyId: string, id: string): Promise<void> {
  const db = getDb();
  // Verify existence first
  await getProject(companyId, id);
  await db
    .delete(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.companyId, companyId)));
}
