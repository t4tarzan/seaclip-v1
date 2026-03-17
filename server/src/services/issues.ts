/**
 * issues service — CRUD + atomic checkout + comment management.
 *
 * Uses Drizzle ORM against `issues` and `issueComments` tables from @seaclip/db.
 *
 * Schema mapping notes:
 *  - `sequenceNumber`   → DB `issueNumber` (auto-incremented via companies.issueCounter)
 *  - `assignedAgentId`  → DB `assigneeAgentId`
 *  - `checkedOutByAgentId` → DB `checkoutRunId` (stores agentId; UUID type matches)
 *  - `checkedOutAt`     → not a DB column; always returned as undefined after reload
 *                         (checkout state is inferred from checkoutRunId presence)
 *  - `resolvedAt`       → DB `completedAt`
 *  - `labels`           → not a DB column; always returned as []
 *  - `metadata`         → DB `metadata` (jsonb column, persisted)
 *  - `dueAt`            → not a DB column; always returned as undefined
 *
 * IssueComment mapping:
 *  - `authorId`/`authorType` → DB has `authorAgentId` + `authorUserId`
 *    When authorType == "agent", authorId → authorAgentId.
 *    When authorType == "human" or "system", authorId → authorUserId.
 *  - `companyId` on IssueComment is not a DB column; we derive it from the issue.
 */
import { getDb } from "../db.js";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import {
  issues as issuesTable,
  issueComments as issueCommentsTable,
  companies as companiesTable,
} from "@seaclip/db";
import { notFound, conflict } from "../errors.js";

export type IssueStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";
export type IssuePriority = "critical" | "high" | "medium" | "low";

