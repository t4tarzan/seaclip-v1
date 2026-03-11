import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Edit2,
  Cpu,
  Clock,
  DollarSign,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { useAgent, useAgentRuns, useInvokeAgent, useUpdateAgent } from "../api/agents";
import { useCompanyContext } from "../context/CompanyContext";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { AgentConfigForm } from "../components/AgentConfigForm";
import { SkeletonCard } from "../components/ui/skeleton";
import { formatCents, timeAgo } from "../lib/utils";
import { cn } from "../lib/utils";
import type { Agent, HeartbeatRun } from "../lib/types";

function RunRow({ run }: { run: HeartbeatRun }) {
  const statusIcon = {
    running: <Loader2 size={12} className="text-[var(--primary)] animate-spin" />,
    completed: <CheckCircle size={12} className="text-[var(--success)]" />,
    failed: <XCircle size={12} className="text-[var(--error)]" />,
  }[run.status];

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}
      className="last:border-0"
    >
      <span style={{ flexShrink: 0 }}>{statusIcon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className={cn(
              "text-[11px] font-medium",
              run.status === "completed"
                ? "text-[var(--success)]"
                : run.status === "failed"
                ? "text-[var(--error)]"
                : "text-[var(--primary)]"
            )}
          >
            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(run.startedAt)}</span>
        </div>
        {run.result && (
          <p className="text-[10px] text-[var(--text-secondary)] truncate" style={{ marginTop: 2 }}>{run.result}</p>
        )}
        {run.error && (
          <p className="text-[10px] text-[var(--error)] truncate" style={{ marginTop: 2 }}>{run.error}</p>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <span className="text-[10px] text-[var(--text-secondary)] font-mono">
          {formatCents(run.costCents)}
        </span>
        <span className="text-[9px] text-[var(--text-muted)]">
          {(run.inputTokens + run.outputTokens).toLocaleString()} tok
        </span>
      </div>
    </div>
  );
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const { companyId } = useCompanyContext();
  const navigate = useNavigate();

  const { data: agent, isLoading } = useAgent(companyId, id);
  const { data: runs = [] } = useAgentRuns(companyId, id);
  const invokeAgent = useInvokeAgent();
  const updateAgent = useUpdateAgent();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [invokePrompt, setInvokePrompt] = useState("");
  const [showInvokeDialog, setShowInvokeDialog] = useState(false);

  const handleInvoke = async () => {
    if (!companyId || !id) return;
    await invokeAgent.mutateAsync({
      companyId,
      id,
      payload: invokePrompt ? { prompt: invokePrompt } : undefined,
    });
    setShowInvokeDialog(false);
    setInvokePrompt("");
  };

  const handleUpdate = async (data: Partial<Agent>) => {
    if (!companyId || !id) return;
    await updateAgent.mutateAsync({ companyId, id, data });
    setShowEditDialog(false);
  };

  if (isLoading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2" />
        <SkeletonCard />
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <p className="text-[var(--text-muted)]">Agent not found</p>
        <Button variant="ghost" size="sm" style={{ marginTop: 12 }} onClick={() => navigate("/agents")}>
          Back to Agents
        </Button>
      </div>
    );
  }

  const activeRun = runs.find((r) => r.status === "running");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
      {/* Back + Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={12} />}
          onClick={() => navigate("/agents")}
        >
          Agents
        </Button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            className="bg-[var(--primary)]/15 border border-[var(--primary)]/25 text-[var(--primary)] text-[14px] font-bold"
          >
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{agent.name}</h2>
              <StatusBadge type="agent" value={agent.status} />
            </div>
            {agent.title && (
              <p className="text-[12px] text-[var(--text-muted)]">{agent.title}</p>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            variant="outline"
            size="sm"
            icon={<Edit2 size={12} />}
            onClick={() => setShowEditDialog(true)}
          >
            Edit
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Play size={12} />}
            onClick={() => setShowInvokeDialog(true)}
            loading={invokeAgent.isPending}
          >
            Invoke
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="lg:grid-cols-3">
        {/* Left: Properties */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="lg:col-span-2">
          {/* Properties Panel */}
          <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]" style={{ marginBottom: 16 }}>Properties</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {[
                { label: "Role", value: agent.role },
                { label: "Adapter", value: agent.adapterType.toUpperCase() },
                {
                  label: "Last Heartbeat",
                  value: agent.lastHeartbeatAt ? timeAgo(agent.lastHeartbeatAt) : "Never",
                },
                { label: "Device", value: agent.deviceId ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    {label}
                  </span>
                  <span className="text-[12px] text-[var(--text-primary)]">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Budget</h3>
              <span className="text-[11px] text-[var(--text-secondary)]">
                {formatCents(agent.spentCents)} / {formatCents(agent.budgetCents)}
              </span>
            </div>
            <div style={{ height: 8, backgroundColor: "var(--bg-alt)", borderRadius: 9999, overflow: "hidden" }}>
              <div
                className="transition-all duration-700"
                style={{
                  height: "100%",
                  borderRadius: 9999,
                  width: `${agent.budgetCents > 0 ? Math.min(100, (agent.spentCents / agent.budgetCents) * 100) : 0}%`,
                  backgroundColor:
                    agent.spentCents / agent.budgetCents > 0.9
                      ? "var(--error)"
                      : agent.spentCents / agent.budgetCents > 0.7
                      ? "var(--warning)"
                      : "var(--primary)",
                }}
              />
            </div>
            <p className="text-[10px] text-[var(--text-muted)]" style={{ marginTop: 6 }}>
              {agent.budgetCents > 0
                ? `${((agent.spentCents / agent.budgetCents) * 100).toFixed(1)}% used this period`
                : "No budget limit set"}
            </p>
          </div>

          {/* Config */}
          {Object.keys(agent.config).length > 0 && (
            <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]" style={{ marginBottom: 12 }}>Configuration</h3>
              <pre className="text-[11px] text-[var(--text-secondary)] leading-relaxed" style={{ overflowX: "auto" }}>
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(agent.config).map(([k, v]) => [
                      k,
                      k.toLowerCase().includes("key") ? "••••••••" : v,
                    ])
                  ),
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Runs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Live run */}
          {activeRun && (
            <div
              style={{ borderRadius: 12, padding: 16 }}
              className="bg-[var(--primary)]/10 border border-[var(--primary)]/30"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Loader2 size={14} className="text-[var(--primary)] animate-spin" />
                <h3 className="text-[13px] font-semibold text-[var(--accent)]">Running Now</h3>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Started {timeAgo(activeRun.startedAt)}
              </p>
            </div>
          )}

          {/* Recent Runs */}
          <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Clock size={13} className="text-[var(--text-muted)]" />
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
                Recent Runs
                {runs.length > 0 && (
                  <span className="text-[11px] text-[var(--text-muted)] font-normal" style={{ marginLeft: 6 }}>
                    {runs.length}
                  </span>
                )}
              </h3>
            </div>
            {runs.length === 0 ? (
              <div className="text-[12px] text-[var(--text-muted)]" style={{ textAlign: "center", padding: "32px 0" }}>
                No runs yet
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", maxHeight: 320, overflowY: "auto" }}>
                {runs.slice(0, 20).map((run) => (
                  <RunRow key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {[
              {
                label: "Total Cost",
                value: formatCents(runs.reduce((s, r) => s + r.costCents, 0)),
                icon: <DollarSign size={13} />,
              },
              {
                label: "Total Runs",
                value: runs.length,
                icon: <Zap size={13} />,
              },
            ].map(({ label, value, icon }) => (
              <div
                key={label}
                style={{
                  backgroundColor: "var(--bg-alt)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span className="text-[var(--text-muted)]" style={{ width: 16, height: 16 }}>{icon}</span>
                <span className="text-[16px] font-bold text-[var(--text-primary)]">{value}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Edit Agent: {agent.name}</DialogTitle>
          </DialogHeader>
          <AgentConfigForm
            initial={agent}
            onSubmit={handleUpdate}
            onCancel={() => setShowEditDialog(false)}
            loading={updateAgent.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Invoke Dialog */}
      <Dialog open={showInvokeDialog} onOpenChange={setShowInvokeDialog}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Invoke Agent: {agent.name}</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Manually trigger this agent. Optionally provide a prompt or payload.
            </p>
            <textarea
              value={invokePrompt}
              onChange={(e) => setInvokePrompt(e.target.value)}
              placeholder="Optional: provide a prompt or instructions..."
              style={{
                width: "100%",
                backgroundColor: "var(--bg-alt)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 12,
                minHeight: 100,
                resize: "vertical",
              }}
              className="text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setShowInvokeDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleInvoke}
                loading={invokeAgent.isPending}
                icon={<Play size={12} />}
              >
                Invoke
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
