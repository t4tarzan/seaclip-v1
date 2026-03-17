/**
 * GitHub bridge routes — mounted at /api/github-bridge
 *
 * GET  /api/github-bridge/repos          List connected repos for a company
 * POST /api/github-bridge/repos          Connect a new repo
 * POST /api/github-bridge/webhook        Receive GitHub webhook events
 * POST /api/github-bridge/sync/:repoId   Manually trigger sync for a repo
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireCompanyAccess, validate } from "../middleware/index.js";
import {
  listConnectedRepos,
  connectRepo,
  getConnectedRepo,
  syncIssue,
  validateWebhookSignature,
} from "../services/github-bridge.js";
import { getConfig } from "../config.js";
import { getLogger } from "../middleware/logger.js";
import { AppError } from "../errors.js";

const router = Router();

const ConnectRepoSchema = z.object({
  companyId: z.string().uuid(),
  repoFullName: z.string().min(1).regex(/^[^/]+\/[^/]+$/, "Must be in owner/repo format"),
});

const WebhookSchema = z.object({
  action: z.string().optional(),
  repository: z
    .object({
      id: z.number(),
      full_name: z.string(),
    })
    .optional(),
  issue: z
    .object({
      number: z.number(),
    })
    .optional(),
});

// GET /api/github-bridge/repos?companyId=<uuid>
router.get("/repos", requireAuth, async (req, res, next) => {
  try {
    const companyId = String(req.query.companyId ?? "");
    if (!companyId) {
      throw new AppError(400, "companyId query param is required");
    }
    requireCompanyAccess(req, companyId);
    const repos = await listConnectedRepos(companyId);
    res.json({ data: repos, count: repos.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/github-bridge/repos
router.post("/repos", requireAuth, validate(ConnectRepoSchema), async (req, res, next) => {
  try {
    const { companyId, repoFullName } = req.body as z.infer<typeof ConnectRepoSchema>;
    requireCompanyAccess(req, companyId);
    const repo = await connectRepo(companyId, repoFullName);
    res.status(201).json(repo);
  } catch (err) {
    next(err);
  }
});

// POST /api/github-bridge/webhook
// GitHub sends a raw body + X-Hub-Signature-256 header
router.post("/webhook", async (req, res, next) => {
  try {
    const config = getConfig();
    const logger = getLogger();

    const signature = String(req.headers["x-hub-signature-256"] ?? "");
    // Express has already parsed JSON body; we need raw bytes for HMAC
    // The raw body is available if express.raw() is in the middleware chain.
    // Fallback: re-serialize the parsed body.
    const rawBody =
      typeof (req as unknown as { rawBody?: string }).rawBody === "string"
        ? (req as unknown as { rawBody: string }).rawBody
        : JSON.stringify(req.body);

    if (
      config.githubWebhookSecret &&
      !validateWebhookSignature(config.githubWebhookSecret, rawBody, signature)
    ) {
      throw new AppError(401, "Invalid webhook signature");
    }

    const parsed = WebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    const { action, repository, issue } = parsed.data;

    logger.info({ action, repo: repository?.full_name, issue: issue?.number }, "GitHub webhook received");

    if (action === "opened" || action === "edited") {
      if (repository?.full_name && issue?.number) {
        // Sync in background — don't block the webhook response
        syncIssue(repository.full_name, issue.number).catch((err: unknown) => {
          logger.error({ err, repo: repository.full_name }, "GitHub webhook: sync failed");
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/github-bridge/sync/:repoId
router.post("/sync/:repoId", requireAuth, async (req, res, next) => {
  try {
    const companyId = String(req.query.companyId ?? "");
    if (!companyId) {
      throw new AppError(400, "companyId query param is required");
    }
    requireCompanyAccess(req, companyId);

    const repo = await getConnectedRepo(companyId, String(req.params.repoId));
    // Sync the first issue as a connectivity probe; real usage would page through all
    await syncIssue(repo.repoFullName, 1);
    res.json({ synced: true, repoFullName: repo.repoFullName });
  } catch (err) {
    next(err);
  }
});

export { router as githubBridgeRouter };
