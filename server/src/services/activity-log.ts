/**
 * activity-log service — insert activity entries, query with pagination.
 */
import { getDb } from "../db.js";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { activityLog } from "@seaclip/db";

export interface ActivityEntry {
  id: string;
  companyId: string;
  eventType: string;
  agentId?: string;
  issueId?: string;
  projectId?: string;
  actorId?: string;
  actorType: "human" | "agent" | "system";
  summary: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface GetActivityLogOptions {
  page: number;
  limit: number;
  agentId?: string;
  issueId?: string;
  eventType?: string;
  from?: string;
  to?: string;
}

export interface ActivityLogPage {
  data: ActivityEntry[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

/**
 * Map a DB row back to the ActivityEntry interface.
 *
 * DB schema columns used:
 *   action       → eventType
 *   detail       → JSONB containing { summary, payload, agentId, issueId, projectId }
 *   actorId      → actorId
 *   actorType    → actorType
 *   createdAt    → occurredAt
 *   entityType   → used to store which entity field is populated ("agent"|"issue"|"project")
 *   entityId     → the entity id value
 */
function rowToEntry(row: typeof activityLog.$inferSelect): ActivityEntry {
  const detail = (row.detail ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    companyId: row.companyId,
    eventType: row.action,
    actorId: row.actorId !== "" ? row.actorId : undefined,
    actorType: row.actorType as ActivityEntry["actorType"],
    agentId: typeof detail.agentId === "string" ? detail.agentId : undefined,
    issueId: typeof detail.issueId === "string" ? detail.issueId : undefined,
    projectId: typeof detail.projectId === "string" ? detail.projectId : undefined,
    summary: typeof detail.summary === "string" ? detail.summary : "",
    payload: typeof detail.payload === "object" && detail.payload !== null
      ? (detail.payload as Record<string, unknown>)
      : {},
    occurredAt: row.createdAt.toISOString(),
  };
}

export async function insertActivity(
  entry: Omit<ActivityEntry, "id" | "occurredAt">,
): Promise<ActivityEntry> {
  const db = getDb();

  const detail: Record<string, unknown> = {
    summary: entry.summary,
    payload: entry.payload,
  };
  if (entry.agentId) detail.agentId = entry.agentId;
  if (entry.issueId) detail.issueId = entry.issueId;
  if (entry.projectId) detail.projectId = entry.projectId;

  // Determine entityType / entityId from the most specific entity present
  let entityType: string | null = null;
  let entityId: string | null = null;
  if (entry.agentId) {
    entityType = "agent";
    entityId = entry.agentId;
  } else if (entry.issueId) {
    entityType = "issue";
    entityId = entry.issueId;
  } else if (entry.projectId) {
    entityType = "project";
    entityId = entry.projectId;
  }

  const [row] = await db
    .insert(activityLog)
    .values({
      companyId: entry.companyId,
      actorType: entry.actorType,
      actorId: entry.actorId ?? "",
      action: entry.eventType,
      entityType,
      entityId,
      detail,
    })
    .returning();

  return rowToEntry(row);
}

export async function getActivityLog(
  companyId: string,
  options: GetActivityLogOptions,
): Promise<ActivityLogPage> {
  const db = getDb();

  const conditions = [eq(activityLog.companyId, companyId)];

  if (options.eventType) {
    conditions.push(eq(activityLog.action, options.eventType));
  }
  if (options.from) {
    conditions.push(gte(activityLog.createdAt, new Date(options.from)));
  }
  if (options.to) {
    conditions.push(lte(activityLog.createdAt, new Date(options.to)));
  }

  const where = and(...conditions);

  // Count total
  const [{ total }] = await db
    .select({ total: sql<number>`cast(count(*) as int)` })
    .from(activityLog)
    .where(where);

  const offset = (options.page - 1) * options.limit;

  let rows = await db
    .select()
    .from(activityLog)
    .where(where)
    .orderBy(desc(activityLog.createdAt))
    .limit(options.limit)
    .offset(offset);

  // Apply in-process agentId / issueId filters (stored inside the JSONB detail)
  let data = rows.map(rowToEntry);

  if (options.agentId) {
    data = data.filter((e) => e.agentId === options.agentId);
  }
  if (options.issueId) {
    data = data.filter((e) => e.issueId === options.issueId);
  }

  return {
    data,
    total,
    page: options.page,
    limit: options.limit,
    hasNextPage: offset + data.length < total,
  };
}
