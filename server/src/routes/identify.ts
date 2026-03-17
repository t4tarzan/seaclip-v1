/**
 * Identify / onboarding route — mounted at /api/identify
 *
 * POST /api/identify   Identify or onboard a device or user.
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import { randomUUID } from "node:crypto";

const router = Router();

const IdentifySchema = z.object({
  deviceId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * POST /api/identify
 *
 * Identifies a device or user. Returns a stable ID derived from the provided
 * deviceId/userId, or a new UUID if neither is provided.
 */
router.post("/", requireAuth, validate(IdentifySchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof IdentifySchema>;

    // Use deviceId or userId as the canonical ID when provided; otherwise generate one.
    const id = body.deviceId ?? body.userId ?? randomUUID();

    res.status(200).json({
      identified: true,
      id,
      metadata: body.metadata ?? {},
    });
  } catch (err) {
    next(err);
  }
});

export { router as identifyRouter };
