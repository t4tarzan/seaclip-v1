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
    <div className="p-6 flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-[#f9fafb]">Spoke Tasks</h2>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} — git worktree assignments to spoke devices
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Table */}
      <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#374151] flex items-center justify-center mb-3">
              <GitBranch size={24} className="text-[#6b7280]" />
            </div>
            <p className="text-[13px] font-medium text-[#9ca3af]">
              {tab !== "all" ? "No tasks match this filter" : "No spoke tasks yet"}
            </p>
            <p className="text-[11px] text-[#6b7280] mt-1">
              {tab !== "all"
                ? "Try a different status filter"
                : "Create a task to assign work to a spoke device"}
            </p>
            {tab === "all" && (
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => setShowNewDialog(true)}
              >
                Create Task
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                  <tr key={task.id} className="hover:bg-[#263244] transition-colors">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#20808D]/15 border border-[#20808D]/25 flex items-center justify-center text-[#20808D] flex-shrink-0">
                          <GitBranch size={12} />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-[#f9fafb]">{task.title}</p>
                          {task.repoUrl && (
                            <p className="text-[10px] text-[#6b7280] truncate max-w-[220px]">
                              {task.repoUrl}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-[11px] bg-[#374151] text-[#9ca3af] px-2 py-0.5 rounded font-medium">
                        {task.deviceId.slice(0, 8)}...
                      </span>
                    </td>
                    <td>
                      <span className="text-[11px] text-[#9ca3af] font-mono">
                        {task.branch ?? "—"}
                      </span>
                    </td>
                    <td>
                      <StatusBadge type="spoke-task" value={task.status} />
                    </td>
                    <td>
                      <span className="text-[11px] text-[#9ca3af]">
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

        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-[#9ca3af] font-medium mb-1 block">Title</label>
            <Input
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
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
          <div>
            <label className="text-[11px] text-[#9ca3af] font-medium mb-1 block">Repository URL</label>
            <Input
              placeholder="https://github.com/org/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] text-[#9ca3af] font-medium mb-1 block">Device</label>
            <select
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-[12px] text-[#f9fafb] focus:outline-none focus:border-[#20808D]"
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
