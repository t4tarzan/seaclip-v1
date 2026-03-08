import { Router } from "express";
import { requireAuth } from "../middleware/index.js";
import * as costsService from "../services/costs.js";

const router = Router({ mergeParams: true });

// GET /api/companies/:companyId/costs
router.get("/:companyId/costs", requireAuth, async (req, res, next) => {
  try {
    const { from, to, agentId } = req.query;
    const summary = await costsService.getCostSummary(String(req.params.companyId), {
      from: from as string | undefined,
      to: to as string | undefined,
      agentId: agentId as string | undefined,
    });
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:companyId/costs/by-agent
router.get("/:companyId/costs/by-agent", requireAuth, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const breakdown = await costsService.getCostsByAgent(String(req.params.companyId), {
      from: from as string | undefined,
      to: to as string | undefined,
    });
    res.json({ data: breakdown });
  } catch (err) {
    next(err);
  }
});

export { router as costsRouter };
