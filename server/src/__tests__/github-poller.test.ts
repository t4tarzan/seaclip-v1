/**
 * Unit tests for server/src/services/github-poller.ts
 *
 * Tests start/stop behavior using fake timers, plus verifies the core
 * invariant: lastCommentCheckAt is always stamped after a poll tick,
 * even when zero new comments are found.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock declarations — must come before dynamic imports
// ---------------------------------------------------------------------------

const mockUpdateIssue = vi.fn().mockResolvedValue({});
const mockGetIssue = vi.fn().mockResolvedValue({ status: "open" });
const mockAddComment = vi.fn().mockResolvedValue({});
const mockCreateApproval = vi.fn().mockResolvedValue({});
const mockGetCommentsSince = vi.fn().mockResolvedValue([]);

let issueRows: unknown[] = [];
let repoRows: unknown[] = [];

vi.mock("../middleware/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../db.js", () => ({
  getDb: () => ({
    select: () => ({
      from: (table: unknown) => {
        // Determine which table is being queried by a simple identity check
        if (table === "issues-table-sentinel") {
          return { where: () => Promise.resolve(issueRows) };
        }
        // repos table
        return Promise.resolve(repoRows);
      },
    }),
  }),
}));

vi.mock("@seaclip/db", () => ({
  githubRepos: "repos-table-sentinel",
  issues: "issues-table-sentinel",
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => "eq-clause"),
  and: vi.fn((...args: unknown[]) => args),
  isNotNull: vi.fn((_a: unknown) => "isNotNull-clause"),
}));

vi.mock("../services/github-bridge.js", () => ({
  getCommentsSince: (...args: unknown[]) => mockGetCommentsSince(...args),
}));

vi.mock("../services/index.js", () => ({
  issuesService: {
    updateIssue: (...args: unknown[]) => mockUpdateIssue(...args),
    getIssue: (...args: unknown[]) => mockGetIssue(...args),
    addComment: (...args: unknown[]) => mockAddComment(...args),
  },
  approvalsService: {
    createApproval: (...args: unknown[]) => mockCreateApproval(...args),
  },
}));

import { startGithubPoller, stopGithubPoller } from "../services/github-poller.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const REPO = {
  id: "repo-1",
  companyId: "company-1",
  repoFullName: "owner/repo",
  githubRepoId: 12345,
  defaultBranch: "main",
  webhookId: null,
  installedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ISSUE_ROW = {
  id: "issue-1",
  companyId: "company-1",
  githubIssueId: 42,
  githubRepoId: "repo-1",
  metadata: {},
  status: "open",
  assigneeAgentId: null,
  title: "Test issue",
  description: null,
  priority: "medium",
  issueNumber: 1,
  identifier: "SC-1",
  requestDepth: 0,
  billingCode: null,
  externalId: null,
  projectId: null,
  goalId: null,
  parentId: null,
  checkoutRunId: null,
  executionRunId: null,
  createdByAgentId: null,
  createdByUserId: null,
  assigneeUserId: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Tests — lifecycle
// ---------------------------------------------------------------------------

describe("github-poller — lifecycle", () => {
  beforeEach(() => {
    try { stopGithubPoller(); } catch { /* ignore if not running */ }
    vi.useFakeTimers();
    vi.clearAllMocks();
    issueRows = [];
    repoRows = [];
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

// ---------------------------------------------------------------------------
// Tests — lastCommentCheckAt stamping invariant
// ---------------------------------------------------------------------------

