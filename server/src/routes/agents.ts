import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import * as agentsService from "../services/agents.js";
import * as heartbeatService from "../services/heartbeat.js";
import { publishLiveEvent } from "../services/live-events.js";

const router = Router({ mergeParams: true });

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(255),
  adapterType: z.string().min(1),
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

const UpdateAgentSchema = CreateAgentSchema.partial();

// GET /api/companies/:companyId/agents
router.get("/:companyId/agents", requireAuth, async (req, res, next) => {
  try {
    const agents = await agentsService.listAgents(String(req.params.companyId));
    res.json({ data: agents, count: agents.length });
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

// POST /api/companies/:companyId/agents/:id/invoke — manually trigger heartbeat
router.post("/:companyId/agents/:id/invoke", requireAuth, async (req, res, next) => {
  try {
    const agent = await agentsService.getAgent(String(req.params.companyId), String(req.params.id));
    const runResult = await heartbeatService.invokeAgent(agent, {
      triggeredBy: (req as any).user?.id ?? "manual",
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
