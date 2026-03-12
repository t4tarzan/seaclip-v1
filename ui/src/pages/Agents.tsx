import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, RefreshCw } from "lucide-react";
import { useAgents } from "../api/agents";
import { useCompanyContext } from "../context/CompanyContext";
import { StatusBadge } from "../components/StatusBadge";
import { NewAgentDialog } from "../components/NewAgentDialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SkeletonTable } from "../components/ui/skeleton";
import { formatCents, timeAgo } from "../lib/utils";
import type { AgentStatus, AdapterType } from "../lib/types";
import { cn } from "../lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const ADAPTER_LABELS: Record<AdapterType, string> = {
  // Cloud
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  litellm: "LiteLLM",
  // Local / Hub
  ollama_local: "Ollama (Local)",
  claude_code: "Claude Code",
  // Edge / Spoke
  seaclaw: "SeaClaw Edge",
  agent_zero: "Agent Zero",
  external_agent: "External Agent",
  // Infrastructure
  telegram_bridge: "Telegram Bridge",
  process: "Process",
  http: "HTTP",
};

export default function Agents() {
  const { companyId } = useCompanyContext();
  const { data: agents = [], isLoading, isFetching } = useAgents(companyId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");
  const [adapterFilter, setAdapterFilter] = useState<AdapterType | "all">("all");

  const filtered = agents.filter((a) => {
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    const matchesAdapter = adapterFilter === "all" || a.adapterType === adapterFilter;
    return matchesSearch && matchesStatus && matchesAdapter;
  });

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Agents</h2>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
            {agents.length} agent{agents.length !== 1 ? "s" : ""} configured
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

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 240 }}>
          <Input
            icon={<Search size={12} />}
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {(["all", "running", "idle", "error", "offline", "paused"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors",
                statusFilter === s
                  ? "bg-[var(--primary)]/20 text-[var(--accent)] border border-[var(--primary)]/30"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border border-transparent"
              )}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Adapter:</span>
          {(["all", "openai", "anthropic", "openrouter", "ollama_local", "claude_code", "seaclaw", "agent_zero", "external_agent"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAdapterFilter(a)}
              className={cn(
                "px-2 py-1 text-[10px] rounded font-medium transition-colors",
                adapterFilter === a
                  ? "bg-[var(--border)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              {a === "all" ? "All" : ADAPTER_LABELS[a]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        {isLoading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", backgroundColor: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
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
                  <th>Budget</th>
                  <th>Last Heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((agent) => (
                  <tr
                    key={agent.id}
                    onClick={() => navigate(`/agents/${agent.id}`)}
                    className="cursor-pointer hover:bg-[var(--surface-raised)] transition-colors"
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="text-[var(--primary)] text-[10px] font-bold" style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(var(--primary-rgb), 0.15)", border: "1px solid rgba(var(--primary-rgb), 0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{agent.name}</p>
                          {agent.title && (
                            <p className="text-[10px] text-[var(--text-muted)] truncate" style={{ maxWidth: 180 }}>
                              {agent.title}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-[11px] bg-[var(--border)] text-[var(--text-secondary)] px-2 py-0.5 rounded font-medium">
                        {agent.role}
                      </span>
                    </td>
                    <td>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {ADAPTER_LABELS[agent.adapterType]}
                      </span>
                    </td>
                    <td>
                      <StatusBadge type="agent" value={agent.status} />
                    </td>
                    <td>
                      <div>
                        <p className="text-[12px] text-[var(--text-primary)]">
                          {formatCents(agent.spentCents)}
                          <span className="text-[var(--text-muted)]"> / {formatCents(agent.budgetCents)}</span>
                        </p>
                        <div style={{ height: 4, width: 64, backgroundColor: "var(--border)", borderRadius: 9999, marginTop: 4, overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              backgroundColor: "var(--primary)",
                              borderRadius: 9999,
                              width: `${agent.budgetCents > 0 ? Math.min(100, (agent.spentCents / agent.budgetCents) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {agent.lastHeartbeatAt ? timeAgo(agent.lastHeartbeatAt) : "Never"}
                      </span>
                    </td>
                  </tr>
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
