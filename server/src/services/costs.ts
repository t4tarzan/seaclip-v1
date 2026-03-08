/**
 * costs service — aggregate cost queries and per-agent breakdown.
 */
import { getDb } from "../db.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { costEvents } from "@seaclip/db";

export interface CostRecord {
  id: string;
  companyId: string;
  agentId: string;
  agentName?: string;
  runId?: string;
  adapterType: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model?: string;
  occurredAt: string;
}

export interface CostSummaryOptions {
  from?: string;
  to?: string;
  agentId?: string;
}

export interface CostSummary {
  totalCostUsd: number;
  totalRuns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  periodFrom: string;
  periodTo: string;
  currency: "USD";
}

export interface AgentCostBreakdown {
  agentId: string;
  agentName?: string;
  adapterType: string;
  totalCostUsd: number;
  totalRuns: number;
  avgCostPerRunUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

/**
 * Map a DB row back to the CostRecord interface.
 *
 * DB columns:
 *   costCents   → costUsd  (divide by 100)
 *   tokenCount  → totalTokens (split into inputTokens/outputTokens via detail JSONB)
 *   detail      → JSONB containing { agentName, adapterType, inputTokens, outputTokens, ... }
 */
function rowToCostRecord(row: typeof costEvents.$inferSelect): CostRecord {
  const detail = (row.detail ?? {}) as Record<string, unknown>;
  const inputTokens = typeof detail.inputTokens === "number" ? detail.inputTokens : 0;
  const outputTokens = typeof detail.outputTokens === "number"
    ? detail.outputTokens
    : row.tokenCount - inputTokens;

  return {
    id: row.id,
    companyId: row.companyId,
    agentId: row.agentId,
    agentName: typeof detail.agentName === "string" ? detail.agentName : undefined,
    runId: row.runId ?? undefined,
    adapterType: typeof detail.adapterType === "string" ? detail.adapterType : "unknown",
    inputTokens,
    outputTokens,
    costUsd: row.costCents / 100,
    model: row.model ?? undefined,
    occurredAt: row.createdAt.toISOString(),
  };
}

export function recordCost(record: Omit<CostRecord, "id">): CostRecord {
  const db = getDb();

  const detail: Record<string, unknown> = {
    adapterType: record.adapterType,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
  };
  if (record.agentName) detail.agentName = record.agentName;

  // Fire-and-forget insert (matches original sync signature)
  const id = crypto.randomUUID();
  db.insert(costEvents)
    .values({
      id,
      companyId: record.companyId,
      agentId: record.agentId,
      runId: record.runId ?? null,
      costCents: Math.round(record.costUsd * 100),
      tokenCount: record.inputTokens + record.outputTokens,
      model: record.model ?? null,
      provider: null,
      detail,
    })
    .execute()
    .catch((err: unknown) => {
      console.error("[costs] recordCost insert failed:", err);
    });

  return {
    id,
    ...record,
  };
}

export async function getCostSummary(
  companyId: string,
  options: CostSummaryOptions,
): Promise<CostSummary> {
  const db = getDb();

  const from = options.from
    ? new Date(options.from)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = options.to ? new Date(options.to) : new Date();

  const conditions = [
    eq(costEvents.companyId, companyId),
    gte(costEvents.createdAt, from),
    lte(costEvents.createdAt, to),
  ];
  if (options.agentId) {
    conditions.push(eq(costEvents.agentId, options.agentId));
  }

  const where = and(...conditions);

  const [agg] = await db
    .select({
      totalCostCents: sql<number>`cast(coalesce(sum(${costEvents.costCents}), 0) as int)`,
      totalRuns: sql<number>`cast(count(*) as int)`,
      totalTokenCount: sql<number>`cast(coalesce(sum(${costEvents.tokenCount}), 0) as int)`,
      totalInputTokens: sql<number>`cast(coalesce(sum((${costEvents.detail}->>'inputTokens')::numeric), 0) as int)`,
      totalOutputTokens: sql<number>`cast(coalesce(sum((${costEvents.detail}->>'outputTokens')::numeric), 0) as int)`,
    })
    .from(costEvents)
    .where(where);

  return {
    totalCostUsd: (agg.totalCostCents ?? 0) / 100,
    totalRuns: agg.totalRuns ?? 0,
    totalInputTokens: agg.totalInputTokens ?? 0,
    totalOutputTokens: agg.totalOutputTokens ?? 0,
    periodFrom: from.toISOString(),
    periodTo: to.toISOString(),
    currency: "USD",
  };
}

export async function getCostsByAgent(
  companyId: string,
  options: { from?: string; to?: string },
): Promise<AgentCostBreakdown[]> {
  const db = getDb();

  const from = options.from
    ? new Date(options.from)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = options.to ? new Date(options.to) : new Date();

  const rows = await db
    .select()
    .from(costEvents)
    .where(
      and(
        eq(costEvents.companyId, companyId),
        gte(costEvents.createdAt, from),
        lte(costEvents.createdAt, to),
      ),
    );

  const byAgent = new Map<string, AgentCostBreakdown>();

  for (const row of rows) {
    const detail = (row.detail ?? {}) as Record<string, unknown>;
    const agentName = typeof detail.agentName === "string" ? detail.agentName : undefined;
    const adapterType = typeof detail.adapterType === "string" ? detail.adapterType : "unknown";
    const inputTokens = typeof detail.inputTokens === "number" ? detail.inputTokens : 0;
    const outputTokens = typeof detail.outputTokens === "number"
      ? detail.outputTokens
      : row.tokenCount - inputTokens;
    const costUsd = row.costCents / 100;

    const existing = byAgent.get(row.agentId) ?? {
      agentId: row.agentId,
      agentName,
      adapterType,
      totalCostUsd: 0,
      totalRuns: 0,
      avgCostPerRunUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };

    existing.totalCostUsd += costUsd;
    existing.totalRuns += 1;
    existing.totalInputTokens += inputTokens;
    existing.totalOutputTokens += outputTokens;
    if (!existing.agentName && agentName) existing.agentName = agentName;

    byAgent.set(row.agentId, existing);
  }

  // Calculate averages
  for (const breakdown of byAgent.values()) {
    breakdown.avgCostPerRunUsd =
      breakdown.totalRuns > 0 ? breakdown.totalCostUsd / breakdown.totalRuns : 0;
  }

  return Array.from(byAgent.values()).sort(
    (a, b) => b.totalCostUsd - a.totalCostUsd,
  );
}
