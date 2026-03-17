import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import * as approvalsService from "../services/approvals.js";
import * as bridge from "../services/github-bridge.js";
import { publishLiveEvent } from "../services/live-events.js";
import { getLogger } from "../middleware/logger.js";

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
      const companyId = String(req.params.companyId);
      const approval = await approvalsService.resolveApproval(
        companyId,
        String(req.params.id),
        {
          ...req.body,
          resolvedById: req.body.resolvedById ?? req.user?.id,
        },
      );
      await publishLiveEvent(companyId, {
        type: "approval.resolved",
        approval,
      });

      // If this is a pipeline gate approval, trigger the next stage
      if (
        approval.decision === "approved" &&
        approval.metadata?.type === "pipeline_gate" &&
        approval.metadata?.nextStage
      ) {
        const { repo, githubNumber, nextStage, currentStage } = approval.metadata as {
          repo: string;
          githubNumber: number;
          nextStage: string;
          currentStage: string;
        };
        try {
          // Retrieve the issue to build the Hopebot prompt
          const issuesService = await import("../services/issues.js");
          const issue = await issuesService.getIssue(companyId, approval.issueId!);
          await bridge.triggerHopebot({
            action: "labeled",
            label: { name: currentStage },
            issue: {
              number: githubNumber,
              title: issue.title,
              body: issue.description ?? "",
              html_url: `https://github.com/${repo}/issues/${githubNumber}`,
            },
            repository: { full_name: repo },
          });
          getLogger().info({ issueId: approval.issueId, nextStage }, "Pipeline gate approved — triggered next agent");
        } catch (err) {
          getLogger().error({ err, issueId: approval.issueId }, "Failed to trigger Hopebot after approval");
        }
      }

      res.json(approval);
    } catch (err) {
      next(err);
    }
  },
);

export { router as approvalsRouter };
