import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, RefreshCw, Zap, Clock, ArrowRight, ListChecks, CheckCircle2 } from "lucide-react";
import { useAgents } from "../api/agents";
import { useCompanyContext } from "../context/CompanyContext";
import { StatusBadge } from "../components/StatusBadge";
import { NewAgentDialog } from "../components/NewAgentDialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SkeletonTable } from "../components/ui/skeleton";
import { timeAgo } from "../lib/utils";
import type { Agent, AgentStatus, AdapterType } from "../lib/types";
import { cn } from "../lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const ADAPTER_LABELS: Record<AdapterType, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  litellm: "LiteLLM",
  ollama_local: "Ollama",
  claude_code: "Claude Code",
  seaclaw: "SeaClaw",
  agent_zero: "Agent Zero",
  external_agent: "External",
  telegram_bridge: "Telegram",
  process: "Process",
  http: "HTTP",
};

// Color for each pipeline role
const ROLE_COLORS: Record<string, string> = {
  research: "#3b82f6",   // blue
  architect: "#8b5cf6",  // purple
  developer: "#f59e0b",  // amber
  tester: "#06b6d4",     // cyan
  reviewer: "#ec4899",   // pink
  release: "#10b981",    // emerald
};

// ─── Pipeline Progress Tracker ──────────────────────────────────────────────
function PipelineTracker({ agents }: { agents: Agent[] }) {
  const pipelineAgents = agents
    .filter((a) => a.metadata?.pipelineOrder)
    .sort((a, b) => ((a.metadata?.pipelineOrder as number) ?? 0) - ((b.metadata?.pipelineOrder as number) ?? 0));

  if (pipelineAgents.length === 0) return null;

  const hasActive = pipelineAgents.some((a) => a.status === "running" || a.status === "active");
  if (!hasActive) {
    // Show compact idle state
    const lastCompleted = pipelineAgents.find((a) => a.metadata?.lastCompletedAt);
    if (!lastCompleted) return null;
  }

  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 0,
        padding: "14px 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Zap size={12} className={hasActive ? "text-[#22c55e]" : "text-[var(--text-muted)]"} />
        <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Pipeline {hasActive ? "Active" : "Idle"}
        </span>
        {hasActive && (
          <span className="text-[10px] text-[var(--text-muted)]">
            — {pipelineAgents.find((a) => a.status === "running" || a.status === "active")?.metadata?.currentIssueTitle as string ?? ""}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {pipelineAgents.map((agent, i) => {
          const isActive = agent.status === "running" || agent.status === "active";
          const isDone = !isActive && !!agent.metadata?.lastCompletedAt;
          const color = ROLE_COLORS[agent.metadata?.pipelineRole as string] ?? "var(--text-muted)";
          const isLast = i === pipelineAgents.length - 1;

          return (
            <React.Fragment key={agent.id}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  flex: 1,
                  position: "relative",
                }}
              >
                {/* Node */}
                <div
                  className={isActive ? "animate-pulse" : ""}
                  style={{
                    width: isActive ? 32 : 24,
                    height: isActive ? 32 : 24,
                    borderRadius: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    transition: "all 0.3s ease",
                    backgroundColor: isActive
                      ? color
                      : isDone
                        ? `${color}33`
                        : "var(--bg-alt)",
                    border: isActive
                      ? `2px solid ${color}`
                      : isDone
                        ? `1px solid ${color}66`
                        : "1px solid var(--border)",
                    color: isActive ? "#fff" : isDone ? color : "var(--text-muted)",
                    boxShadow: isActive ? `0 0 12px ${color}66, 0 0 24px ${color}33` : "none",
                  }}
                >
                  {agent.name.charAt(0)}
                </div>
                {/* Label */}
                <span
                  className="text-[9px] font-medium truncate"
                  style={{
                    maxWidth: 72,
                    textAlign: "center",
                    color: isActive ? color : "var(--text-muted)",
                  }}
                >
                  {agent.name.split(" ").pop()}
                </span>
              </div>
              {/* Connector line */}
              {!isLast && (
                <div style={{ flex: 0.5, display: "flex", alignItems: "center", marginBottom: 18 }}>
                  <div
                    style={{
                      height: 2,
                      flex: 1,
                      backgroundColor: isDone ? `${color}44` : "var(--border)",
                      borderRadius: 0,
                    }}
                  />
                  <ArrowRight
                    size={10}
                    style={{
                      color: isDone ? `${color}66` : "var(--border)",
                      flexShrink: 0,
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Agent Row ──────────────────────────────────────────────────────────────
function AgentRow({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const isActive = agent.status === "running" || agent.status === "active";
  const meta = agent.metadata ?? {};
  const pipelineRole = meta.pipelineRole as string | undefined;
  const pipelineOrder = meta.pipelineOrder as number | undefined;
  const currentTask = meta.currentIssueTitle as string | undefined;
  const lastCompletedAt = meta.lastCompletedAt as string | undefined;
  const lastCompletedTitle = meta.lastCompletedIssueTitle as string | undefined;
  const roleColor = pipelineRole ? ROLE_COLORS[pipelineRole] ?? "var(--primary)" : "var(--primary)";

  return (
    <tr
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-all duration-300",
        isActive
          ? "bg-[#22c55e]/[0.04] hover:bg-[#22c55e]/[0.08]"
          : "hover:bg-[var(--surface-raised)]"
      )}
      style={{
        borderLeft: isActive ? "3px solid #22c55e" : "3px solid transparent",
      }}
    >
      {/* Name + Pipeline Badge */}
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Avatar with status ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                backgroundColor: isActive ? `${roleColor}22` : "rgba(var(--primary-rgb, 99,102,241), 0.12)",
                border: isActive ? `2px solid ${roleColor}` : "1px solid rgba(var(--primary-rgb, 99,102,241), 0.2)",
                color: isActive ? roleColor : "var(--primary)",
                transition: "all 0.3s ease",
                boxShadow: isActive ? `0 0 8px ${roleColor}44` : "none",
              }}
            >
              {agent.name.charAt(0).toUpperCase()}
            </div>
            {/* Live dot */}
            {isActive && (
              <span
                className="animate-ping"
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: 0,
                  backgroundColor: "#22c55e",
                  opacity: 0.75,
                }}
              />
            )}
            {isActive && (
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: 0,
                  backgroundColor: "#22c55e",
                  border: "2px solid var(--surface)",
                }}
              />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <p className="text-[12px] font-semibold text-[var(--text-primary)]">{agent.name}</p>
              {pipelineOrder && (
                <span
                  className="text-[9px] font-bold"
                  style={{
                    backgroundColor: `${roleColor}20`,
                    color: roleColor,
                    padding: "1px 5px",
                    borderRadius: 0,
                    lineHeight: "14px",
                  }}
                >
                  #{pipelineOrder}
                </span>
              )}
            </div>
            {agent.title && (
              <p className="text-[10px] text-[var(--text-muted)] truncate" style={{ maxWidth: 180 }}>
                {agent.title}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Role */}
      <td>
        {pipelineRole ? (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-none"
            style={{
              backgroundColor: `${roleColor}18`,
              color: roleColor,
            }}
          >
            {pipelineRole}
          </span>
        ) : (
          <span className="text-[11px] bg-[var(--border)] text-[var(--text-secondary)] px-2 py-0.5 rounded-none font-medium">
            {agent.role}
          </span>
        )}
      </td>

      {/* Adapter */}
      <td>
        <span className="text-[11px] text-[var(--text-secondary)]">
          {ADAPTER_LABELS[agent.adapterType]}
        </span>
      </td>

      {/* Status */}
      <td>
        {isActive ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              className="animate-pulse"
              style={{
                width: 7,
                height: 7,
                borderRadius: 0,
                backgroundColor: "#22c55e",
                boxShadow: "0 0 6px #22c55e88",
                flexShrink: 0,
              }}
            />
            <span className="text-[11px] font-semibold text-[#22c55e]">Running</span>
          </div>
        ) : (
          <StatusBadge type="agent" value={agent.status} />
        )}
      </td>

      {/* Task Counters */}
      <td>
        {(() => {
          const tc = agent.taskCounts ?? { openTasks: 0, doneTasks: 0, totalTasks: 0 };
          if (tc.totalTasks === 0) {
            return <span className="text-[11px] text-[var(--text-muted)]">—</span>;
          }
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {tc.openTasks > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 0,
                    backgroundColor: "rgba(59,130,246,0.12)",
                    color: "#3b82f6",
                  }}
                >
                  <ListChecks size={10} />
                  {tc.openTasks}
                </span>
              )}
              {tc.doneTasks > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 0,
                    backgroundColor: "rgba(34,197,94,0.12)",
                    color: "#22c55e",
                  }}
                >
                  <CheckCircle2 size={10} />
                  {tc.doneTasks}
                </span>
              )}
            </div>
          );
        })()}
      </td>

      {/* Current / Last Task */}
      <td>
        {isActive && currentTask ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={10} className="text-[#22c55e] flex-shrink-0" />
            <span className="text-[11px] text-[var(--text-primary)] font-medium truncate" style={{ maxWidth: 180 }}>
              {currentTask}
            </span>
          </div>
        ) : lastCompletedTitle ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={10} className="text-[var(--text-muted)] flex-shrink-0" />
            <span className="text-[11px] text-[var(--text-muted)] truncate" style={{ maxWidth: 180 }}>
              {lastCompletedTitle}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)]">—</span>
        )}
      </td>

      {/* Last Activity */}
      <td>
        {isActive ? (
          <span className="text-[11px] text-[#22c55e] font-medium">Now</span>
        ) : lastCompletedAt ? (
          <span className="text-[11px] text-[var(--text-secondary)]">
            {timeAgo(lastCompletedAt)}
          </span>
        ) : agent.lastHeartbeatAt ? (
          <span className="text-[11px] text-[var(--text-secondary)]">
            {timeAgo(agent.lastHeartbeatAt)}
          </span>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)]">Never</span>
        )}
      </td>
    </tr>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function Agents() {
  const { companyId } = useCompanyContext();
  const { data: agents = [], isLoading, isFetching } = useAgents(companyId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");
  const [adapterFilter, setAdapterFilter] = useState<AdapterType | "all">("all");
  const [taskFilter, setTaskFilter] = useState<"all" | "has_open" | "no_tasks" | "has_done">("all");

  const filtered = agents.filter((a) => {
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter || (statusFilter === "running" && a.status === "active");
    const matchesAdapter = adapterFilter === "all" || a.adapterType === adapterFilter;
    const tc = a.taskCounts ?? { openTasks: 0, doneTasks: 0, totalTasks: 0 };
    const matchesTasks =
      taskFilter === "all" ||
      (taskFilter === "has_open" && tc.openTasks > 0) ||
      (taskFilter === "has_done" && tc.doneTasks > 0) ||
      (taskFilter === "no_tasks" && tc.totalTasks === 0);
    return matchesSearch && matchesStatus && matchesAdapter && matchesTasks;
  });

  const activeCount = agents.filter((a) => a.status === "running" || a.status === "active").length;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Agents</h2>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
            {activeCount > 0 && (
              <span className="text-[#22c55e] font-medium"> — {activeCount} running</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />}
            onClick={() => qc.invalidateQueries({ queryKey: ["agents", companyId] })}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={12} />}
            onClick={() => setShowNewDialog(true)}
          >
            New Agent
          </Button>
        </div>
      </div>

      {/* Pipeline Progress Tracker */}
      <PipelineTracker agents={agents} />

      {/* Filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 220 }}>
            <Input
              icon={<Search size={12} />}
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              backgroundColor: "var(--bg-alt)",
              border: "1px solid var(--border)",
              borderRadius: 0,
              padding: "3px 4px",
            }}
          >
            {(["all", "running", "idle", "error", "offline", "paused"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 text-[11px] rounded-none font-medium transition-colors whitespace-nowrap",
                  statusFilter === s
                    ? "bg-[var(--primary)]/20 text-[var(--accent)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
                )}
              >
                {s === "all" ? "All" : s === "running" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {activeCount > 0 && (
                      <span style={{
                        width: 6, height: 6, borderRadius: 0, backgroundColor: "#22c55e",
                        boxShadow: "0 0 4px #22c55e88",
                      }} />
                    )}
                    Running
                    {activeCount > 0 && <span className="text-[#22c55e]">({activeCount})</span>}
                  </span>
                ) : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto" }}>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap" style={{ flexShrink: 0 }}>Adapter:</span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                backgroundColor: "var(--bg-alt)",
                border: "1px solid var(--border)",
                borderRadius: 0,
                padding: "3px 4px",
              }}
            >
              {(["all", "openai", "anthropic", "openrouter", "ollama_local", "claude_code", "seaclaw", "agent_zero", "external_agent"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAdapterFilter(a)}
                  className={cn(
                    "px-2.5 py-1.5 text-[10px] rounded-none font-medium transition-colors whitespace-nowrap",
                    adapterFilter === a
                      ? "bg-[var(--border)] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  {a === "all" ? "All" : ADAPTER_LABELS[a]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap" style={{ flexShrink: 0 }}>Tasks:</span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                backgroundColor: "var(--bg-alt)",
                border: "1px solid var(--border)",
                borderRadius: 0,
                padding: "3px 4px",
              }}
            >
              {([
                { key: "all", label: "All" },
                { key: "has_open", label: "Has Open" },
                { key: "has_done", label: "Completed" },
                { key: "no_tasks", label: "No Tasks" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTaskFilter(t.key)}
                  className={cn(
                    "px-2.5 py-1.5 text-[10px] rounded-none font-medium transition-colors whitespace-nowrap",
                    taskFilter === t.key
                      ? "bg-[var(--border)] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, overflow: "hidden" }}>
        {isLoading ? (
          <SkeletonTable rows={6} cols={7} />
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 0, backgroundColor: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <p className="text-[13px] font-medium text-[var(--text-secondary)]">
              {search || statusFilter !== "all" ? "No agents match your filters" : "No agents yet"}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: 4 }}>
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first agent to get started"}
            </p>
            {!search && statusFilter === "all" && (
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => setShowNewDialog(true)}
              >
                Create Agent
              </Button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Adapter</th>
                  <th>Status</th>
                  <th>Tasks</th>
                  <th>Current Task</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((agent) => (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    onClick={() => navigate(`/agents/${agent.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewAgentDialog open={showNewDialog} onOpenChange={setShowNewDialog} />
    </div>
  );
}
