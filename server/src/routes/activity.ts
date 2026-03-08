import { Router } from "express";
import { requireAuth } from "../middleware/index.js";
import * as activityLogService from "../services/activity-log.js";

const router = Router({ mergeParams: true });

// GET /api/companies/:companyId/activity
router.get("/:companyId/activity", requireAuth, async (req, res, next) => {
  try {
    const {
      page,
      limit,
      agentId,
      issueId,
      eventType,
      from,
      to,
    } = req.query;

    const result = await activityLogService.getActivityLog(String(req.params.companyId), {
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 200) : 50,
      agentId: agentId as string | undefined,
      issueId: issueId as string | undefined,
      eventType: eventType as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export { router as activityRouter };
