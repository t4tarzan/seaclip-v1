import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/index.js";
import { requireAuth } from "../middleware/index.js";
import * as approvalsService from "../services/approvals.js";
import { publishLiveEvent } from "../services/live-events.js";
import { executeApprovedRequest } from "../services/hub-executor.js";

/**
 * Hub Requests — no-auth endpoints for standard dev users on the tailnet
 * to request admin actions (port exposure, nginx config, package installs, etc.)
 *
 * These are stored as approvals with type metadata so the admin can
 * approve/reject them from the SeaClip dashboard.
 */

const router = Router();

// ---------------------------------------------------------------------------
// Request categories
// ---------------------------------------------------------------------------
const HUB_REQUEST_TYPES = [
  "port",        // Expose a dev port via nginx/firewall
  "package",     // Install a system package (brew, apt)
  "docker",      // Docker config change (network, volume, etc.)
  "nginx",       // Nginx/reverse proxy config
  "dns",         // MagicDNS or local DNS entry
  "cron",        // Cron job / scheduled task
  "access",      // Access to a restricted resource
  "other",       // Freeform request
] as const;

const CreateHubRequestSchema = z.object({
  type: z.enum(HUB_REQUEST_TYPES),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  username: z.string().min(1).max(64),
  details: z.record(z.unknown()).optional(),
});

const ListHubRequestsSchema = z.object({
  status: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/hub-requests — submit a request (no auth)
// ---------------------------------------------------------------------------
router.post("/", validate(CreateHubRequestSchema), async (req, res, next) => {
  try {
    const { type, title, description, username, details } = req.body;

    // Find the first company (hub is typically single-company)
    const { getDb } = await import("../db.js");
    const { companies, agents } = await import("@seaclip/db");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const [company] = await db.select().from(companies).limit(1);

    if (!company) {
      res.status(503).json({ error: "Hub not configured — no company found" });
      return;
    }

    // Hub requests need an agentId (FK constraint). Use a "hub-system" agent.
    let [systemAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.name, "Hub System"))
      .limit(1);

    if (!systemAgent) {
      [systemAgent] = await db
        .insert(agents)
        .values({
          companyId: company.id,
          name: "Hub System",
          adapterType: "http",
          role: "System agent for hub admin requests",
          status: "idle",
          environment: "local",
        })
        .returning();
    }

    const approval = await approvalsService.createApproval(company.id, {
      title: `[${type.toUpperCase()}] ${title}`,
      description,
      agentId: systemAgent.id,
      requestedById: username,
      metadata: {
        hubRequestType: type,
        username,
        requestedFrom: req.ip,
        ...(details ?? {}),
      },
    });

    await publishLiveEvent(company.id, {
      type: "approval.requested",
      approval,
    });

    res.status(201).json({
      id: approval.id,
      status: "pending",
      message: `Request submitted. The hub admin will review it in the dashboard.`,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/hub-requests — list requests (no auth, filtered view)
// ---------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const { status = "all", username } = req.query;

    const { getDb } = await import("../db.js");
    const { companies } = await import("@seaclip/db");
    const db = getDb();
    const [company] = await db.select().from(companies).limit(1);

    if (!company) {
      res.json({ data: [], total: 0 });
      return;
    }

    const result = await approvalsService.listApprovals(company.id, {
      status: status as string,
      page: 1,
      limit: 100,
    });

    // Filter to hub requests only (have hubRequestType in metadata)
    let filtered = result.data.filter(
      (a) => a.metadata && "hubRequestType" in a.metadata,
    );

    // If username query param provided, filter to that user's requests
    if (typeof username === "string" && username) {
      filtered = filtered.filter((a) => a.metadata?.username === username);
    }

    res.json({ data: filtered, total: filtered.length });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/hub-requests/:id — get a single request status (no auth)
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res, next) => {
  try {
    const { getDb } = await import("../db.js");
    const { companies } = await import("@seaclip/db");
    const db = getDb();
    const [company] = await db.select().from(companies).limit(1);

    if (!company) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const result = await approvalsService.listApprovals(company.id, {
      status: "all",
      page: 1,
      limit: 1000,
    });

    const request = result.data.find(
      (a) => a.id === req.params.id && a.metadata && "hubRequestType" in a.metadata,
    );

    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    res.json({ data: request });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/hub-requests/:id/resolve — approve/reject with auto-execution
// ---------------------------------------------------------------------------
const ResolveHubRequestSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(2000).optional(),
});

router.post("/:id/resolve", requireAuth, validate(ResolveHubRequestSchema), async (req, res, next) => {
  try {
    const { getDb } = await import("../db.js");
    const { companies } = await import("@seaclip/db");
    const db = getDb();
    const [company] = await db.select().from(companies).limit(1);

    if (!company) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Resolve the approval
    const approval = await approvalsService.resolveApproval(
      company.id,
      String(req.params.id),
      {
        decision: req.body.decision,
        reason: req.body.reason,
        resolvedById: req.user?.id ?? "admin",
      },
    );

    let execution = null;

    // Auto-execute on approval (only for hub requests)
    if (req.body.decision === "approved" && approval.metadata && "hubRequestType" in approval.metadata) {
      const requestType = approval.metadata.hubRequestType as string;
      execution = await executeApprovedRequest(
        requestType,
        approval.title,
        approval.description ?? "",
        approval.metadata,
      );
    }

    await publishLiveEvent(company.id, {
      type: "approval.resolved",
      approval,
      execution,
    });

    res.json({
      ...approval,
      execution,
    });
  } catch (err) {
    next(err);
  }
});

export { router as hubRequestsRouter };
