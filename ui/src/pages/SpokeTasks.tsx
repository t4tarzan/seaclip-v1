import React, { useState } from "react";
import { Plus, RefreshCw, GitBranch } from "lucide-react";
import { useSpokeTasks, useCreateSpokeTask } from "../api/spoke-tasks";
import { useEdgeDevices } from "../api/edge-devices";
import { useCompanyContext } from "../context/CompanyContext";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SkeletonTable } from "../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { timeAgo, cn } from "../lib/utils";
import type { SpokeTaskStatus } from "../lib/types";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_TABS = [
  { key: "all" as const, label: "All" },
  { key: "pending" as const, label: "Pending" },
  { key: "in_progress" as const, label: "In Progress" },
  { key: "pr_raised" as const, label: "PR Raised" },
  { key: "done" as const, label: "Done" },
] as const;

type TabKey = (typeof STATUS_TABS)[number]["key"];

export default function SpokeTasks() {
  const { companyId } = useCompanyContext();
  const [tab, setTab] = useState<TabKey>("all");
  const filters = tab === "all" ? undefined : { status: tab as SpokeTaskStatus };
  const { data: tasks = [], isLoading, isFetching } = useSpokeTasks(companyId, filters);
  const qc = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Spoke Tasks</h2>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} — git worktree assignments to spoke devices
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />}
            onClick={() => qc.invalidateQueries({ queryKey: ["spoke-tasks-list", companyId] })}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={12} />}
            onClick={() => setShowNewDialog(true)}
          >
            New Task
          </Button>
        </div>
      </div>

      {/* Status Tabs */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          backgroundColor: "var(--bg-alt)",
          border: "1px solid var(--border)",
          borderRadius: 0,
          padding: "3px 4px",
        }}
      >
        {STATUS_TABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            className={cn(
              "px-3 py-1.5 text-[11px] rounded-none font-medium transition-colors whitespace-nowrap",
              tab === s.key
                ? "bg-[var(--primary)]/20 text-[var(--accent)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, overflow: "hidden" }}>
        {isLoading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : tasks.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0" }} className="text-center">
            <div style={{ width: 48, height: 48, borderRadius: 0, backgroundColor: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <GitBranch size={24} className="text-[var(--text-muted)]" />
            </div>
            <p className="text-[13px] font-medium text-[var(--text-secondary)]">
              {tab !== "all" ? "No tasks match this filter" : "No spoke tasks yet"}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: 4 }}>
              {tab !== "all"
                ? "Try a different status filter"
                : "Create a task to assign work to a spoke device"}
            </p>
            {tab === "all" && (
              <Button
                variant="primary"
                size="sm"
                style={{ marginTop: 16 }}
                onClick={() => setShowNewDialog(true)}
              >
                Create Task
              </Button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Device</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-[var(--surface-raised)] transition-colors">
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} className="bg-[var(--primary)]/15 border border-[var(--primary)]/25 text-[var(--primary)]">
                          <GitBranch size={12} />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{task.title}</p>
                          {task.repoUrl && (
                            <p className="text-[10px] text-[var(--text-muted)] truncate" style={{ maxWidth: 220 }}>
                              {task.repoUrl}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-[11px] bg-[var(--border)] text-[var(--text-secondary)] rounded-none font-medium" style={{ padding: "2px 8px" }}>
                        {task.deviceId.slice(0, 8)}...
                      </span>
                    </td>
                    <td>
                      <span className="text-[11px] text-[var(--text-secondary)] font-mono">
                        {task.branch ?? "—"}
                      </span>
                    </td>
                    <td>
                      <StatusBadge type="spoke-task" value={task.status} />
                    </td>
                    <td>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {timeAgo(task.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewSpokeTaskDialog open={showNewDialog} onOpenChange={setShowNewDialog} />
    </div>
  );
}

function NewSpokeTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { companyId } = useCompanyContext();
  const { data: devices = [] } = useEdgeDevices(companyId);
  const createTask = useCreateSpokeTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [deviceId, setDeviceId] = useState("");

  const handleSubmit = async () => {
    if (!companyId || !title || !repoUrl || !deviceId) return;
    await createTask.mutateAsync({
      companyId,
      data: { title, description: description || undefined, repoUrl, deviceId },
    });
    setTitle("");
    setDescription("");
    setRepoUrl("");
    setDeviceId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>New Spoke Task</DialogTitle>
          <DialogDescription>
            Assign a git worktree task to a spoke device.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-medium" style={{ marginBottom: 4, display: "block" }}>Title</label>
            <Input
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-medium" style={{ marginBottom: 4, display: "block" }}>Description</label>
            <textarea
              style={{ width: "100%", backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 0, padding: "8px 12px" }}
              className="text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
              rows={3}
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-medium" style={{ marginBottom: 4, display: "block" }}>Repository URL</label>
            <Input
              placeholder="https://github.com/org/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-medium" style={{ marginBottom: 4, display: "block" }}>Device</label>
            <select
              style={{ width: "100%", backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 0, padding: "8px 12px" }}
              className="text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            >
              <option value="">Select a device...</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.deviceType})
                </option>
              ))}
            </select>
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
            disabled={!title || !repoUrl || !deviceId}
            loading={createTask.isPending}
          >
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
