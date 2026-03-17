import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "./config.js";
import { requestLogger, errorHandler } from "./middleware/index.js";

// Route modules
import { healthRouter } from "./routes/health.js";
import { companiesRouter } from "./routes/companies.js";
import { agentsRouter } from "./routes/agents.js";
import { issuesRouter } from "./routes/issues.js";
import { projectsRouter } from "./routes/projects.js";
import { goalsRouter } from "./routes/goals.js";
import { approvalsRouter } from "./routes/approvals.js";
import { costsRouter } from "./routes/costs.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { activityRouter } from "./routes/activity.js";
import { edgeDevicesRouter } from "./routes/edge-devices.js";
import { hubFederationRouter } from "./routes/hub-federation.js";
import { spokeRouter } from "./routes/spoke.js";
import { enhancementsRouter } from "./routes/enhancements.js";
import { spokeTasksRouter } from "./routes/spoke-tasks.js";
import { pullRequestsRouter } from "./routes/pull-requests.js";
import { sidebarBadgesRouter } from "./routes/sidebar-badges.js";
import { githubBridgeRouter } from "./routes/github-bridge.js";
import { identifyRouter } from "./routes/identify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(): express.Express {
  const config = getConfig();
  const app = express();

  // ─── Trust proxy (for IP logging behind load balancers) ───────────────────
  app.set("trust proxy", 1);

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    }),
  );

  // ─── Body parsing ─────────────────────────────────────────────────────────
  // The verify callback captures raw bytes before JSON parsing so that
  // POST /api/github-bridge/webhook can run HMAC-SHA256 against the original
  // wire bytes rather than a re-serialized object.
  app.use(
    express.json({
      limit: "10mb",
      verify: (_req, _res, buf) => {
        (_req as unknown as { rawBody: string }).rawBody = buf.toString("utf8");
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ─── Request logging ──────────────────────────────────────────────────────
  app.use(requestLogger);

  // ─── API Routes ───────────────────────────────────────────────────────────
  app.use("/health", healthRouter);
  app.use("/api/health", healthRouter);
  app.use("/api/companies", companiesRouter);

  // Nested company routes
  app.use("/api/companies", agentsRouter);
  app.use("/api/companies", issuesRouter);
  app.use("/api/companies", projectsRouter);
  app.use("/api/companies", goalsRouter);
  app.use("/api/companies", approvalsRouter);
  app.use("/api/companies", costsRouter);
  app.use("/api/companies", dashboardRouter);
  app.use("/api/companies", activityRouter);
  app.use("/api/companies", edgeDevicesRouter);

  // Federation routes
  app.use("/api/federation", hubFederationRouter);

  // Spoke (thin-client) routes — no auth required (device-level endpoints)
  app.use("/api/spoke", spokeRouter);

  // Spoke tasks and pull requests (company-scoped)
  app.use("/api/companies", spokeTasksRouter);
  app.use("/api/companies", pullRequestsRouter);

  // Sidebar badge counts
  app.use("/api/companies", sidebarBadgesRouter);

  // Enhancements (internal dev task tracking)
  app.use("/api/enhancements", enhancementsRouter);

  // GitHub bridge — repo connection + webhook ingestion
  app.use("/api/github-bridge", githubBridgeRouter);

  // Identify / onboarding
  app.use("/api/identify", identifyRouter);

  // ─── Static UI (optional) ─────────────────────────────────────────────────
  if (config.serveUi) {
    const uiDist = path.resolve(__dirname, "../../ui/dist");
    app.use(express.static(uiDist));

    // SPA fallback — serve index.html for all non-API routes
    app.get(/^(?!\/api|\/health).*/, (_req, res) => {
      res.sendFile(path.join(uiDist, "index.html"));
    });
  }

  // ─── Error handler (must be last) ─────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
