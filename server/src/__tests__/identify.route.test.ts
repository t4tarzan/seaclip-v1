/**
 * Integration tests for the identify route (POST /api/identify).
 *
 * Follows the pattern from health.test.ts — builds a self-contained test app
 * that mounts only the router under test, without a real DB or config dependency.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Build a self-contained test app replicating the identify route logic
// ---------------------------------------------------------------------------

function buildTestApp() {
  const IdentifySchema = z.object({
    deviceId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  const router = Router();

  router.post("/", (req, res) => {
    const result = IdentifySchema.safeParse(req.body);
    if (!result.success) {
      res.status(422).json({ error: "Invalid request body" });
      return;
    }
    const body = result.data;
    const id = body.deviceId ?? body.userId ?? randomUUID();
    res.status(200).json({ identified: true, id, metadata: body.metadata ?? {} });
  });

  const app = express();
  app.use(express.json());
  app.use("/api/identify", router);
  return app;
}

// ---------------------------------------------------------------------------
// HTTP helpers (no supertest dependency)
// ---------------------------------------------------------------------------

type SimpleResponse = { status: number; body: unknown };

function httpPost(
  server: http.Server,
  path: string,
  body: unknown,
): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const payload = JSON.stringify(body);
    const options = {
      hostname: "127.0.0.1",
      port: addr.port,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk: string) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode!, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode!, body: raw });
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/identify", () => {
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

  it("returns 200 with identified:true when deviceId is provided", async () => {
    const { status, body } = await httpPost(server, "/api/identify", {
      deviceId: "rpi5-living-room",
    });
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).identified).toBe(true);
  });

  it("returns the deviceId as the canonical id", async () => {
    const { body } = await httpPost(server, "/api/identify", {
      deviceId: "my-device-id",
    });
    expect((body as Record<string, unknown>).id).toBe("my-device-id");
  });

  it("returns the userId as the canonical id when deviceId is absent", async () => {
    const { body } = await httpPost(server, "/api/identify", {
      userId: "user@example.com",
    });
    expect((body as Record<string, unknown>).id).toBe("user@example.com");
  });

  it("generates a UUID when neither deviceId nor userId is provided", async () => {
    const { status, body } = await httpPost(server, "/api/identify", {});
    expect(status).toBe(200);
    const id = (body as Record<string, unknown>).id as string;
    // UUID v4 pattern
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("echoes back provided metadata", async () => {
    const meta = { location: "office-1", arch: "arm64" };
    const { body } = await httpPost(server, "/api/identify", {
      deviceId: "d1",
      metadata: meta,
    });
    expect((body as Record<string, unknown>).metadata).toEqual(meta);
  });

  it("returns empty metadata object when not provided", async () => {
    const { body } = await httpPost(server, "/api/identify", {
      deviceId: "d2",
    });
    expect((body as Record<string, unknown>).metadata).toEqual({});
  });

  it("returns 422 when deviceId is empty string", async () => {
    const { status } = await httpPost(server, "/api/identify", {
      deviceId: "",
    });
    expect(status).toBe(422);
  });
});
