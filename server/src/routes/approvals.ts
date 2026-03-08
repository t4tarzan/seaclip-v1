import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import * as approvalsService from "../services/approvals.js";
import { publishLiveEvent } from "../services/live-events.js";

const router = Router({ mergeParams: true });

const ResolveApprovalSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(2000).optional(),
  resolvedById: z.string().optional(),
});

// GET /api/companies/:companyId/approvals
router.get("/:companyId/approvals", requireAuth, async (req, res, next) => {
  try {
    const { status = "pending", page, limit } = req.query;
    const approvals = await approvalsService.listApprovals(String(req.params.companyId), {
      status: status as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    res.json(approvals);
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:companyId/approvals/:id/resolve
router.post(
  "/:companyId/approvals/:id/resolve",
  requireAuth,
  validate(ResolveApprovalSchema),
  async (req, res, next) => {
    try {
      const approval = await approvalsService.resolveApproval(
        String(req.params.companyId),
        String(req.params.id),
        {
          ...req.body,
          resolvedById: req.body.resolvedById ?? req.user?.id,
        },
      );
      await publishLiveEvent(String(req.params.companyId), {
        type: "approval.resolved",
        approval,
      });
      res.json(approval);
    } catch (err) {
      next(err);
    }
  },
);

export { router as approvalsRouter };
