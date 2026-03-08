import { Router } from "express";
import { requireAuth } from "../middleware/index.js";
import * as dashboardService from "../services/dashboard.js";

const router = Router({ mergeParams: true });

// GET /api/companies/:companyId/dashboard
router.get("/:companyId/dashboard", requireAuth, async (req, res, next) => {
  try {
    const data = await dashboardService.getDashboard(String(req.params.companyId));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export { router as dashboardRouter };
