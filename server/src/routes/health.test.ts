import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { healthRouter } from "./health.js";
import { loadConfig, resetConfig } from "../config.js";
import { createApp } from "../app.js";

// ─── Minimal app fixture (health router only — no DB, no other routes) ────────
function buildMinimalApp() {
  const app = express();
  app.use(express.json());
  app.use("/health", healthRouter);
  app.use("/api/health", healthRouter);
  return app;
}

describe("GET /health — minimal fixture (no DB)", () => {
  const app = buildMinimalApp();

  it("returns HTTP 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("response body has status 'ok'", async () => {
    const res = await request(app).get("/health");
    expect(res.body.status).toBe("ok");
  });

  it("timestamp is a number (epoch ms), not a string", async () => {
    const res = await request(app).get("/health");
    expect(typeof res.body.timestamp).toBe("number");
  });

  it("timestamp is a reasonable epoch-ms value (> year 2020)", async () => {
    const before = Date.now();
    const res = await request(app).get("/health");
    const after = Date.now();
    expect(res.body.timestamp).toBeGreaterThanOrEqual(before);
    expect(res.body.timestamp).toBeLessThanOrEqual(after);
  });

  it("response body does NOT contain 'version' field (removed per spec)", async () => {
    const res = await request(app).get("/health");
    expect(res.body.version).toBeUndefined();
  });

  it("response body does NOT contain 'uptime' field (removed per spec)", async () => {
    const res = await request(app).get("/health");
    expect(res.body.uptime).toBeUndefined();
  });

  it("response body has exactly the expected keys", async () => {
    const res = await request(app).get("/health");
    expect(Object.keys(res.body).sort()).toEqual(["status", "timestamp"]);
  });

  it("content-type is application/json", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});

describe("GET /api/health — minimal fixture", () => {
  const app = buildMinimalApp();

  it("returns HTTP 200 at /api/health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });

  it("same router: /api/health response matches /health", async () => {
    const r1 = await request(app).get("/health");
    const r2 = await request(app).get("/api/health");
    expect(r1.body.status).toBe(r2.body.status);
    expect(typeof r2.body.timestamp).toBe("number");
  });
});

describe("GET /api/health — full app fixture", () => {
  beforeAll(() => {
    resetConfig();
    loadConfig();
  });

  it("returns HTTP 200 via full app", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });

  it("full app: timestamp is numeric epoch ms", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health");
    expect(typeof res.body.timestamp).toBe("number");
    expect(res.body.timestamp).toBeGreaterThan(0);
  });

  it("full app: status is 'ok'", async () => {
    const app = createApp();
    const res = await request(app).get("/api/health");
    expect(res.body.status).toBe("ok");
  });
});

describe("Edge cases", () => {
  const app = buildMinimalApp();

  it("GET /health with Accept: text/html still returns JSON (Express default)", async () => {
    const res = await request(app).get("/health").set("Accept", "text/html");
    expect(res.status).toBe(200);
    expect(typeof res.body.timestamp).toBe("number");
  });

  it("POST /health returns 404 (route only handles GET)", async () => {
    const res = await request(app).post("/health");
    expect(res.status).toBe(404);
  });

  it("timestamp each request is monotonically non-decreasing", async () => {
    const r1 = await request(app).get("/health");
    const r2 = await request(app).get("/health");
    expect(r2.body.timestamp).toBeGreaterThanOrEqual(r1.body.timestamp);
  });
});
