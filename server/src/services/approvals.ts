import { getDb } from "../db.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { approvals } from "@seaclip/db";
import { notFound, conflict } from "../errors.js";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface Approval {
  id: string;
  companyId: string;
  agentId?: string;
  issueId?: string;
  title: string;
  description?: string;
  requestedById?: string;
  resolvedById?: string;
  status: ApprovalStatus;
  decision?: "approved" | "rejected";
  reason?: string;
  requestedAt: string;
  resolvedAt?: string;
  expiresAt?: string;
  metadata: Record<string, unknown>;
}

export interface CreateApprovalInput {
  agentId?: string;
  issueId?: string;
  title: string;
  description?: string;
  requestedById?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ResolveApprovalInput {
  decision: "approved" | "rejected";
  reason?: string;
  resolvedById?: string;
}

export interface ListApprovalsOptions {
  status: string;
  page: number;
  limit: number;
}

/**
 * Map a DB row back to the Approval interface.
 *
 * DB schema mapping:
 *   type                 → stored as "approval" (generic); title/description are in requestPayload JSONB
 *   requestedByAgentId   → agentId (the requesting agent)
 *   requestPayload       → JSONB containing { title, description, issueId, requestedById, expiresAt, metadata, agentId }
 *   resolution           → text containing the decision ("approved" | "rejected") or reason packed as JSON
 *   resolvedByUserId     → resolvedById
 *   resolvedAt           → resolvedAt
 *   status               → status
 */
function rowToApproval(row: typeof approvals.$inferSelect): Approval {
  const payload = (row.requestPayload ?? {}) as Record<string, unknown>;

  let decision: "approved" | "rejected" | undefined;
  let reason: string | undefined;

  if (row.resolution) {
    try {
      const res = JSON.parse(row.resolution) as Record<string, unknown>;
      if (res.decision === "approved" || res.decision === "rejected") {
        decision = res.decision;
      }
      if (typeof res.reason === "string") reason = res.reason;
    } catch {
      // resolution stored as plain decision string
      if (row.resolution === "approved" || row.resolution === "rejected") {
        decision = row.resolution as "approved" | "rejected";
      }
    }
  }

  return {
    id: row.id,
    companyId: row.companyId,
    agentId: typeof payload.agentId === "string" ? payload.agentId : row.requestedByAgentId,
    issueId: typeof payload.issueId === "string" ? payload.issueId : undefined,
    title: typeof payload.title === "string" ? payload.title : "",
    description: typeof payload.description === "string" ? payload.description : undefined,
    requestedById: typeof payload.requestedById === "string" ? payload.requestedById : undefined,
    resolvedById: row.resolvedByUserId ?? undefined,
    status: row.status as ApprovalStatus,
    decision,
    reason,
    requestedAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
    expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined,
    metadata: typeof payload.metadata === "object" && payload.metadata !== null
      ? (payload.metadata as Record<string, unknown>)
      : {},
  };
}

export async function createApproval(
  companyId: string,
  input: CreateApprovalInput,
): Promise<Approval> {
  const db = getDb();

  const requestPayload: Record<string, unknown> = {
    title: input.title,
    metadata: input.metadata ?? {},
  };
  if (input.agentId) requestPayload.agentId = input.agentId;
  if (input.issueId) requestPayload.issueId = input.issueId;
  if (input.description) requestPayload.description = input.description;
  if (input.requestedById) requestPayload.requestedById = input.requestedById;
  if (input.expiresAt) requestPayload.expiresAt = input.expiresAt;

  const [row] = await db
    .insert(approvals)
    .values({
      companyId,
      type: "approval",
      status: "pending",
      // requestedByAgentId is NOT NULL in schema; use agentId if provided, else a placeholder
      requestedByAgentId: input.agentId ?? companyId,
      requestPayload,
    })
    .returning();

  return rowToApproval(row);
}

export async function listApprovals(
  companyId: string,
  options: ListApprovalsOptions,
): Promise<{ data: Approval[]; total: number; page: number; limit: number }> {
  const db = getDb();

  const conditions = [eq(approvals.companyId, companyId)];
  if (options.status && options.status !== "all") {
    conditions.push(eq(approvals.status, options.status));
  }

  const where = and(...conditions);

  const [{ total }] = await db
    .select({ total: sql<number>`cast(count(*) as int)` })
    .from(approvals)
    .where(where);

  const offset = (options.page - 1) * options.limit;

  const rows = await db
    .select()
    .from(approvals)
    .where(where)
    .orderBy(desc(approvals.createdAt))
    .limit(options.limit)
    .offset(offset);

  return {
    data: rows.map(rowToApproval),
    total,
    page: options.page,
    limit: options.limit,
  };
}

export async function resolveApproval(
  companyId: string,
  id: string,
  input: ResolveApprovalInput,
): Promise<Approval> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, id), eq(approvals.companyId, companyId)));

  if (!existing) {
    throw notFound(`Approval "${id}" not found`);
  }

  if (existing.status !== "pending") {
    throw conflict(
      `Approval "${id}" is already in status "${existing.status}" and cannot be resolved`,
    );
  }

  // Check expiry (stored in requestPayload)
  const payload = (existing.requestPayload ?? {}) as Record<string, unknown>;
  if (typeof payload.expiresAt === "string" && new Date(payload.expiresAt) < new Date()) {
    throw conflict(`Approval "${id}" has expired`);
  }

  const resolution = JSON.stringify({ decision: input.decision, reason: input.reason });

  const [row] = await db
    .update(approvals)
    .set({
      status: input.decision,
      resolution,
      resolvedByUserId: input.resolvedById ?? null,
      resolvedAt: new Date(),
    })
    .where(eq(approvals.id, id))
    .returning();

  return rowToApproval(row);
}

export async function cancelApproval(
  companyId: string,
  id: string,
): Promise<Approval> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, id), eq(approvals.companyId, companyId)));

  if (!existing) {
    throw notFound(`Approval "${id}" not found`);
  }
  if (existing.status !== "pending") {
    throw conflict(`Cannot cancel approval in status "${existing.status}"`);
  }

  const [row] = await db
    .update(approvals)
    .set({
      status: "cancelled",
      resolvedAt: new Date(),
    })
    .where(eq(approvals.id, id))
    .returning();

  return rowToApproval(row);
}
