/**
 * Unit tests for server/src/services/github-poller.ts
 *
 * Tests start/stop behavior using fake timers.
 * The tick function is never triggered (no clock advancement),
 * so DB/GitHub dependencies are never called.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies to make the module importable
vi.mock("../middleware/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock("../db.js", () => ({ getDb: vi.fn() }));
vi.mock("@seaclip/db", () => ({ githubRepos: {} }));
vi.mock("../services/github-bridge.js", () => ({ syncIssue: vi.fn() }));

import { startGithubPoller, stopGithubPoller } from "../services/github-poller.js";

describe("github-poller", () => {
  beforeEach(() => {
    // Always stop the poller so each test starts clean
    try { stopGithubPoller(); } catch { /* ignore if not running */ }
    vi.useFakeTimers();
  });

  it("startGithubPoller sets up an interval", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    startGithubPoller(60_000);
    expect(setIntervalSpy).toHaveBeenCalledOnce();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    stopGithubPoller();
  });

  it("stopGithubPoller clears the interval", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    startGithubPoller(60_000);
    stopGithubPoller();
    expect(clearIntervalSpy).toHaveBeenCalledOnce();
  });

  it("calling startGithubPoller twice does not create a second interval", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    startGithubPoller(60_000);
    startGithubPoller(60_000); // second call is a no-op
    expect(setIntervalSpy).toHaveBeenCalledOnce();
    stopGithubPoller();
  });

  it("calling stopGithubPoller when not running does not throw", () => {
    // Poller is already stopped in beforeEach
    expect(() => stopGithubPoller()).not.toThrow();
  });

  it("poller can be restarted after stopping", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    startGithubPoller(60_000);
    stopGithubPoller();
    startGithubPoller(60_000);
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    stopGithubPoller();
  });

  it("uses the provided interval in milliseconds", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const CUSTOM_INTERVAL = 2 * 60 * 1000;
    startGithubPoller(CUSTOM_INTERVAL);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), CUSTOM_INTERVAL);
    stopGithubPoller();
  });
});
