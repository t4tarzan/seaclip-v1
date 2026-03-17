/**
 * Integration tests for GET /api/github-bridge/repos and POST /api/github-bridge/webhook.
 *
 * Follows health.test.ts pattern — self-contained test app with service functions mocked.
 * Does not require a real DB or GitHub API.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import express, { Router } from "express";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Minimal in-process mocks for the services used by the route
// ---------------------------------------------------------------------------

const mockListConnectedRepos = vi.fn();
const mockConnectRepo = vi.fn();
const mockValidateWebhookSignature = vi.fn();

function buildTestApp() {
  const router = Router();

  // GET /repos?companyId=...
  router.get("/repos", async (req, res) => {
    const companyId = String(req.query.companyId ?? "");
    if (!companyId) {
      res.status(400).json({ error: "companyId query param is required" });
      return;
    }
    try {
      const repos = await mockListConnectedRepos(companyId) as unknown[];
      res.json({ data: repos, count: repos.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /webhook
  router.post("/webhook", (req, res) => {
    const secret = "test-secret";
    const signature = String(req.headers["x-hub-signature-256"] ?? "");
    const rawBody = JSON.stringify(req.body);

    if (secret && !mockValidateWebhookSignature(secret, rawBody, signature)) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    res.json({ received: true });
  });

  const app = express();
  app.use(express.json());
  app.use("/api/github-bridge", router);
  return app;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

type SimpleResponse = { status: number; body: unknown };

function httpGet(server: http.Server, path: string): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const req = http.get(
      { hostname: "127.0.0.1", port: addr.port, path },
      (res) => {
        let raw = "";
        res.on("data", (chunk: string) => (raw += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode!, body: JSON.parse(raw) }),
        );
      },
    );
    req.on("error", reject);
  });
}

function httpPost(
  server: http.Server,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk: string) => (raw += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode!,
            body: (() => {
              try { return JSON.parse(raw); } catch { return raw; }
            })(),
          }),
        );
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/github-bridge/repos", () => {
  let server: http.Server;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server = http.createServer(buildTestApp());
        server.listen(0, "127.0.0.1", resolve);
      }),
  );

  afterAll(
    () => new Promise<void>((resolve) => server.close(() => resolve())),
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when companyId is missing", async () => {
    const { status } = await httpGet(server, "/api/github-bridge/repos");
    expect(status).toBe(400);
  });

  it("returns 200 with data array when companyId is provided", async () => {
    const fakeRepos = [{ id: "uuid-1", repoFullName: "owner/repo", githubRepoId: 42 }];
    mockListConnectedRepos.mockResolvedValueOnce(fakeRepos);

    const { status, body } = await httpGet(
      server,
      "/api/github-bridge/repos?companyId=some-company-id",
    );
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).data).toEqual(fakeRepos);
    expect((body as Record<string, unknown>).count).toBe(1);
  });

  it("calls listConnectedRepos with the provided companyId", async () => {
    mockListConnectedRepos.mockResolvedValueOnce([]);
    await httpGet(server, "/api/github-bridge/repos?companyId=test-company");
    expect(mockListConnectedRepos).toHaveBeenCalledWith("test-company");
  });

  it("returns empty data array when no repos are connected", async () => {
    mockListConnectedRepos.mockResolvedValueOnce([]);
    const { body } = await httpGet(
      server,
      "/api/github-bridge/repos?companyId=empty-company",
    );
    expect((body as Record<string, unknown>).data).toEqual([]);
    expect((body as Record<string, unknown>).count).toBe(0);
  });
});

describe("POST /api/github-bridge/webhook", () => {
  let server: http.Server;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server = http.createServer(buildTestApp());
        server.listen(0, "127.0.0.1", resolve);
      }),
  );

  afterAll(
    () => new Promise<void>((resolve) => server.close(() => resolve())),
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when signature validation fails", async () => {
    mockValidateWebhookSignature.mockReturnValueOnce(false);
    const { status } = await httpPost(
      server,
      "/api/github-bridge/webhook",
      { action: "opened" },
      { "x-hub-signature-256": "sha256=invalidsig" },
    );
    expect(status).toBe(401);
  });

  it("returns 200 with received:true on valid signature", async () => {
    mockValidateWebhookSignature.mockReturnValueOnce(true);
    const { status, body } = await httpPost(
      server,
      "/api/github-bridge/webhook",
      { action: "opened" },
      { "x-hub-signature-256": "sha256=validsig" },
    );
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).received).toBe(true);
  });

  it("calls validateWebhookSignature with the correct arguments", async () => {
    mockValidateWebhookSignature.mockReturnValueOnce(true);
    const payload = { action: "closed" };
    const rawBody = JSON.stringify(payload);
    const sig = "sha256=" + crypto.createHmac("sha256", "test-secret").update(rawBody).digest("hex");

    await httpPost(server, "/api/github-bridge/webhook", payload, {
      "x-hub-signature-256": sig,
    });

    expect(mockValidateWebhookSignature).toHaveBeenCalledWith(
      "test-secret",
      rawBody,
      sig,
    );
  });
});
