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
  draft: { bg: "bg-[#374151]", text: "text-[#9ca3af]", label: "Draft" },
  active: { bg: "bg-[#20808D]/20", text: "text-[#06b6d4]", label: "Active" },
  achieved: { bg: "bg-[#22c55e]/20", text: "text-[#22c55e]", label: "Achieved" },
  abandoned: { bg: "bg-[#ef4444]/20", text: "text-[#ef4444]", label: "Abandoned" },
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
      <div className="flex items-center gap-1.5">
        <div className={cn("w-3 h-3 rounded-full border-2", metricCurrent >= 1 ? "bg-[#22c55e] border-[#22c55e]" : "border-[#374151]")} />
        <span className="text-[10px] text-[#9ca3af]">{metricCurrent >= 1 ? "Complete" : "Incomplete"}</span>
      </div>
    );
  }
  const target = metricTarget ?? 100;
  const pct = Math.min(100, Math.round((metricCurrent / target) * 100));
  return (
    <div className="flex items-center gap-2 flex-1 max-w-[160px]">
      <div className="flex-1 h-1.5 bg-[#111827] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? "#22c55e" : "#20808D",
          }}
        />
      </div>
      <span className="text-[10px] text-[#9ca3af] font-mono w-8 text-right">{pct}%</span>
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
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-[#1a2132] transition-colors group",
          depth > 0 && "ml-6"
        )}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded text-[#6b7280] hover:text-[#f9fafb]"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-[18px]" />
        )}
        <div className="w-7 h-7 rounded-lg bg-[#20808D]/15 border border-[#20808D]/25 flex items-center justify-center flex-shrink-0">
          <Target size={12} className="text-[#20808D]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#f9fafb] truncate">{goal.title}</p>
          {goal.description && (
            <p className="text-[10px] text-[#6b7280] truncate">{goal.description}</p>
          )}
        </div>
        <ProgressBar metricType={goal.metricType} metricCurrent={goal.metricCurrent} metricTarget={goal.metricTarget} />
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded", colors.bg, colors.text)}>
          {colors.label}
        </span>
        {goal.targetDate && (
          <span className="text-[10px] text-[#6b7280] flex-shrink-0">
            {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="border-l border-[#374151] ml-[21px]">
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
    <div className="p-6 flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-[#f9fafb]">Goals</h2>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            {goals.length} goal{goals.length !== 1 ? "s" : ""} — track objectives and key results
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      <div className="flex items-center gap-1.5">
        {STATUS_TABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            className={cn(
              "px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors",
              tab === s.key
                ? "bg-[#20808D]/20 text-[#06b6d4] border border-[#20808D]/30"
                : "text-[#9ca3af] hover:text-[#f9fafb] hover:bg-[#1f2937] border border-transparent"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Goal Tree */}
      <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : rootGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#374151] flex items-center justify-center mb-3">
              <Target size={24} className="text-[#6b7280]" />
            </div>
            <p className="text-[13px] font-medium text-[#9ca3af]">
              {tab !== "all" ? "No goals match this filter" : "No goals yet"}
            </p>
            <p className="text-[11px] text-[#6b7280] mt-1">
              Create goals to track company objectives and link them to issues
            </p>
            {tab === "all" && (
              <Button variant="primary" size="sm" className="mt-4" onClick={() => setShowNewDialog(true)}>
                Create Goal
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-0.5">
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
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-[#9ca3af] font-medium mb-1 block">Title</label>
            <Input placeholder="Goal title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-[#9ca3af] font-medium mb-1 block">Description</label>
            <textarea
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-[12px] text-[#f9fafb] placeholder:text-[#6b7280] focus:outline-none focus:border-[#20808D] resize-none"
              rows={3}
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#9ca3af] font-medium mb-1 block">Status</label>
              <select
                className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-[12px] text-[#f9fafb] focus:outline-none focus:border-[#20808D]"
                value={status}
                onChange={(e) => setStatus(e.target.value as GoalStatus)}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#9ca3af] font-medium mb-1 block">Parent Goal</label>
              <select
                className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-[12px] text-[#f9fafb] focus:outline-none focus:border-[#20808D]"
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
