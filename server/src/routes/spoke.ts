import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/index.js";
import * as edgeDevicesService from "../services/edge-devices.js";
import * as agentsService from "../services/agents.js";
import * as issuesService from "../services/issues.js";
import * as spokeTasksService from "../services/spoke-tasks.js";

const router = Router();

const FeedbackSchema = z.object({
  issueId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "blocked", "done", "cancelled"]).optional(),
  comment: z.string().min(1).max(4096),
});

// ---------------------------------------------------------------------------
// Helper: resolve device → company + agents on this device
// ---------------------------------------------------------------------------

async function resolveDevice(deviceId: string) {
  // Edge devices are scoped to a company. We look up the device directly
  // by iterating companies (the device ID is globally unique).
  // For efficiency, the service exposes getEdgeDevice which needs companyId,
  // so we rely on the device table having a companyId we can read.
  // We'll use a lightweight approach: list all companies isn't needed —
  // the edge-devices service stores companyId on the device row.
  // We call getEdgeDevice with a wildcard-style lookup via the DB.
  // Since the existing service requires companyId, we do a raw lookup.
  const { getDb } = await import("../db.js");
  const { edgeDevices } = await import("@seaclip/db");
  const { eq } = await import("drizzle-orm");

  const db = getDb();
  const rows = await db
    .select()
    .from(edgeDevices)
    .where(eq(edgeDevices.id, deviceId))
    .limit(1);

  if (!rows[0]) {
    return null;
  }

  const device = rows[0];
  const companyId = device.companyId;

  // Find agents deployed on this device (agents whose adapterConfig.deviceId matches)
  const allAgents = await agentsService.listAgents(companyId);
  const deviceAgents = allAgents.filter(
    (a) =>
      (a.adapterConfig as Record<string, unknown>)?.deviceId === deviceId ||
      (a.metadata as Record<string, unknown>)?.deviceId === deviceId,
  );

  return { device, companyId, agents: deviceAgents };
}

// ---------------------------------------------------------------------------
// GET /api/spoke/:deviceId/tasks
// Returns issues assigned to agents running on this device.
// ---------------------------------------------------------------------------

router.get("/:deviceId/tasks", async (req, res, next) => {
  try {
    const resolved = await resolveDevice(String(req.params.deviceId));
    if (!resolved) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const { companyId, agents } = resolved;
    const agentIds = agents.map((a) => a.id);

    if (agentIds.length === 0) {
      res.json({ data: [], count: 0 });
      return;
    }

    // Fetch issues assigned to any of these agents
    const allIssues: issuesService.Issue[] = [];
    for (const agentId of agentIds) {
      const result = await issuesService.listIssues(companyId, {
        agentId,
        page: 1,
        limit: 100,
      });
      allIssues.push(...result.data);
    }

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = allIssues.filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });

    res.json({ data: unique, count: unique.length });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/spoke/:deviceId/status
// Returns device health + agent status summary.
// ---------------------------------------------------------------------------

router.get("/:deviceId/status", async (req, res, next) => {
  try {
    const resolved = await resolveDevice(String(req.params.deviceId));
    if (!resolved) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const { device, agents } = resolved;

    const agentSummary = {
      total: agents.length,
      active: agents.filter((a) => a.status === "active").length,
      paused: agents.filter((a) => a.status === "paused").length,
      error: agents.filter((a) => a.status === "error").length,
      idle: agents.filter((a) => a.status === "idle").length,
    };

    res.json({
      deviceId: device.id,
      name: device.name,
      status: device.status,
      deviceType: device.deviceType,
      location: (device.metadata as Record<string, unknown>)?.location ?? null,
      lastSeenAt: device.lastPingAt?.toISOString() ?? device.lastHeartbeatAt?.toISOString() ?? null,
      capabilities: device.capabilities ?? [],
      agents: agentSummary,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/spoke/:deviceId/feedback
// Allows a spoke to submit task feedback / mark completion.
// ---------------------------------------------------------------------------

router.post("/:deviceId/feedback", validate(FeedbackSchema), async (req, res, next) => {
  try {
    const resolved = await resolveDevice(String(req.params.deviceId));
    if (!resolved) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const { companyId } = resolved;
    const { issueId, status, comment } = req.body;

    // Optionally update issue status
    if (status) {
      await issuesService.updateIssue(companyId, issueId, { status });
    }

    // Add a comment from the device
    await issuesService.addComment(companyId, issueId, {
      body: comment,
      authorId: String(req.params.deviceId),
      authorType: "system" as const,
    });

    res.json({ accepted: true, issueId });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/spoke/:deviceId/jobs
// Returns pending heartbeat runs for agents on this device.
// ---------------------------------------------------------------------------

router.get("/:deviceId/jobs", async (req, res, next) => {
  try {
    const resolved = await resolveDevice(String(req.params.deviceId));
    if (!resolved) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const { agents } = resolved;

    // Return agents that have heartbeat enabled — these represent pending/scheduled jobs
    const jobs = agents
      .filter((a) => a.heartbeatEnabled)
      .map((a) => ({
        agentId: a.id,
        agentName: a.name,
        status: a.status,
        heartbeatCron: a.heartbeatCron ?? null,
        lastHeartbeatAt: a.lastHeartbeatAt ?? null,
        lastRunAt: a.lastRunAt ?? null,
      }));

    res.json({ data: jobs, count: jobs.length });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/spoke/:deviceId/spoke-tasks
// Returns spoke_tasks assigned to this device.
// ---------------------------------------------------------------------------

router.get("/:deviceId/spoke-tasks", async (req, res, next) => {
  try {
    const tasks = await spokeTasksService.listTasksByDevice(String(req.params.deviceId));
    res.json({ data: tasks, count: tasks.length });
  } catch (err) {
    next(err);
  }
});

export { router as spokeRouter };
