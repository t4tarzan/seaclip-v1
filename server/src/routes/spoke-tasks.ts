import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import * as spokeTasksService from "../services/spoke-tasks.js";
import { publishLiveEvent } from "../services/live-events.js";

const router = Router({ mergeParams: true });

const CreateSpokeTaskSchema = z.object({
  deviceId: z.string().uuid(),
  issueId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  repoUrl: z.string().min(1),
  branch: z.string().optional(),
  worktreePath: z.string().optional(),
});

const UpdateStatusSchema = z.object({
  status: z.enum(["pending", "assigned", "in_progress", "pr_raised", "merged", "done"]),
});

// GET /api/companies/:companyId/spoke-tasks
router.get("/:companyId/spoke-tasks", requireAuth, async (req, res, next) => {
  try {
    const { deviceId, status } = req.query;
    const tasks = await spokeTasksService.listTasks(String(req.params.companyId), {
      deviceId: deviceId as string | undefined,
      status: status as string | undefined,
    });
    res.json({ data: tasks, count: tasks.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:companyId/spoke-tasks
router.post("/:companyId/spoke-tasks", requireAuth, validate(CreateSpokeTaskSchema), async (req, res, next) => {
  try {
    const task = await spokeTasksService.createTask(String(req.params.companyId), req.body);
    await publishLiveEvent(String(req.params.companyId), { type: "spoke_task.created", task });
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:companyId/spoke-tasks/:taskId
router.get("/:companyId/spoke-tasks/:taskId", requireAuth, async (req, res, next) => {
  try {
    const task = await spokeTasksService.getTask(String(req.params.taskId));
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/companies/:companyId/spoke-tasks/:taskId/status
router.patch("/:companyId/spoke-tasks/:taskId/status", requireAuth, validate(UpdateStatusSchema), async (req, res, next) => {
  try {
    const task = await spokeTasksService.updateTaskStatus(
      String(req.params.taskId),
      req.body.status,
    );
    await publishLiveEvent(String(req.params.companyId), { type: "spoke_task.status_updated", task });
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

export { router as spokeTasksRouter };
