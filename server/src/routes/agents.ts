import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, validate } from "../middleware/index.js";
import * as agentsService from "../services/agents.js";
import * as heartbeatService from "../services/heartbeat.js";
import { publishLiveEvent } from "../services/live-events.js";
import { getDb } from "../db.js";
import { heartbeatRuns as heartbeatRunsTable, issues as issuesTable } from "@seaclip/db";

const router = Router({ mergeParams: true });

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(255),
  adapterType: z.string().min(1),
  environment: z.enum(["cloud", "local"]).default("local"),
  adapterConfig: z.record(z.unknown()).default({}),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  heartbeatCron: z.string().optional(),
  heartbeatEnabled: z.boolean().default(true),
  maxConcurrentRuns: z.number().int().min(1).max(10).default(1),
  timeoutMs: z.number().int().min(1000).default(60_000),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateAgentSchema = CreateAgentSchema.partial().extend({
  status: z.enum(["active", "idle", "paused", "error", "terminated"]).optional(),
});

// GET /api/companies/:companyId/agents
router.get("/:companyId/agents", requireAuth, async (req, res, next) => {
  try {
    const companyId = String(req.params.companyId);
    const agents = await agentsService.listAgents(companyId);

    // Enrich with task counts per agent
    const db = getDb();
    const taskCounts = await db
      .select({
        agentId: issuesTable.assigneeAgentId,
        openTasks: sql<number>`count(*) filter (where ${issuesTable.status} not in ('done', 'cancelled'))`.as("open_tasks"),
        doneTasks: sql<number>`count(*) filter (where ${issuesTable.status} = 'done')`.as("done_tasks"),
        totalTasks: sql<number>`count(*)`.as("total_tasks"),
      })
      .from(issuesTable)
      .where(eq(issuesTable.companyId, companyId))
      .groupBy(issuesTable.assigneeAgentId);

    const countsMap = new Map(
      taskCounts.map((r) => [r.agentId, { openTasks: Number(r.openTasks), doneTasks: Number(r.doneTasks), totalTasks: Number(r.totalTasks) }]),
    );

    const enriched = agents.map((a) => ({
      ...a,
      taskCounts: countsMap.get(a.id) ?? { openTasks: 0, doneTasks: 0, totalTasks: 0 },
    }));

    res.json({ data: enriched, count: enriched.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:companyId/agents
router.post("/:companyId/agents", requireAuth, validate(CreateAgentSchema), async (req, res, next) => {
  try {
    const agent = await agentsService.createAgent(String(req.params.companyId), req.body);
    await publishLiveEvent(String(req.params.companyId), { type: "agent.created", agent });
    res.status(201).json(agent);
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:companyId/agents/:id
router.get("/:companyId/agents/:id", requireAuth, async (req, res, next) => {
  try {
    const agent = await agentsService.getAgent(String(req.params.companyId), String(req.params.id));
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/companies/:companyId/agents/:id
router.patch("/:companyId/agents/:id", requireAuth, validate(UpdateAgentSchema), async (req, res, next) => {
  try {
    const agent = await agentsService.updateAgent(String(req.params.companyId), String(req.params.id), req.body);
    await publishLiveEvent(String(req.params.companyId), { type: "agent.updated", agent });
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/companies/:companyId/agents/:id
router.delete("/:companyId/agents/:id", requireAuth, async (req, res, next) => {
  try {
    await agentsService.deleteAgent(String(req.params.companyId), String(req.params.id));
    await publishLiveEvent(String(req.params.companyId), {
      type: "agent.deleted",
      agentId: String(req.params.id),
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:companyId/agents/:id/runs — list recent heartbeat runs
router.get("/:companyId/agents/:id/runs", requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(heartbeatRunsTable)
      .where(
        and(
          eq(heartbeatRunsTable.agentId, String(req.params.id)),
          eq(heartbeatRunsTable.companyId, String(req.params.companyId)),
        ),
      )
      .orderBy(desc(heartbeatRunsTable.createdAt))
      .limit(20);

    const data = rows.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      status: r.status,
      startedAt: r.startedAt?.toISOString() ?? r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      inputTokens: 0,
      outputTokens: r.tokenCount ?? 0,
      costCents: r.costCents ?? 0,
      result: r.excerpt ?? undefined,
      error: r.status === "failed" ? (r.reason ?? "Unknown error") : undefined,
    }));

    res.json({ data, count: data.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:companyId/agents/:id/invoke — manually trigger heartbeat
router.post("/:companyId/agents/:id/invoke", requireAuth, async (req, res, next) => {
  try {
    const agent = await agentsService.getAgent(String(req.params.companyId), String(req.params.id));
    const runResult = await heartbeatService.invokeAgent(agent, {
      triggeredBy: req.user?.id ?? "manual",
      manual: true,
      context: req.body ?? {},
    });

    await publishLiveEvent(String(req.params.companyId), {
      type: "agent.heartbeat",
      agentId: agent.id,
      result: runResult,
    });

    res.json(runResult);
  } catch (err) {
    next(err);
  }
});

export { router as agentsRouter };
