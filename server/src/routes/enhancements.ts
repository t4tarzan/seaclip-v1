import { Router } from "express";
import * as enhancementsService from "../services/enhancements.js";

const router = Router();

// GET /api/enhancements — list all (with optional filters)
router.get("/", async (req, res, next) => {
  try {
    const { phase, status, category, parentId } = req.query;
    const items = await enhancementsService.listEnhancements({
      phase: phase as string | undefined,
      status: status as string | undefined,
      category: category as string | undefined,
      parentId: parentId === "null" ? null : (parentId as string | undefined),
    });
    res.json({ data: items, count: items.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/enhancements — create new enhancement
router.post("/", async (req, res, next) => {
  try {
    const item = await enhancementsService.createEnhancement(req.body);
    res.status(201).json({ data: item });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/enhancements/all — clear all (for re-seeding)
router.delete("/all", async (_req, res, next) => {
  try {
    await enhancementsService.deleteAll();
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/enhancements/stats — summary counts
router.get("/stats", async (_req, res, next) => {
  try {
    const stats = await enhancementsService.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/enhancements/next — get next pending task to work on
router.get("/next", async (req, res, next) => {
  try {
    const { phase } = req.query;
    const items = await enhancementsService.listEnhancements({
      status: "pending",
      phase: phase as string | undefined,
    });
    // Return the highest priority pending item that has no pending dependencies
    const allItems = await enhancementsService.listEnhancements();
    const statusById = new Map(allItems.map((i) => [i.id, i.status]));

    const ready = items.find((item) => {
      if (item.dependsOn.length === 0) return true;
      return item.dependsOn.every((depId) => statusById.get(depId) === "done");
    });

    res.json({ data: ready ?? null });
  } catch (err) {
    next(err);
  }
});

// GET /api/enhancements/:id
router.get("/:id", async (req, res, next) => {
  try {
    const item = await enhancementsService.getEnhancement(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Enhancement not found" });
      return;
    }
    res.json({ data: item });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/enhancements/:id — update status, notes, priority
router.patch("/:id", async (req, res, next) => {
  try {
    const item = await enhancementsService.updateEnhancement(req.params.id, req.body);
    if (!item) {
      res.status(404).json({ error: "Enhancement not found" });
      return;
    }
    res.json({ data: item });
  } catch (err) {
    next(err);
  }
});

export { router as enhancementsRouter };
