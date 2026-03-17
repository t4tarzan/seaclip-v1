import { useState } from "react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  useSyncIssueToGitHub,
  useStartPipeline,
  useResumePipeline,
  usePipelineStatus,
} from "../api/github-bridge";
import { useCompanyContext } from "../context/CompanyContext";
import type { Issue } from "../lib/types";

const STAGE_COLORS: Record<string, string> = {
  plan: "bg-gray-500/20 text-gray-400",
  researched: "bg-blue-500/20 text-blue-400",
  planned: "bg-purple-500/20 text-purple-400",
  coded: "bg-yellow-500/20 text-yellow-400",
  tested: "bg-cyan-500/20 text-cyan-400",
  reviewed: "bg-green-500/20 text-green-400",
  completed: "bg-green-500/20 text-green-400",
};

/** Maps each stage to the agent it triggers */
const STAGE_AGENT: Record<string, string> = {
  plan: "Charlie (Research)",
  researched: "Peter Plan (Architecture)",
  planned: "David Dev (Coding)",
  coded: "Tina (Testing)",
  tested: "Suzy (Review)",
  reviewed: "Matthews (Merge)",
};

const RESUME_STAGES = Object.entries(STAGE_AGENT).map(([value, label]) => ({
  value,
  label,
}));

interface PipelineActionsProps {
  issue: Issue;
}

export function PipelineActions({ issue }: PipelineActionsProps) {
  const { companyId } = useCompanyContext();
  const syncIssue = useSyncIssueToGitHub();
  const startPipeline = useStartPipeline();
  const resumePipeline = useResumePipeline();
  const [resumeStage, setResumeStage] = useState<string | undefined>(undefined);

  const meta = issue.metadata as Record<string, unknown>;
  const githubRepo = meta?.githubRepo as string | undefined;
  const githubIssueNumber = meta?.githubIssueNumber as number | undefined;
  const githubIssueUrl = meta?.githubIssueUrl as string | undefined;
  const pipelineStage = meta?.pipelineStage as string | undefined;
  const pipelineMode = meta?.pipelineMode as "auto" | "manual" | undefined;

  const { data: status } = usePipelineStatus(
    companyId,
    githubIssueNumber ? issue.id : undefined,
  );

  if (!githubRepo) return null;

  const stage = status?.stage ?? pipelineStage;
  const mode = status?.pipelineMode ?? pipelineMode;
  const waiting = status?.pipelineWaiting as string | null;
  const isCompleted = stage === "completed" || status?.closed;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Pipeline
        </h4>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {mode && (
            <span
              className={`px-2 py-0.5 text-[10px] font-medium ${
                mode === "manual"
                  ? "bg-orange-500/20 text-orange-400"
                  : "bg-green-500/20 text-green-400"
              }`}
            >
              {mode}
            </span>
          )}
          {stage && (
            <span
              className={`px-3 py-1 text-[11px] font-semibold ${STAGE_COLORS[stage] ?? "bg-gray-500/20 text-gray-400"}`}
            >
              {stage}
            </span>
          )}
        </div>
      </div>

      {/* GitHub link */}
      {githubIssueUrl && (
        <a
          href={githubIssueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-[var(--primary)] hover:underline"
        >
          GitHub #{githubIssueNumber}
        </a>
      )}

      {/* State A: No GitHub issue yet */}
      {!githubIssueNumber && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Button
            size="sm"
            variant="outline"
            loading={syncIssue.isPending}
            onClick={() => {
              if (companyId) syncIssue.mutate({ companyId, issueId: issue.id });
            }}
          >
            Create GitHub Issue
          </Button>
          {syncIssue.isError && (
            <span className="text-[11px] text-[var(--error)]">
              {syncIssue.error?.message || "Failed to create GitHub issue"}
            </span>
          )}
        </div>
      )}

      {/* State B: GitHub issue exists, pipeline not started */}
      {githubIssueNumber && !stage && (
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="sm"
            variant="primary"
            loading={startPipeline.isPending}
            onClick={() => {
              if (companyId) {
                startPipeline.mutate({
                  companyId, issueId: issue.id, stage: "plan", mode: "auto",
                });
              }
            }}
          >
            Start Auto
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={startPipeline.isPending}
            onClick={() => {
              if (companyId) {
                startPipeline.mutate({
                  companyId, issueId: issue.id, stage: "plan", mode: "manual",
                });
              }
            }}
          >
            Start Manual
          </Button>
        </div>
      )}

      {/* State C: Completed */}
      {isCompleted && (
        <span className="text-[12px] text-[var(--success)] font-medium">
          Pipeline completed
        </span>
      )}

      {/* State D: Manual mode — waiting for user to trigger next agent */}
      {!isCompleted && mode === "manual" && waiting && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="text-[11px] text-orange-400">
            Waiting for manual trigger...
          </span>
          <Button
            size="sm"
            variant="primary"
            loading={resumePipeline.isPending}
            onClick={() => {
              if (companyId) {
                resumePipeline.mutate({
                  companyId,
                  issueId: issue.id,
                  stage: waiting,
                  mode: "manual",
                });
              }
            }}
            className="bg-orange-500 hover:bg-orange-600 border-orange-500"
          >
            Start {STAGE_AGENT[waiting] ?? "Next Agent"}
          </Button>
        </div>
      )}

      {/* State E: Pipeline running (auto or manual with no waiting state) */}
      {!isCompleted && stage && !waiting && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="text-[11px] text-[var(--text-muted)]">
            {mode === "manual" ? "Agent working..." : "Pipeline running..."}
          </span>
          {/* Override: resume at a different stage */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Select value={resumeStage || undefined} onValueChange={setResumeStage}>
              <SelectTrigger className="flex-1 text-[12px]">
                <SelectValue placeholder="Jump to agent..." />
              </SelectTrigger>
              <SelectContent>
                {RESUME_STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={!resumeStage}
              loading={resumePipeline.isPending}
              onClick={() => {
                if (companyId && resumeStage) {
                  resumePipeline.mutate({
                    companyId,
                    issueId: issue.id,
                    stage: resumeStage,
                    mode: mode === "manual" ? "manual" : "auto",
                  });
                  setResumeStage(undefined);
                }
              }}
            >
              Resume
            </Button>
          </div>
        </div>
      )}

      {/* Stage labels */}
      {status?.labels && status.labels.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {status.labels.map((label) => (
            <span
              key={label}
              className={`px-2.5 py-1 text-[10px] font-medium ${STAGE_COLORS[label] ?? "bg-gray-500/20 text-gray-400"}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
