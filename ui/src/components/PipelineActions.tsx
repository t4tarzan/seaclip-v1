import React from "react";
import { Play, Square, Zap } from "lucide-react";

interface PipelineActionsProps {
  pipelineId: string;
  status: "idle" | "running" | "stopped";
  onStart?: (pipelineId: string) => void;
  onStop?: (pipelineId: string) => void;
  onTrigger?: (pipelineId: string) => void;
}

export function PipelineActions({
  pipelineId,
  status,
  onStart,
  onStop,
  onTrigger,
}: PipelineActionsProps) {
  const isRunning = status === "running";
  const isStopped = status === "stopped";
  const isIdle = status === "idle";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button
        onClick={() => onStart?.(pipelineId)}
        disabled={isRunning}
        title="Start pipeline"
        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
          isRunning
            ? "opacity-40 cursor-not-allowed text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)]"
            : "text-[var(--success)] bg-[var(--success)]/10 hover:bg-[var(--success)]/20 border border-[var(--success)]/25"
        }`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        <Play size={11} />
        Start
      </button>

      <button
        onClick={() => onStop?.(pipelineId)}
        disabled={!isRunning}
        title="Stop pipeline"
        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
          !isRunning
            ? "opacity-40 cursor-not-allowed text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)]"
            : "text-[var(--error)] bg-[var(--error)]/10 hover:bg-[var(--error)]/20 border border-[var(--error)]/25"
        }`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        <Square size={11} />
        Stop
      </button>

      <button
        onClick={() => onTrigger?.(pipelineId)}
        disabled={isStopped}
        title="Trigger pipeline run"
        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
          isStopped
            ? "opacity-40 cursor-not-allowed text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)]"
            : "text-[var(--accent)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 border border-[var(--primary)]/25"
        }`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        <Zap size={11} />
        Trigger
      </button>
    </div>
  );
}