describe("github-poller — lastCommentCheckAt stamping invariant", () => {
  beforeEach(() => {
    try { stopGithubPoller(); } catch { /* ignore */ }
    vi.clearAllMocks();
    issueRows = [];
    repoRows = [];
  });

  it("stamps lastCommentCheckAt even when zero new comments are found", async () => {
    issueRows = [ISSUE_ROW];
    repoRows = [REPO];
    mockGetCommentsSince.mockResolvedValue([]);

    vi.useFakeTimers();
    startGithubPoller(100);
    await vi.advanceTimersByTimeAsync(100);
    stopGithubPoller();
    vi.useRealTimers();

    expect(mockUpdateIssue).toHaveBeenCalledWith(
      ISSUE_ROW.companyId,
      ISSUE_ROW.id,
      expect.objectContaining({
        metadata: expect.objectContaining({
          lastCommentCheckAt: expect.any(String),
        }),
      }),
    );
  });

  it("stamps lastCommentCheckAt when new comments ARE found", async () => {
    issueRows = [ISSUE_ROW];
    repoRows = [REPO];
    mockGetCommentsSince.mockResolvedValue([
      {
        id: 101,
        body: "looks good",
        user: { login: "dev" },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    vi.useFakeTimers();
    startGithubPoller(100);
    await vi.advanceTimersByTimeAsync(100);
    stopGithubPoller();
    vi.useRealTimers();

    expect(mockAddComment).toHaveBeenCalledOnce();
    expect(mockUpdateIssue).toHaveBeenCalledWith(
      ISSUE_ROW.companyId,
      ISSUE_ROW.id,
      expect.objectContaining({
        metadata: expect.objectContaining({
          lastCommentCheckAt: expect.any(String),
        }),
      }),
    );
  });

  it("passes lastCommentCheckAt from metadata as the since param on subsequent ticks", async () => {
    const existingTimestamp = "2024-01-01T00:00:00.000Z";
    issueRows = [{ ...ISSUE_ROW, metadata: { lastCommentCheckAt: existingTimestamp } }];
    repoRows = [REPO];
    mockGetCommentsSince.mockResolvedValue([]);

    vi.useFakeTimers();
    startGithubPoller(100);
    await vi.advanceTimersByTimeAsync(100);
    stopGithubPoller();
    vi.useRealTimers();

    expect(mockGetCommentsSince).toHaveBeenCalledWith(
      REPO.repoFullName,
      ISSUE_ROW.githubIssueId,
      existingTimestamp,
    );
  });

  it("does NOT stamp lastCommentCheckAt when GitHub returns a 403 rate-limit error", async () => {
    issueRows = [ISSUE_ROW];
    repoRows = [REPO];
    mockGetCommentsSince.mockRejectedValue(new Error("GitHub API error 403: rate limit exceeded"));

    vi.useFakeTimers();
    startGithubPoller(100);
    await vi.advanceTimersByTimeAsync(100);
    stopGithubPoller();
    vi.useRealTimers();

    expect(mockUpdateIssue).not.toHaveBeenCalled();
  });

  it("does NOT stamp lastCommentCheckAt when GitHub returns a 429 rate-limit error", async () => {
    issueRows = [ISSUE_ROW];
    repoRows = [REPO];
    mockGetCommentsSince.mockRejectedValue(new Error("GitHub API error 429: too many requests"));

    vi.useFakeTimers();
    startGithubPoller(100);
    await vi.advanceTimersByTimeAsync(100);
    stopGithubPoller();
    vi.useRealTimers();

    expect(mockUpdateIssue).not.toHaveBeenCalled();
  });

  it("does NOT stamp when GitHub returns a non-rate-limit error (e.g. 500)", async () => {
    issueRows = [ISSUE_ROW];
    repoRows = [REPO];
    mockGetCommentsSince.mockRejectedValue(new Error("GitHub API error 500: internal server error"));

    vi.useFakeTimers();
    startGithubPoller(100);
    await vi.advanceTimersByTimeAsync(100);
    stopGithubPoller();
    vi.useRealTimers();

    expect(mockUpdateIssue).not.toHaveBeenCalled();
  });

  it("still stamps lastCommentCheckAt even when addComment fails for a comment", async () => {
    issueRows = [ISSUE_ROW];
    repoRows = [REPO];
    mockGetCommentsSince.mockResolvedValue([
      {
        id: 202,
        body: "failing comment",
        user: { login: "dev" },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    mockAddComment.mockRejectedValue(new Error("DB write error"));

    vi.useFakeTimers();
    startGithubPoller(100);
    await vi.advanceTimersByTimeAsync(100);
    stopGithubPoller();
    vi.useRealTimers();

    // stamp should still happen even though addComment threw
    expect(mockUpdateIssue).toHaveBeenCalledWith(
      ISSUE_ROW.companyId,
      ISSUE_ROW.id,
      expect.objectContaining({
        metadata: expect.objectContaining({
          lastCommentCheckAt: expect.any(String),
        }),
      }),
    );
  });

  it("skips issues that have no githubRepoId", async () => {
    issueRows = [{ ...ISSUE_ROW, githubRepoId: null }];
    repoRows = [REPO];
    mockGetCommentsSince.mockResolvedValue([]);

    vi.useFakeTimers();
    startGithubPoller(100);
    await vi.advanceTimersByTimeAsync(100);
    stopGithubPoller();
    vi.useRealTimers();

    expect(mockGetCommentsSince).not.toHaveBeenCalled();
    expect(mockUpdateIssue).not.toHaveBeenCalled();
  });

  it("skips issue when its githubRepoId does not match any connected repo", async () => {
    issueRows = [{ ...ISSUE_ROW, githubRepoId: "unknown-repo-id" }];
    repoRows = [REPO]; // REPO.id = "repo-1", not "unknown-repo-id"
    mockGetCommentsSince.mockResolvedValue([]);

    vi.useFakeTimers();
    startGithubPoller(100);
    await vi.advanceTimersByTimeAsync(100);
    stopGithubPoller();
    vi.useRealTimers();

    expect(mockGetCommentsSince).not.toHaveBeenCalled();
    expect(mockUpdateIssue).not.toHaveBeenCalled();
  });

  it("preserves existing metadata fields when stamping lastCommentCheckAt", async () => {
    issueRows = [
      {
        ...ISSUE_ROW,
        metadata: {
          lastCommentCheckAt: "2024-01-01T00:00:00.000Z",
          importedGhCommentIds: [1, 2, 3],
          customField: "should-survive",
        },
      },
    ];
    repoRows = [REPO];
    mockGetCommentsSince.mockResolvedValue([]);

    vi.useFakeTimers();
    startGithubPoller(100);
    await vi.advanceTimersByTimeAsync(100);
    stopGithubPoller();
    vi.useRealTimers();

    expect(mockUpdateIssue).toHaveBeenCalledWith(
      ISSUE_ROW.companyId,
      ISSUE_ROW.id,
      expect.objectContaining({
        metadata: expect.objectContaining({
          lastCommentCheckAt: expect.any(String),
          importedGhCommentIds: [1, 2, 3],
          customField: "should-survive",
        }),
      }),
    );
  });
});
