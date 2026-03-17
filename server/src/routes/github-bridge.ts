/**
 * github-bridge routes — GitHub repo listing, issue sync, pipeline control.
 *
 * Mounted at /api/companies (mergeParams) alongside other company-scoped routes.
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import * as bridge from "../services/github-bridge.js";

const router = Router({ mergeParams: true });

// GET /api/companies/:companyId/github/repos
router.get("/:companyId/github/repos", requireAuth, async (req, res, next) => {
  try {
    const repos = await bridge.listOrgRepos();
    res.json({ data: repos });
  } catch (err) {
    next(err);
  }
});

const SyncIssueSchema = z.object({
  issueId: z.string().uuid(),
});

// POST /api/companies/:companyId/github/sync-issue
router.post(
  "/:companyId/github/sync-issue",
  requireAuth,
  validate(SyncIssueSchema),
  async (req, res, next) => {
    try {
      const result = await bridge.syncIssueToGitHub(
        String(req.params.companyId),
        req.body.issueId,
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

const StartPipelineSchema = z.object({
  issueId: z.string().uuid(),
  stage: z.enum(bridge.PIPELINE_STAGES).default("plan"),
  mode: z.enum(["auto", "manual"]).default("auto"),
});

// POST /api/companies/:companyId/github/pipeline/start
router.post(
  "/:companyId/github/pipeline/start",
  requireAuth,
  validate(StartPipelineSchema),
  async (req, res, next) => {
    try {
      await bridge.startPipeline(
        String(req.params.companyId),
        req.body.issueId,
        req.body.stage,
        req.body.mode,
      );
      res.json({ success: true, stage: req.body.stage, mode: req.body.mode });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/companies/:companyId/github/pipeline/resume
router.post(
  "/:companyId/github/pipeline/resume",
  requireAuth,
  validate(StartPipelineSchema),
  async (req, res, next) => {
    try {
      await bridge.resumePipeline(
        String(req.params.companyId),
        req.body.issueId,
        req.body.stage,
        req.body.mode,
      );
      res.json({ success: true, stage: req.body.stage, mode: req.body.mode });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/companies/:companyId/github/pipeline/status/:issueId
router.get(
  "/:companyId/github/pipeline/status/:issueId",
  requireAuth,
  async (req, res, next) => {
    try {
      const issue = await import("../services/issues.js").then((m) =>
        m.getIssue(String(req.params.companyId), String(req.params.issueId)),
      );
      const meta = issue.metadata as Record<string, unknown>;
      const repo = meta.githubRepo as string;
      const ghNumber = meta.githubIssueNumber as number;

      if (!repo || !ghNumber) {
        res.json({ data: { linked: false } });
        return;
      }

      const labels = await bridge.getLabels(repo, ghNumber);
      const stage = bridge.latestStageFromLabels(labels);
      const closed = await bridge.isGitHubIssueClosed(repo, ghNumber);

      res.json({
        data: {
          linked: true,
          repo,
          githubIssueNumber: ghNumber,
          labels,
          stage,
          closed,
          pipelineMode: (meta.pipelineMode as string) ?? null,
          pipelineWaiting: (meta.pipelineWaiting as string) ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export { router as githubBridgeRouter };