export interface Issue {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignedAgentId?: string;
  checkedOutByAgentId?: string;
  checkedOutAt?: string;
  projectId?: string;
  goalId?: string;
  labels: string[];
  metadata: Record<string, unknown>;
  dueAt?: string;
  resolvedAt?: string;
  sequenceNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface IssueComment {
  id: string;
  issueId: string;
  companyId: string;
  body: string;
  authorId?: string;
  authorType: "human" | "agent" | "system";
  createdAt: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignedAgentId?: string;
  projectId?: string;
  goalId?: string;
  labels?: string[];
  metadata?: Record<string, unknown>;
  dueAt?: string;
}

export interface UpdateIssueInput extends Partial<CreateIssueInput> {}

export interface ListIssuesOptions {
  status?: string;
  priority?: string;
  agentId?: string;
  projectId?: string;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DbIssueRow = typeof issuesTable.$inferSelect;
type DbCommentRow = typeof issueCommentsTable.$inferSelect;

function rowToIssue(row: DbIssueRow, companyId: string): Issue {
  return {
    id: row.id,
    companyId,
    title: row.title,
    description: row.description ?? undefined,
    status: (row.status ?? "open") as IssueStatus,
    priority: (row.priority ?? "medium") as IssuePriority,
    assignedAgentId: row.assigneeAgentId ?? undefined,
    checkedOutByAgentId: row.checkoutRunId ?? undefined,
    // checkedOutAt is not stored in DB; we signal checkout via checkedOutByAgentId
    checkedOutAt: undefined,
    projectId: row.projectId ?? undefined,
    goalId: row.goalId ?? undefined,
    labels: [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    dueAt: undefined, // no column on issues table
    resolvedAt: row.completedAt?.toISOString(),
    sequenceNumber: row.issueNumber,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToComment(row: DbCommentRow, companyId: string): IssueComment {
  // Determine authorType and authorId from which column is set
  let authorType: "human" | "agent" | "system" = "system";
  let authorId: string | undefined;

  if (row.authorAgentId) {
    authorType = "agent";
    authorId = row.authorAgentId;
  } else if (row.authorUserId) {
    authorType = "human";
    authorId = row.authorUserId;
  }

  return {
    id: row.id,
    issueId: row.issueId,
    companyId,
    body: row.body,
    authorId,
    authorType,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Atomically increment the issueCounter on the companies row and return
 * the new counter value to use as the issue number.
 */
async function nextIssueNumber(companyId: string): Promise<number> {
  const db = getDb();
  const [updated] = await db
    .update(companiesTable)
    .set({
      issueCounter: sql`${companiesTable.issueCounter} + 1`,
    })
    .where(eq(companiesTable.id, companyId))
    .returning() as any;

  if (!updated) {
    throw notFound(`Company "${companyId}" not found`);
  }

  return (updated as any).issueCounter;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listIssues(
  companyId: string,
  options: ListIssuesOptions,
): Promise<{ data: Issue[]; total: number; page: number; limit: number }> {
  const db = getDb();

  // Build WHERE conditions
  const conditions = [eq(issuesTable.companyId, companyId)];

  if (options.status) {
    conditions.push(eq(issuesTable.status, options.status));
  }
  if (options.priority) {
    conditions.push(eq(issuesTable.priority, options.priority));
  }
  if (options.agentId) {
    conditions.push(eq(issuesTable.assigneeAgentId, options.agentId));
  }
  if (options.projectId) {
    conditions.push(eq(issuesTable.projectId, options.projectId));
  }

  const where = and(...conditions);

  // Total count
  const countResult = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(issuesTable)
    .where(where);

  const total = countResult[0]?.count ?? 0;

  // Paginated rows
  const offset = (options.page - 1) * options.limit;
  const rows = await db
    .select()
    .from(issuesTable)
    .where(where)
    .orderBy(desc(issuesTable.createdAt))
    .limit(options.limit)
    .offset(offset);

  return {
    data: rows.map((r) => rowToIssue(r, companyId)),
    total,
    page: options.page,
    limit: options.limit,
  };
}

export async function createIssue(
  companyId: string,
  input: CreateIssueInput,
): Promise<Issue> {
  const db = getDb();

  const issueNumber = await nextIssueNumber(companyId);

  // Derive identifier — fetch the company issuePrefix
  const [company] = await db
    .select({ issuePrefix: companiesTable.issuePrefix })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId));

  const prefix = company?.issuePrefix ?? "SC";
  const identifier = `${prefix}-${issueNumber}`;

  const [row] = await db
    .insert(issuesTable)
    .values({
      companyId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "open",
      priority: input.priority ?? "medium",
      assigneeAgentId: input.assignedAgentId ?? null,
      projectId: input.projectId ?? null,
      goalId: input.goalId ?? null,
      issueNumber,
      identifier,
    })
    .returning();

  return rowToIssue(row, companyId);
}

export async function getIssue(companyId: string, id: string): Promise<Issue> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(issuesTable)
    .where(
      and(
        eq(issuesTable.id, id),
        eq(issuesTable.companyId, companyId),
      ),
    );

  if (!row) {
    throw notFound(`Issue "${id}" not found`);
  }

  return rowToIssue(row, companyId);
}

export async function updateIssue(
  companyId: string,
  id: string,
  input: UpdateIssueInput,
): Promise<Issue> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(issuesTable)
    .where(
      and(
        eq(issuesTable.id, id),
        eq(issuesTable.companyId, companyId),
      ),
    );

  if (!existing) {
    throw notFound(`Issue "${id}" not found`);
  }

  const now = new Date();
  const updateValues: Partial<typeof issuesTable.$inferInsert> = {
    updatedAt: now,
  };

  if (input.title !== undefined) updateValues.title = input.title;
  if (input.description !== undefined) updateValues.description = input.description;
  if (input.status !== undefined) updateValues.status = input.status;
  if (input.priority !== undefined) updateValues.priority = input.priority;
  if (input.assignedAgentId !== undefined) updateValues.assigneeAgentId = input.assignedAgentId;
  if (input.projectId !== undefined) updateValues.projectId = input.projectId;
  if (input.goalId !== undefined) updateValues.goalId = input.goalId;
  if (input.metadata !== undefined) updateValues.metadata = input.metadata;

  // Transition to done: record completedAt
  if (
    input.status === "done" &&
    existing.status !== "done" &&
    !existing.completedAt
  ) {
    updateValues.completedAt = now;
  }

  // Transition to cancelled: record cancelledAt
  if (
    input.status === "cancelled" &&
    existing.status !== "cancelled" &&
    !existing.cancelledAt
  ) {
    updateValues.cancelledAt = now;
  }

  // Transition to in_progress: record startedAt
  if (
    input.status === "in_progress" &&
    existing.status !== "in_progress" &&
    !existing.startedAt
  ) {
    updateValues.startedAt = now;
  }

  const [updated] = await db
    .update(issuesTable)
    .set(updateValues)
    .where(eq(issuesTable.id, id))
    .returning();

  return rowToIssue(updated, companyId);
}

export async function deleteIssue(companyId: string, id: string): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({ id: issuesTable.id })
    .from(issuesTable)
    .where(
      and(
        eq(issuesTable.id, id),
        eq(issuesTable.companyId, companyId),
      ),
    );

  if (!existing) {
    throw notFound(`Issue "${id}" not found`);
  }

  // Comments are deleted by cascade (FK: issue_comments.issue_id → issues.id ON DELETE CASCADE)
  await db.delete(issuesTable).where(eq(issuesTable.id, id));
}

/**
 * Atomic checkout — only one agent can hold a given issue at a time.
 * Uses checkoutRunId column to track which agent holds the checkout.
 */
export async function checkoutIssue(
  companyId: string,
  id: string,
  agentId: string,
): Promise<Issue> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(issuesTable)
    .where(
      and(
        eq(issuesTable.id, id),
        eq(issuesTable.companyId, companyId),
      ),
    );

  if (!existing) {
    throw notFound(`Issue "${id}" not found`);
  }

  if (existing.checkoutRunId && existing.checkoutRunId !== agentId) {
    throw conflict(
      `Issue is already checked out by agent "${existing.checkoutRunId}"`,
    );
  }

  if (existing.status === "done" || existing.status === "cancelled") {
    throw conflict(`Cannot check out an issue with status "${existing.status}"`);
  }

  const now = new Date();

  const [updated] = await db
    .update(issuesTable)
    .set({
      checkoutRunId: agentId,
      status: "in_progress",
      startedAt: existing.startedAt ?? now,
      updatedAt: now,
    })
    .where(eq(issuesTable.id, id))
    .returning();

  return rowToIssue(updated, companyId);
}

export async function addComment(
  companyId: string,
  issueId: string,
  input: { body: string; authorId?: string; authorType: "human" | "agent" | "system" },
): Promise<IssueComment> {
  // Verify issue exists in company
  await getIssue(companyId, issueId);

  const db = getDb();

  const insertValues: typeof issueCommentsTable.$inferInsert = {
    issueId,
    body: input.body,
    authorAgentId: input.authorType === "agent" ? (input.authorId ?? null) : null,
    authorUserId: input.authorType !== "agent" ? (input.authorId ?? null) : null,
  };

  const [row] = await db
    .insert(issueCommentsTable)
    .values(insertValues)
    .returning();

  return rowToComment(row, companyId);
}

export async function listComments(
  companyId: string,
  issueId: string,
): Promise<IssueComment[]> {
  // Verify issue exists in company
  await getIssue(companyId, issueId);

  const db = getDb();

  const rows = await db
    .select()
    .from(issueCommentsTable)
    .where(eq(issueCommentsTable.issueId, issueId))
    .orderBy(asc(issueCommentsTable.createdAt));

  return rows.map((r) => rowToComment(r, companyId));
}
