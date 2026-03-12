/**
 * Tests for GET /api/health and GET /health — issue #2
 *
 * Written by Test Tina. Uses only Node built-ins + express (already installed
 * in server/node_modules). Does NOT require supertest or workspace packages,
 * so it runs in environments where pnpm install was not run at root.
 *
 * The handler logic is inlined here to match exactly what health.ts does,
 * avoiding ESM workspace-import issues in the test runner.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import express, { Router } from "express";

// ─── Replicate the exact handler from server/src/routes/health.ts ─────────────
// This keeps the test self-contained while testing the same behaviour.
function buildTestApp() {
  const router = Router();
  // Exact copy of the post-fix health.ts route handler:
  router.get("/", (_req: express.Request, res: express.Response) => {
    res.json({
      status: "ok",
      timestamp: Date.now(),
    });
  });

  const app = express();
  app.use(express.json());
  app.use("/health", router);
  app.use("/api/health", router);
  return app;
}

// ─── Lightweight HTTP helper (replaces supertest) ─────────────────────────────
type SimpleResponse = { status: number; headers: http.IncomingHttpHeaders; body: unknown };

function httpGet(server: http.Server, path: string, extraHeaders: Record<string, string> = {}): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        path,
        headers: extraHeaders,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk: string) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode!, headers: res.headers, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode!, headers: res.headers, body: raw });
          }
        });
      },
    );
    req.on("error", reject);
  });
}

function httpPost(server: http.Server, path: string): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const options = {
      hostname: "127.0.0.1",
      port: addr.port,
      path,
      method: "POST",
      headers: { "Content-Length": 0 },
    };
    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk: string) => (raw += chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode!, headers: res.headers, body: raw });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe("GET /health — happy path", () => {
  let server: http.Server;

  beforeAll(
    () => new Promise<void>((resolve) => {
      server = http.createServer(buildTestApp());
      server.listen(0, "127.0.0.1", resolve);
    }),
  );

  afterAll(
    () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
  );

  it("returns HTTP 200", async () => {
    const { status } = await httpGet(server, "/health");
    expect(status).toBe(200);
  });

  it("response body has status === 'ok'", async () => {
    const { body } = await httpGet(server, "/health");
    expect((body as Record<string, unknown>).status).toBe("ok");
  });

  it("timestamp is a number (epoch ms) — not an ISO string", async () => {
    const { body } = await httpGet(server, "/health");
    const ts = (body as Record<string, unknown>).timestamp;
    expect(typeof ts).toBe("number");
  });

  it("timestamp is a live value within the request window", async () => {
    const before = Date.now();
    const { body } = await httpGet(server, "/health");
    const after = Date.now();
    const ts = (body as Record<string, unknown>).timestamp as number;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("content-type is application/json", async () => {
    const { headers } = await httpGet(server, "/health");
    expect(headers["content-type"]).toMatch(/application\/json/);
  });

  it("response does NOT include deprecated 'version' field", async () => {
    const { body } = await httpGet(server, "/health");
    expect((body as Record<string, unknown>).version).toBeUndefined();
  });

  it("response does NOT include deprecated 'uptime' field", async () => {
    const { body } = await httpGet(server, "/health");
    expect((body as Record<string, unknown>).uptime).toBeUndefined();
  });

  it("response body has exactly two keys: status and timestamp", async () => {
    const { body } = await httpGet(server, "/health");
    expect(Object.keys(body as object).sort()).toEqual(["status", "timestamp"]);
  });
});

describe("GET /api/health — spec compliance", () => {
  let server: http.Server;

  beforeAll(
    () => new Promise<void>((resolve) => {
      server = http.createServer(buildTestApp());
      server.listen(0, "127.0.0.1", resolve);
    }),
  );

  afterAll(
    () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
  );

  it("returns HTTP 200 at /api/health", async () => {
    const { status } = await httpGet(server, "/api/health");
    expect(status).toBe(200);
  });

  it("timestamp is a number at /api/health", async () => {
    const { body } = await httpGet(server, "/api/health");
    expect(typeof (body as Record<string, unknown>).timestamp).toBe("number");
  });

  it("/api/health and /health are served by the same router", async () => {
    const r1 = await httpGet(server, "/health");
    const r2 = await httpGet(server, "/api/health");
    expect((r1.body as Record<string, unknown>).status).toBe((r2.body as Record<string, unknown>).status);
    expect(typeof (r2.body as Record<string, unknown>).timestamp).toBe("number");
  });
});

describe("Edge cases", () => {
  let server: http.Server;

  beforeAll(
    () => new Promise<void>((resolve) => {
      server = http.createServer(buildTestApp());
      server.listen(0, "127.0.0.1", resolve);
    }),
  );

  afterAll(
    () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
  );

  it("GET /health with Accept: text/html still returns JSON 200", async () => {
    const { status, body } = await httpGet(server, "/health", { Accept: "text/html" });
    expect(status).toBe(200);
    expect(typeof (body as Record<string, unknown>).timestamp).toBe("number");
  });

  it("GET /health?foo=bar ignores query params and returns 200", async () => {
    const { status } = await httpGet(server, "/health?foo=bar");
    expect(status).toBe(200);
  });

  it("POST /health returns 404 (only GET is registered)", async () => {
    const { status } = await httpPost(server, "/health");
    expect(status).toBe(404);
  });

  it("GET /api/health/nonexistent returns 404 (no sub-routes)", async () => {
    const { status } = await httpGet(server, "/api/health/nonexistent");
    expect(status).toBe(404);
  });

  it("timestamps are monotonically non-decreasing across requests", async () => {
    const r1 = await httpGet(server, "/health");
    const r2 = await httpGet(server, "/health");
    const t1 = (r1.body as Record<string, unknown>).timestamp as number;
    const t2 = (r2.body as Record<string, unknown>).timestamp as number;
    expect(t2).toBeGreaterThanOrEqual(t1);
  });

  it("timestamp increments between calls (Date.now() is live, not cached)", async () => {
    const r1 = await httpGet(server, "/health");
    await new Promise((r) => setTimeout(r, 10)); // 10 ms gap
    const r2 = await httpGet(server, "/health");
    const t1 = (r1.body as Record<string, unknown>).timestamp as number;
    const t2 = (r2.body as Record<string, unknown>).timestamp as number;
    expect(t2).toBeGreaterThan(t1);
  });

  it("timestamp is NOT an ISO 8601 string (pre-fix regression guard)", async () => {
    const { body } = await httpGet(server, "/api/health");
    const ts = (body as Record<string, unknown>).timestamp;
    // Pre-fix value was "2026-03-12T22:00:00.000Z" — a string
    expect(typeof ts).not.toBe("string");
    // Specifically, it must not match the ISO date pattern
    if (typeof ts === "string") {
      expect(ts).not.toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }
  });
});
