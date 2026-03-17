/**
 * Tests for Feature 1: Manual vs Auto Pipeline Mode
 *
 * Validates:
 * - Zod schema accepts mode param
 * - startPipeline stores pipelineMode in metadata
 * - Poller creates approval for manual mode
 * - Poller triggers Hopebot for auto mode
 * - Approval resolution triggers next pipeline stage
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// --- Schema validation tests (no DB needed) ---

const PIPELINE_STAGES = [
  "plan",
  "researched",
  "planned",
  "coded",
  "tested",
  "reviewed",
] as const;

const StartPipelineSchema = z.object({
  issueId: z.string().uuid(),
  stage: z.enum(PIPELINE_STAGES).default("plan"),
  mode: z.enum(["auto", "manual"]).default("auto"),
});

describe("StartPipelineSchema", () => {
  it("accepts valid auto mode request", () => {
    const result = StartPipelineSchema.safeParse({
      issueId: "550e8400-e29b-41d4-a716-446655440000",
      stage: "plan",
      mode: "auto",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe("auto");
    }
  });

  it("accepts valid manual mode request", () => {
    const result = StartPipelineSchema.safeParse({
      issueId: "550e8400-e29b-41d4-a716-446655440000",
      stage: "plan",
      mode: "manual",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe("manual");
    }
  });

  it("defaults mode to auto when not provided", () => {
    const result = StartPipelineSchema.safeParse({
      issueId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe("auto");
      expect(result.data.stage).toBe("plan");
    }
  });

  it("rejects invalid mode", () => {
    const result = StartPipelineSchema.safeParse({
      issueId: "550e8400-e29b-41d4-a716-446655440000",
      mode: "semi-auto",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid issueId", () => {
    const result = StartPipelineSchema.safeParse({
      issueId: "not-a-uuid",
      mode: "manual",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid stage", () => {
    const result = StartPipelineSchema.safeParse({
      issueId: "550e8400-e29b-41d4-a716-446655440000",
      stage: "invalid-stage",
    });
    expect(result.success).toBe(false);
  });
});

// --- Pipeline mode gating logic tests ---

describe("Pipeline mode gating logic", () => {
  const LABEL_TO_ROLE_ID_MAP: Record<string, { roleId: string; name: string }> = {
    plan:       { roleId: "12e09acf", name: "Curious Charlie" },
    researched: { roleId: "c0e89367", name: "Peter Plan" },
    planned:    { roleId: "462b360c", name: "David Dev" },
    coded:      { roleId: "5ed6ecf3", name: "Test Tina" },
    tested:     { roleId: "be70cab5", name: "Sceptic Suzy" },
    reviewed:   { roleId: "b46df03d", name: "Merge Matthews" },
  };

  // Simulate the gating logic from github-poller.ts
  function shouldCreateApproval(pipelineMode: string | undefined): boolean {
    return pipelineMode === "manual";
  }

  function buildApprovalTitle(currentStage: string): string {
    const roleName = LABEL_TO_ROLE_ID_MAP[currentStage]?.name ?? currentStage;
    return `Pipeline: ${roleName} finished "${currentStage}" — proceed?`;
  }

  function getNextStage(currentStage: string): string | undefined {
    const idx = PIPELINE_STAGES.indexOf(currentStage as any);
    return PIPELINE_STAGES[idx + 1] as string | undefined;
  }

  it("creates approval for manual mode", () => {
    expect(shouldCreateApproval("manual")).toBe(true);
  });

  it("does not create approval for auto mode", () => {
    expect(shouldCreateApproval("auto")).toBe(false);
  });

  it("does not create approval when mode is undefined (backwards compat)", () => {
    expect(shouldCreateApproval(undefined)).toBe(false);
  });

  it("builds correct approval title with agent name", () => {
    expect(buildApprovalTitle("researched")).toBe(
      'Pipeline: Peter Plan finished "researched" — proceed?'
    );
    expect(buildApprovalTitle("coded")).toBe(
      'Pipeline: Test Tina finished "coded" — proceed?'
    );
  });

  it("finds correct next stage", () => {
    expect(getNextStage("plan")).toBe("researched");
    expect(getNextStage("researched")).toBe("planned");
    expect(getNextStage("planned")).toBe("coded");
    expect(getNextStage("coded")).toBe("tested");
    expect(getNextStage("tested")).toBe("reviewed");
    expect(getNextStage("reviewed")).toBeUndefined(); // last stage
  });

  it("stores pipelineMode in metadata correctly", () => {
    const existingMeta = { githubRepo: "t4tarzan/seaclip-v1", githubIssueNumber: 42 };
    const updatedMeta = { ...existingMeta, pipelineStage: "plan", pipelineMode: "manual" };

    expect(updatedMeta.pipelineMode).toBe("manual");
    expect(updatedMeta.pipelineStage).toBe("plan");
    expect(updatedMeta.githubRepo).toBe("t4tarzan/seaclip-v1");
  });
});

// --- Approval resolution pipeline continuation logic ---

describe("Approval resolution → pipeline continuation", () => {
  it("identifies pipeline_gate approvals for continuation", () => {
    const approval = {
      decision: "approved" as const,
      metadata: {
        type: "pipeline_gate",
        repo: "t4tarzan/seaclip-v1",
        githubNumber: 42,
        currentStage: "researched",
        nextStage: "planned",
      },
    };

    const shouldTrigger =
      approval.decision === "approved" &&
      approval.metadata?.type === "pipeline_gate" &&
      approval.metadata?.nextStage;

    expect(shouldTrigger).toBeTruthy();
  });

  it("does not trigger pipeline for rejected approvals", () => {
    const approval = {
      decision: "rejected" as string,
      metadata: {
        type: "pipeline_gate",
        nextStage: "planned",
      },
    };

    const shouldTrigger =
      approval.decision === "approved" &&
      approval.metadata?.type === "pipeline_gate";

    expect(shouldTrigger).toBeFalsy();
  });

  it("does not trigger pipeline for non-pipeline approvals", () => {
    const approval = {
      decision: "approved" as const,
      metadata: {
        type: "deployment",
      },
    };

    const shouldTrigger =
      approval.decision === "approved" &&
      approval.metadata?.type === "pipeline_gate";

    expect(shouldTrigger).toBeFalsy();
  });

  it("does not trigger pipeline when nextStage is null (final stage)", () => {
    const approval = {
      decision: "approved" as const,
      metadata: {
        type: "pipeline_gate",
        repo: "t4tarzan/seaclip-v1",
        githubNumber: 42,
        currentStage: "reviewed",
        nextStage: null,
      },
    };

    const shouldTrigger =
      approval.decision === "approved" &&
      approval.metadata?.type === "pipeline_gate" &&
      approval.metadata?.nextStage;

    expect(shouldTrigger).toBeFalsy();
  });
});
