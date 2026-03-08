/**
 * agents service — CRUD + agent lifecycle management.
 *
 * Uses Drizzle ORM against the `agents` table from @seaclip/db.
 *
 * Schema mapping notes:
 *  - `model`, `systemPrompt`, `heartbeatCron`, `heartbeatEnabled`,
 *    `maxConcurrentRuns`, `timeoutMs`, `tags`, `lastRunAt`,
 *    `totalRuns`, `totalCostUsd` are not first-class DB columns.
 *    They are persisted inside the `runtimeConfig` JSONB column and
 *    surfaced on the public Agent interface at read time.
 *  - `metadata` maps directly to the DB `metadata` jsonb column.
 *  - `adapterConfig` maps directly to the DB `adapterConfig` jsonb column.
 *  - `lastHeartbeatAt` maps to the DB `lastHeartbeatAt` timestamp column.
 *  - `status` maps to the DB `status` text column.
 */
import { getDb } from "../db.js";
import { eq, and, asc } from "drizzle-orm";
import { agents as agentsTable } from "@seaclip/db";
import { notFound, conflict } from "../errors.js";

export type AgentStatus = "active" | "paused" | "error" | "terminated" | "idle";

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  model?: string;
  systemPrompt?: string;
  heartbeatCron?: string;
  heartbeatEnabled: boolean;
  maxConcurrentRuns: number;
  timeoutMs: number;
  status: AgentStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  lastHeartbeatAt?: string;
  lastRunAt?: string;
  totalRuns: number;
  totalCostUsd: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  adapterType: string;
  adapterConfig?: Record<string, unknown>;
  model?: string;
  systemPrompt?: string;
  heartbeatCron?: string;
  heartbeatEnabled?: boolean;
  maxConcurrentRuns?: number;
  timeoutMs?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {
  status?: AgentStatus;
}

// ---------------------------------------------------------------------------
// runtimeConfig shape stored in the JSONB column
// ---------------------------------------------------------------------------

interface AgentRuntimeConfig {
  model?: string;
  systemPrompt?: string;
  heartbeatCron?: string;
  heartbeatEnabled?: boolean;
  maxConcurrentRuns?: number;
  timeoutMs?: number;
  tags?: string[];
  lastRunAt?: string;
  totalRuns?: number;
  totalCostUsd?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DbRow = typeof agentsTable.$inferSelect;

function safeRuntimeConfig(row: DbRow): AgentRuntimeConfig {
  if (row.runtimeConfig && typeof row.runtimeConfig === "object" && !Array.isArray(row.runtimeConfig)) {
    return row.runtimeConfig as AgentRuntimeConfig;
  }
  return {};
}

function safeMetadata(row: DbRow): Record<string, unknown> {
  if (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)) {
    return row.metadata as Record<string, unknown>;
  }
  return {};
}

function safeAdapterConfig(row: DbRow): Record<string, unknown> {
  if (row.adapterConfig && typeof row.adapterConfig === "object" && !Array.isArray(row.adapterConfig)) {
    return row.adapterConfig as Record<string, unknown>;
  }
  return {};
}

/** Map a DB row to the public Agent interface. */
function rowToAgent(row: DbRow): Agent {
  const rc = safeRuntimeConfig(row);
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    adapterType: row.adapterType,
    adapterConfig: safeAdapterConfig(row),
    model: rc.model,
    systemPrompt: rc.systemPrompt,
    heartbeatCron: rc.heartbeatCron,
    heartbeatEnabled: rc.heartbeatEnabled ?? true,
    maxConcurrentRuns: rc.maxConcurrentRuns ?? 1,
    timeoutMs: rc.timeoutMs ?? 60_000,
    status: (row.status ?? "idle") as AgentStatus,
    tags: Array.isArray(rc.tags) ? (rc.tags as string[]) : [],
    metadata: safeMetadata(row),
    lastHeartbeatAt: row.lastHeartbeatAt?.toISOString(),
    lastRunAt: rc.lastRunAt,
    totalRuns: rc.totalRuns ?? 0,
    totalCostUsd: rc.totalCostUsd ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Build the runtimeConfig JSONB value to persist for a new/updated agent. */
function buildRuntimeConfig(
  input: CreateAgentInput | UpdateAgentInput,
  existing: AgentRuntimeConfig = {},
): AgentRuntimeConfig {
  const rc: AgentRuntimeConfig = { ...existing };
  if ("model" in input && input.model !== undefined) rc.model = input.model;
  if ("systemPrompt" in input && input.systemPrompt !== undefined) rc.systemPrompt = input.systemPrompt;
  if ("heartbeatCron" in input && input.heartbeatCron !== undefined) rc.heartbeatCron = input.heartbeatCron;
  if ("heartbeatEnabled" in input && input.heartbeatEnabled !== undefined) rc.heartbeatEnabled = input.heartbeatEnabled;
  if ("maxConcurrentRuns" in input && input.maxConcurrentRuns !== undefined) rc.maxConcurrentRuns = input.maxConcurrentRuns;
  if ("timeoutMs" in input && input.timeoutMs !== undefined) rc.timeoutMs = input.timeoutMs;
  if ("tags" in input && input.tags !== undefined) rc.tags = input.tags;
  return rc;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listAgents(companyId: string): Promise<Agent[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.companyId, companyId))
    .orderBy(asc(agentsTable.createdAt));
  return rows.map(rowToAgent);
}

