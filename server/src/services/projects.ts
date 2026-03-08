/**
 * projects service — CRUD using Drizzle ORM against the `projects` table.
 *
 * DB schema: id, companyId, name, description, color, status, archived, createdAt, updatedAt.
 * Public Project interface adds: startDate, endDate, metadata (not in schema).
 * Extra fields are packed into the description column using a JSON sentinel, same
 * pattern as goals.ts.
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
// Serialization helpers — pack extra fields into the description column
// ---------------------------------------------------------------------------

const META_PREFIX = "__PROJECT_META__:";
const META_SUFFIX = ":__END__";

interface ProjectMeta {
  description?: string;
  startDate?: string;
  endDate?: string;
  metadata: Record<string, unknown>;
}

function packDescription(project: {
  description?: string;
  startDate?: string;
  endDate?: string;
  metadata: Record<string, unknown>;
}): string | null {
  const meta: ProjectMeta = {
    description: project.description,
    startDate: project.startDate,
    endDate: project.endDate,
    metadata: project.metadata,
  };
  // Only pack if there's something beyond plain description
  const hasExtras = meta.startDate || meta.endDate || Object.keys(meta.metadata).length > 0;
  if (!hasExtras && meta.description !== undefined) {
    // Can store plain if no extras — but use packed format for consistency
  }
  return `${META_PREFIX}${JSON.stringify(meta)}${META_SUFFIX}`;
}

function unpackDescription(raw: string | null | undefined): ProjectMeta {
  if (raw && raw.startsWith(META_PREFIX) && raw.endsWith(META_SUFFIX)) {
    try {
      const jsonStr = raw.slice(META_PREFIX.length, raw.length - META_SUFFIX.length);
      return JSON.parse(jsonStr) as ProjectMeta;
    } catch {
      // fall through to default
    }
  }
  return {
    description: raw ?? undefined,
    metadata: {},
  };
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

type ProjectRow = typeof projectsTable.$inferSelect;

function rowToProject(row: ProjectRow): Project {
  const meta = unpackDescription(row.description);
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: meta.description,
    status: (row.status as Project["status"]) ?? "active",
    startDate: meta.startDate,
    endDate: meta.endDate,
    color: row.color ?? undefined,
    metadata: meta.metadata ?? {},
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

  const descriptionPacked = packDescription({
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate,
    metadata: input.metadata ?? {},
  });

  const [row] = await db
    .insert(projectsTable)
    .values({
      companyId,
      name: input.name,
      description: descriptionPacked,
      color: input.color ?? null,
      status: input.status ?? "active",
      archived: false,
    })
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
    description: input.description !== undefined ? input.description : current.description,
    startDate: input.startDate !== undefined ? input.startDate : current.startDate,
    endDate: input.endDate !== undefined ? input.endDate : current.endDate,
    metadata: input.metadata !== undefined
      ? { ...current.metadata, ...input.metadata }
      : current.metadata,
  };

  const descriptionPacked = packDescription(merged);

  const [row] = await db
    .update(projectsTable)
    .set({
      name: input.name !== undefined ? input.name : current.name,
      description: descriptionPacked,
      color: input.color !== undefined ? (input.color ?? null) : (current.color ?? null),
      status: input.status !== undefined ? input.status : current.status,
      updatedAt: new Date(),
    })
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
