import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import * as projectsService from "../services/projects.js";

const router = Router({ mergeParams: true });

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateProjectSchema = CreateProjectSchema.partial();

router.get("/:companyId/projects", requireAuth, async (req, res, next) => {
  try {
    const projects = await projectsService.listProjects(String(req.params.companyId));
    res.json({ data: projects, count: projects.length });
  } catch (err) {
    next(err);
  }
});

router.post("/:companyId/projects", requireAuth, validate(CreateProjectSchema), async (req, res, next) => {
  try {
    const project = await projectsService.createProject(String(req.params.companyId), req.body);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

router.get("/:companyId/projects/:id", requireAuth, async (req, res, next) => {
  try {
    const project = await projectsService.getProject(String(req.params.companyId), String(req.params.id));
    res.json(project);
  } catch (err) {
    next(err);
  }
});

router.patch("/:companyId/projects/:id", requireAuth, validate(UpdateProjectSchema), async (req, res, next) => {
  try {
    const project = await projectsService.updateProject(String(req.params.companyId), String(req.params.id), req.body);
    res.json(project);
  } catch (err) {
    next(err);
  }
});

router.delete("/:companyId/projects/:id", requireAuth, async (req, res, next) => {
  try {
    await projectsService.deleteProject(String(req.params.companyId), String(req.params.id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export { router as projectsRouter };
