import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

const startTime = Date.now();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    version: process.env.npm_package_version ?? "0.1.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

router.get("/spoke-agent.sh", (_req, res) => {
  const scriptPath = path.join(__dirname, "../../../scripts/spoke-agent.sh");
  res.setHeader("Content-Type", "application/x-shellscript");
  res.download(scriptPath, "spoke-agent.sh", (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: "Spoke agent script not found" });
    }
  });
});

export { router as healthRouter };
