import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import * as pullRequestsService from "../services/pull-requests.js";
import { publishLiveEvent } from "../services/live-events.js";

const router = Router({ mergeParams: true });

const CreatePRSchema = z.object({
  spokeTaskId: z.string().uuid(),
  deviceId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  sourceBranch: z.string().min(1),
  targetBranch: z.string().default("main"),
  diffStat: z.record(z.unknown()).optional(),
});

const ReviewPRSchema = z.object({
  action: z.enum(["approved", "rejected"]),
  reviewedBy: z.string().min(1),
});

// GET /api/companies/:companyId/pull-requests
router.get("/:companyId/pull-requests", requireAuth, async (req, res, next) => {
  try {
    const { status, reviewStatus, deviceId } = req.query;
    const prs = await pullRequestsService.listPRs(String(req.params.companyId), {
      status: status as string | undefined,
      reviewStatus: reviewStatus as string | undefined,
      deviceId: deviceId as string | undefined,
    });
    res.json({ data: prs, count: prs.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:companyId/pull-requests
router.post("/:companyId/pull-requests", requireAuth, validate(CreatePRSchema), async (req, res, next) => {
  try {
    const pr = await pullRequestsService.createPR(String(req.params.companyId), req.body);
    await publishLiveEvent(String(req.params.companyId), { type: "pull_request.created", pr });
    res.status(201).json({ data: pr });
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:companyId/pull-requests/:prId
router.get("/:companyId/pull-requests/:prId", requireAuth, async (req, res, next) => {
  try {
    const pr = await pullRequestsService.getPR(String(req.params.prId));
    res.json({ data: pr });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/companies/:companyId/pull-requests/:prId/review
router.patch("/:companyId/pull-requests/:prId/review", requireAuth, validate(ReviewPRSchema), async (req, res, next) => {
  try {
    const pr = await pullRequestsService.reviewPR(
      String(req.params.prId),
      req.body.action,
      req.body.reviewedBy,
    );
    await publishLiveEvent(String(req.params.companyId), { type: "pull_request.reviewed", pr });
    res.json({ data: pr });
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:companyId/pull-requests/:prId/merge
router.post("/:companyId/pull-requests/:prId/merge", requireAuth, async (req, res, next) => {
  try {
    const pr = await pullRequestsService.mergePR(String(req.params.prId));
    await publishLiveEvent(String(req.params.companyId), { type: "pull_request.merged", pr });
    res.json({ data: pr });
  } catch (err) {
    next(err);
  }
});

export { router as pullRequestsRouter };
