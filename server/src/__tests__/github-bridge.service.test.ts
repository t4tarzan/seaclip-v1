/**
 * Unit tests for server/src/services/github-bridge.ts
 *
 * Tests validateWebhookSignature (pure function) and listRepos (mocked fetch).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

// Mock all external dependencies so we can import the service safely
vi.mock("../db.js", () => ({ getDb: vi.fn() }));
vi.mock("@seaclip/db", () => ({ githubRepos: {}, eq: vi.fn(), and: vi.fn() }));
vi.mock("../config.js", () => ({
  getConfig: vi.fn(() => ({
    githubToken: "test-token",
    githubWebhookSecret: "test-secret",
  })),
}));
vi.mock("../errors.js", () => ({
  notFound: (msg: string) => new Error(msg),
  conflict: (msg: string) => new Error(msg),
}));
vi.mock("../middleware/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { validateWebhookSignature, listRepos } from "../services/github-bridge.js";

// ---------------------------------------------------------------------------
// validateWebhookSignature
// ---------------------------------------------------------------------------

describe("validateWebhookSignature", () => {
  function makeSignature(secret: string, body: string): string {
    const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return `sha256=${hex}`;
  }

  it("returns true for a valid signature", () => {
    const secret = "my-webhook-secret";
    const body = JSON.stringify({ action: "opened" });
    const sig = makeSignature(secret, body);
    expect(validateWebhookSignature(secret, body, sig)).toBe(true);
  });

  it("returns false for a tampered body", () => {
    const secret = "my-webhook-secret";
    const body = JSON.stringify({ action: "opened" });
    const sig = makeSignature(secret, body);
    const tamperedBody = JSON.stringify({ action: "deleted" });
    expect(validateWebhookSignature(secret, tamperedBody, sig)).toBe(false);
  });

  it("returns false for a wrong secret", () => {
    const body = JSON.stringify({ action: "opened" });
    const sig = makeSignature("correct-secret", body);
    expect(validateWebhookSignature("wrong-secret", body, sig)).toBe(false);
  });

  it("returns false when signature is missing sha256= prefix", () => {
    const secret = "secret";
    const body = "test";
    const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(validateWebhookSignature(secret, body, hex)).toBe(false);
  });

  it("returns false when secret is empty", () => {
    expect(validateWebhookSignature("", "body", "sha256=abc")).toBe(false);
  });

  it("returns false when signature is empty string", () => {
    expect(validateWebhookSignature("secret", "body", "")).toBe(false);
  });

  it("handles unicode body correctly", () => {
    const secret = "unicode-secret";
    const body = "héllo wörld 🚀";
    const sig = makeSignature(secret, body);
    expect(validateWebhookSignature(secret, body, sig)).toBe(true);
  });

  it("is case-sensitive in the hex digest", () => {
    const secret = "secret";
    const body = "body";
    const sig = makeSignature(secret, body);
    // Uppercase the hex part
    const upperSig = sig.replace(/[0-9a-f]+$/, (m) => m.toUpperCase());
    // sha256= prefix is preserved but hex is uppercase — should fail (timingSafeEqual mismatch)
    expect(validateWebhookSignature(secret, body, upperSig)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listRepos (mocked fetch)
// ---------------------------------------------------------------------------

describe("listRepos", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns mapped repos on success", async () => {
    const fakeRepos = [
      { id: 1, full_name: "owner/repo-a", default_branch: "main" },
      { id: 2, full_name: "owner/repo-b", default_branch: "develop" },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeRepos,
    });

    const result = await listRepos("my-pat");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, full_name: "owner/repo-a", default_branch: "main" });
    expect(result[1]).toEqual({ id: 2, full_name: "owner/repo-b", default_branch: "develop" });
  });

  it("sends Authorization header with the provided token", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    await listRepos("test-token-123");

    const [_url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token-123");
  });

  it("throws on GitHub API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(listRepos("bad-token")).rejects.toThrow();
  });

  it("returns empty array when GitHub returns empty list", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    const result = await listRepos("valid-token");
    expect(result).toEqual([]);
  });
});
