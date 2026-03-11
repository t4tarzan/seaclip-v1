import React, { useState } from "react";
import { Target, Plus, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import { useGoals, useCreateGoal, useUpdateGoal } from "../api/goals";
import { useCompanyContext } from "../context/CompanyContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SkeletonCard } from "../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { cn } from "../lib/utils";
import type { Goal, GoalStatus } from "../lib/types";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_COLORS: Record<GoalStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-[var(--border)]", text: "text-[var(--text-secondary)]", label: "Draft" },
  active: { bg: "bg-[var(--primary)]/20", text: "text-[var(--accent)]", label: "Active" },
  achieved: { bg: "bg-[var(--success)]/20", text: "text-[var(--success)]", label: "Achieved" },
  abandoned: { bg: "bg-[var(--error)]/20", text: "text-[var(--error)]", label: "Abandoned" },
};

const STATUS_TABS: { key: "all" | GoalStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
  { key: "achieved", label: "Achieved" },
  { key: "abandoned", label: "Abandoned" },
];

function ProgressBar({ metricType, metricCurrent, metricTarget }: Pick<Goal, "metricType" | "metricCurrent" | "metricTarget">) {
  if (metricType === "boolean") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div className={cn("border-2", metricCurrent >= 1 ? "bg-[var(--success)] border-[var(--success)]" : "border-[var(--border)]")} style={{ width: 12, height: 12, borderRadius: 9999 }} />
        <span className="text-[10px] text-[var(--text-secondary)]">{metricCurrent >= 1 ? "Complete" : "Incomplete"}</span>
      </div>
    );
  }
  const target = metricTarget ?? 100;
  const pct = Math.min(100, Math.round((metricCurrent / target) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 160 }}>
      <div style={{ flex: 1, height: 6, backgroundColor: "var(--bg-alt)", borderRadius: 9999, overflow: "hidden" }}>
        <div
          className="transition-all duration-500"
          style={{
            height: "100%",
            borderRadius: 9999,
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? "var(--success)" : "var(--primary)",
          }}
        />
      </div>
      <span className="text-[10px] text-[var(--text-secondary)] font-mono" style={{ width: 32, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function GoalTreeNode({
  goal,
  children,
  depth,
}: {
  goal: Goal;
  children: Goal[];
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const colors = STATUS_COLORS[goal.status];
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className="hover:bg-[#1a2132] transition-colors group"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, marginLeft: depth > 0 ? 24 : 0 }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            style={{ padding: 2, borderRadius: 4 }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span style={{ width: 18 }} />
        )}
        <div className="bg-[var(--primary)]/15 border border-[var(--primary)]/25" style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Target size={12} className="text-[var(--primary)]" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{goal.title}</p>
          {goal.description && (
            <p className="text-[10px] text-[var(--text-muted)] truncate">{goal.description}</p>
          )}
        </div>
        <ProgressBar metricType={goal.metricType} metricCurrent={goal.metricCurrent} metricTarget={goal.metricTarget} />
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded", colors.bg, colors.text)}>
          {colors.label}
        </span>
        {goal.targetDate && (
          <span className="text-[10px] text-[var(--text-muted)]" style={{ flexShrink: 0 }}>
            {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <div style={{ borderLeft: "1px solid var(--border)", marginLeft: 21 }}>
          {children.map((child) => (
            <GoalTreeNode key={child.id} goal={child} children={[]} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Goals() {
  const { companyId } = useCompanyContext();
  const { data: goals = [], isLoading, isFetching } = useGoals(companyId);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | GoalStatus>("all");
  const [showNewDialog, setShowNewDialog] = useState(false);

  const filteredGoals = tab === "all" ? goals : goals.filter((g) => g.status === tab);
  const rootGoals = filteredGoals.filter((g) => !g.parentGoalId);
  const childrenOf = (parentId: string) => filteredGoals.filter((g) => g.parentGoalId === parentId);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Goals</h2>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
            {goals.length} goal{goals.length !== 1 ? "s" : ""} — track objectives and key results
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />}
            onClick={() => qc.invalidateQueries({ queryKey: ["goals", companyId] })}
          >
            Refresh
          </Button>
          <Button variant="primary" size="sm" icon={<Plus size={12} />} onClick={() => setShowNewDialog(true)}>
            New Goal
          </Button>
        </div>
      </div>

      {/* Status Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {STATUS_TABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            className={cn(
              "px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors",
              tab === s.key
                ? "bg-[var(--primary)]/20 text-[var(--accent)] border border-[var(--primary)]/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border border-transparent"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Goal Tree */}
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : rootGoals.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", backgroundColor: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Target size={24} className="text-[var(--text-muted)]" />
            </div>
            <p className="text-[13px] font-medium text-[var(--text-secondary)]">
              {tab !== "all" ? "No goals match this filter" : "No goals yet"}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: 4 }}>
              Create goals to track company objectives and link them to issues
            </p>
            {tab === "all" && (
              <Button variant="primary" size="sm" className="mt-4" onClick={() => setShowNewDialog(true)}>
                Create Goal
              </Button>
            )}
          </div>
        ) : (
          <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
            {rootGoals.map((goal) => (
              <GoalTreeNode key={goal.id} goal={goal} children={childrenOf(goal.id)} depth={0} />
            ))}
          </div>
        )}
      </div>

      <NewGoalDialog open={showNewDialog} onOpenChange={setShowNewDialog} goals={goals} />
    </div>
  );
}

function NewGoalDialog({
  open,
  onOpenChange,
  goals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: Goal[];
}) {
  const { companyId } = useCompanyContext();
  const createGoal = useCreateGoal();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<GoalStatus>("active");
  const [parentGoalId, setParentGoalId] = useState("");

  const handleSubmit = async () => {
    if (!companyId || !title) return;
    await createGoal.mutateAsync({
      companyId,
      data: {
        title,
        description: description || undefined,
        status,
        parentGoalId: parentGoalId || undefined,
      },
    });
    setTitle("");
    setDescription("");
    setStatus("active");
    setParentGoalId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>New Goal</DialogTitle>
          <DialogDescription>Create a goal to track an objective.</DialogDescription>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-medium" style={{ marginBottom: 4, display: "block" }}>Title</label>
            <Input placeholder="Goal title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-medium" style={{ marginBottom: 4, display: "block" }}>Description</label>
            <textarea
              className="w-full text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
              style={{ backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", resize: "none" }}
              rows={3}
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] font-medium" style={{ marginBottom: 4, display: "block" }}>Status</label>
              <select
                className="w-full text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                style={{ backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}
                value={status}
                onChange={(e) => setStatus(e.target.value as GoalStatus)}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] font-medium" style={{ marginBottom: 4, display: "block" }}>Parent Goal</label>
              <select
                className="w-full text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                style={{ backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}
                value={parentGoalId}
                onChange={(e) => setParentGoalId(e.target.value)}
              >
                <option value="">None (top-level)</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!title}
            loading={createGoal.isPending}
          >
            Create Goal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
