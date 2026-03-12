import { Router } from "express";
const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
  });
});

export { router as healthRouter };