export async function createAgent(
  companyId: string,
  input: CreateAgentInput,
): Promise<Agent> {
  const db = getDb();

  // Ensure name is unique within company
  const [existing] = await db
    .select({ id: agentsTable.id })
    .from(agentsTable)
    .where(
      and(
        eq(agentsTable.companyId, companyId),
        eq(agentsTable.name, input.name),
      ),
    );

  if (existing) {
    throw conflict(`Agent with name "${input.name}" already exists in this company`);
  }

  const rc = buildRuntimeConfig(input);
  // Set defaults for new agents
  if (rc.heartbeatEnabled === undefined) rc.heartbeatEnabled = true;
  if (rc.maxConcurrentRuns === undefined) rc.maxConcurrentRuns = 1;
  if (rc.timeoutMs === undefined) rc.timeoutMs = 60_000;
  if (rc.tags === undefined) rc.tags = [];
  rc.totalRuns = 0;
  rc.totalCostUsd = 0;

  const [row] = await db
    .insert(agentsTable)
    .values({
      companyId,
      name: input.name,
      adapterType: input.adapterType,
      adapterConfig: (input.adapterConfig ?? {}) as Record<string, unknown>,
      runtimeConfig: rc as Record<string, unknown>,
      metadata: (input.metadata ?? {}) as Record<string, unknown>,
      status: "idle",
    })
    .returning();

  return rowToAgent(row);
}

export async function getAgent(companyId: string, id: string): Promise<Agent> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(agentsTable)
    .where(
      and(
        eq(agentsTable.id, id),
        eq(agentsTable.companyId, companyId),
      ),
    );

  if (!row) {
    throw notFound(`Agent "${id}" not found in company "${companyId}"`);
  }

  return rowToAgent(row);
}

export async function updateAgent(
  companyId: string,
  id: string,
  input: UpdateAgentInput,
): Promise<Agent> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(agentsTable)
    .where(
      and(
        eq(agentsTable.id, id),
        eq(agentsTable.companyId, companyId),
      ),
    );

  if (!existing) {
    throw notFound(`Agent "${id}" not found in company "${companyId}"`);
  }

  // Check name uniqueness if name is changing
  if (input.name && input.name !== existing.name) {
    const [nameTaken] = await db
      .select({ id: agentsTable.id })
      .from(agentsTable)
      .where(
        and(
          eq(agentsTable.companyId, companyId),
          eq(agentsTable.name, input.name),
        ),
      );
    if (nameTaken) {
      throw conflict(`Agent with name "${input.name}" already exists in this company`);
    }
  }

  const existingRc = safeRuntimeConfig(existing);
  const newRc = buildRuntimeConfig(input, existingRc);

  const updateValues: Partial<typeof agentsTable.$inferInsert> = {
    updatedAt: new Date(),
    runtimeConfig: newRc as Record<string, unknown>,
  };

  if (input.name !== undefined) updateValues.name = input.name;
  if (input.adapterType !== undefined) updateValues.adapterType = input.adapterType;
  if (input.adapterConfig !== undefined) {
    updateValues.adapterConfig = {
      ...safeAdapterConfig(existing),
      ...input.adapterConfig,
    } as Record<string, unknown>;
  }
  if (input.metadata !== undefined) {
    updateValues.metadata = {
      ...safeMetadata(existing),
      ...input.metadata,
    } as Record<string, unknown>;
  }
  if (input.status !== undefined) updateValues.status = input.status;

  const [updated] = await db
    .update(agentsTable)
    .set(updateValues)
    .where(eq(agentsTable.id, id))
    .returning();

  return rowToAgent(updated);
}

export async function deleteAgent(companyId: string, id: string): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({ id: agentsTable.id })
    .from(agentsTable)
    .where(
      and(
        eq(agentsTable.id, id),
        eq(agentsTable.companyId, companyId),
      ),
    );

  if (!existing) {
    throw notFound(`Agent "${id}" not found in company "${companyId}"`);
  }

  await db.delete(agentsTable).where(eq(agentsTable.id, id));
}

export async function setAgentStatus(
  companyId: string,
  id: string,
  status: AgentStatus,
): Promise<Agent> {
  return updateAgent(companyId, id, { status });
}

export async function pauseAgent(companyId: string, id: string): Promise<Agent> {
  return setAgentStatus(companyId, id, "paused");
}

export async function resumeAgent(companyId: string, id: string): Promise<Agent> {
  return setAgentStatus(companyId, id, "idle");
}

export async function terminateAgent(companyId: string, id: string): Promise<Agent> {
  return setAgentStatus(companyId, id, "terminated");
}

export async function recordHeartbeat(
  id: string,
  costUsd: number,
): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.id, id));

  if (!existing) return;

  const rc = safeRuntimeConfig(existing);
  const now = new Date();

  const updatedRc: AgentRuntimeConfig = {
    ...rc,
    lastRunAt: now.toISOString(),
    totalRuns: (rc.totalRuns ?? 0) + 1,
    totalCostUsd: (rc.totalCostUsd ?? 0) + costUsd,
  };

  await db
    .update(agentsTable)
    .set({
      lastHeartbeatAt: now,
      runtimeConfig: updatedRc as Record<string, unknown>,
      status: "idle",
      updatedAt: now,
    })
    .where(eq(agentsTable.id, id));
}
