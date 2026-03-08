import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import * as issuesService from "../services/issues.js";
import { publishLiveEvent } from "../services/live-events.js";

const router = Router({ mergeParams: true });

const CreateIssueSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["open", "in_progress", "blocked", "done", "cancelled"]).default("open"),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  assignedAgentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  goalId: z.string().uuid().optional(),
  labels: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
  dueAt: z.string().datetime().optional(),
});

const UpdateIssueSchema = CreateIssueSchema.partial();

const AddCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  authorId: z.string().optional(),
  authorType: z.enum(["human", "agent", "system"]).default("human"),
});

// GET /api/companies/:companyId/issues
router.get("/:companyId/issues", requireAuth, async (req, res, next) => {
  try {
    const { status, priority, agentId, projectId, page, limit } = req.query;
    const issues = await issuesService.listIssues(String(req.params.companyId), {
      status: status as string | undefined,
      priority: priority as string | undefined,
      agentId: agentId as string | undefined,
      projectId: projectId as string | undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    res.json(issues);
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:companyId/issues
router.post("/:companyId/issues", requireAuth, validate(CreateIssueSchema), async (req, res, next) => {
  try {
    const issue = await issuesService.createIssue(String(req.params.companyId), req.body);
    await publishLiveEvent(String(req.params.companyId), { type: "issue.created", issue });
    res.status(201).json(issue);
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:companyId/issues/:id
router.get("/:companyId/issues/:id", requireAuth, async (req, res, next) => {
  try {
    const issue = await issuesService.getIssue(String(req.params.companyId), String(req.params.id));
    res.json(issue);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/companies/:companyId/issues/:id
router.patch("/:companyId/issues/:id", requireAuth, validate(UpdateIssueSchema), async (req, res, next) => {
  try {
    const issue = await issuesService.updateIssue(String(req.params.companyId), String(req.params.id), req.body);
    await publishLiveEvent(String(req.params.companyId), { type: "issue.updated", issue });
    res.json(issue);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/companies/:companyId/issues/:id
router.delete("/:companyId/issues/:id", requireAuth, async (req, res, next) => {
  try {
    await issuesService.deleteIssue(String(req.params.companyId), String(req.params.id));
    await publishLiveEvent(String(req.params.companyId), {
      type: "issue.deleted",
      issueId: String(req.params.id),
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:companyId/issues/:id/checkout — atomic checkout
router.post("/:companyId/issues/:id/checkout", requireAuth, async (req, res, next) => {
  try {
    const { agentId } = req.body as { agentId?: string };
    const issue = await issuesService.checkoutIssue(
      String(req.params.companyId),
      String(req.params.id),
      agentId ?? req.user?.id ?? "unknown",
    );
    await publishLiveEvent(String(req.params.companyId), {
      type: "issue.checked_out",
      issue,
      agentId,
    });
    res.json(issue);
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:companyId/issues/:id/comments
router.post(
  "/:companyId/issues/:id/comments",
  requireAuth,
  validate(AddCommentSchema),
  async (req, res, next) => {
    try {
      const comment = await issuesService.addComment(
        String(req.params.companyId),
        String(req.params.id),
        { ...req.body, authorId: req.body.authorId ?? req.user?.id },
      );
      await publishLiveEvent(String(req.params.companyId), {
        type: "issue.comment_added",
        issueId: String(req.params.id),
        comment,
      });
      res.status(201).json(comment);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/companies/:companyId/issues/:id/comments
router.get("/:companyId/issues/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const comments = await issuesService.listComments(
      String(req.params.companyId),
      String(req.params.id),
    );
    res.json({ data: comments, count: comments.length });
  } catch (err) {
    next(err);
  }
});

export { router as issuesRouter };
