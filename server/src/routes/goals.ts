import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import * as goalsService from "../services/goals.js";

const router = Router({ mergeParams: true });

const CreateGoalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  status: z.enum(["draft", "active", "achieved", "abandoned"]).default("draft"),
  targetDate: z.string().datetime().optional(),
  projectId: z.string().uuid().optional(),
  parentGoalId: z.string().uuid().optional(),
  metricType: z.enum(["boolean", "numeric", "percentage"]).default("boolean"),
  metricTarget: z.number().optional(),
  metricCurrent: z.number().default(0),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateGoalSchema = CreateGoalSchema.partial();

router.get("/:companyId/goals", requireAuth, async (req, res, next) => {
  try {
    const goals = await goalsService.listGoals(String(req.params.companyId));
    res.json({ data: goals, count: goals.length });
  } catch (err) {
    next(err);
  }
});

router.post("/:companyId/goals", requireAuth, validate(CreateGoalSchema), async (req, res, next) => {
  try {
    const goal = await goalsService.createGoal(String(req.params.companyId), req.body);
    res.status(201).json(goal);
  } catch (err) {
    next(err);
  }
});

router.get("/:companyId/goals/:id", requireAuth, async (req, res, next) => {
  try {
    const goal = await goalsService.getGoal(String(req.params.companyId), String(req.params.id));
    res.json(goal);
  } catch (err) {
    next(err);
  }
});

router.patch("/:companyId/goals/:id", requireAuth, validate(UpdateGoalSchema), async (req, res, next) => {
  try {
    const goal = await goalsService.updateGoal(String(req.params.companyId), String(req.params.id), req.body);
    res.json(goal);
  } catch (err) {
    next(err);
  }
});

router.delete("/:companyId/goals/:id", requireAuth, async (req, res, next) => {
  try {
    await goalsService.deleteGoal(String(req.params.companyId), String(req.params.id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export { router as goalsRouter };
