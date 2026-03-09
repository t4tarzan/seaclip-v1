import { Router } from "express";
import { requireAuth } from "../middleware/index.js";
import * as sidebarBadgesService from "../services/sidebar-badges.js";

const router = Router({ mergeParams: true });

// GET /api/companies/:companyId/sidebar-badges
router.get("/:companyId/sidebar-badges", requireAuth, async (req, res, next) => {
  try {
    const badges = await sidebarBadgesService.getBadges(String(req.params.companyId));
    res.json(badges);
  } catch (err) {
    next(err);
  }
});

export { router as sidebarBadgesRouter };
