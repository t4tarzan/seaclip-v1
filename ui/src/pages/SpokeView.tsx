import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useSpokeStatus, useSpokeTasks, useSpokeJobs, useSpokeFeedback } from "../api/spoke";
import { StatusBadge } from "../components/StatusBadge";
import { MetricCard } from "../components/MetricCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SkeletonTable } from "../components/ui/skeleton";
import { Cpu, Activity, CheckCircle, Send, Clock, GitBranch, GitPullRequest } from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SpokeTask } from "../lib/types";

export default function SpokeView() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { data: status, isLoading: statusLoading } = useSpokeStatus(deviceId);
  const { data: tasksData, isLoading: tasksLoading } = useSpokeTasks(deviceId);
  const { data: jobsData, isLoading: jobsLoading } = useSpokeJobs(deviceId);
  const feedbackMutation = useSpokeFeedback();
  const qc = useQueryClient();

  const { data: gitTasksData, isLoading: gitTasksLoading } = useQuery({
    queryKey: ["spoke-git-tasks", deviceId],
    queryFn: () => api.get<{ data: SpokeTask[] }>(`/spoke/${deviceId}/git-tasks`),
    enabled: !!deviceId,
    refetchInterval: 10_000,
  });

  const [feedbackIssueId, setFeedbackIssueId] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [submittingPR, setSubmittingPR] = useState<string | null>(null);

  const tasks = tasksData?.data ?? [];
  const jobs = jobsData?.data ?? [];
  const gitTasks = gitTasksData?.data ?? [];

  const handleSubmitPR = async (taskId: string) => {
    if (!deviceId) return;
    setSubmittingPR(taskId);
    try {
      await api.post(`/spoke/${deviceId}/git-tasks/${taskId}/submit-pr`, {});
      void qc.invalidateQueries({ queryKey: ["spoke-git-tasks", deviceId] });
    } finally {
      setSubmittingPR(null);
    }
  };

  const handleSubmitFeedback = () => {
    if (!deviceId || !feedbackIssueId || !feedbackComment) return;
    feedbackMutation.mutate(
      { deviceId, issueId: feedbackIssueId, comment: feedbackComment },
      {
        onSuccess: () => {
          setFeedbackComment("");
          setFeedbackIssueId("");
          setFeedbackSent(true);
          setTimeout(() => setFeedbackSent(false), 3000);
        },
      },
    );
  };

  // Status color indicator
  const statusColor =
    status?.status === "online"
      ? "bg-[#22c55e]"
      : status?.status === "degraded"
        ? "bg-[#eab308]"
        : "bg-[#ef4444]";

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-5 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={cn("w-3 h-3 rounded-full flex-shrink-0", statusColor)} />
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold text-[#f9fafb] truncate">
            {statusLoading ? "Loading..." : status?.name ?? "Unknown Device"}
          </h2>
          <p className="text-[11px] text-[#6b7280]">
            {status?.deviceType ?? ""} {status?.location ? `· ${status.location}` : ""}
            {status?.lastSeenAt
              ? ` · Last seen ${new Date(status.lastSeenAt).toLocaleString()}`
              : ""}
          </p>
        </div>
        {status && status.status !== "unknown" && (
          <StatusBadge type="device" value={status.status} />
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Agents"
          value={status?.agents.total ?? 0}
          icon={<Cpu size={14} />}
          accent="primary"
          loading={statusLoading}
        />
        <MetricCard
          label="Active"
          value={status?.agents.active ?? 0}
          icon={<Activity size={14} />}
          accent="success"
          loading={statusLoading}
        />
        <MetricCard
          label="Tasks"
          value={tasks.length}
          icon={<CheckCircle size={14} />}
          accent="info"
          loading={tasksLoading}
        />
        <MetricCard
          label="Jobs"
          value={jobs.length}
          icon={<Clock size={14} />}
          accent="warning"
          loading={jobsLoading}
        />
      </div>

      {/* Assigned Tasks */}
      <div>
        <h3 className="text-[14px] font-semibold text-[#f9fafb] mb-2">Assigned Tasks</h3>
        <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden">
          {tasksLoading ? (
            <SkeletonTable rows={4} cols={3} />
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-[13px] text-[#9ca3af]">No tasks assigned</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <span className="text-[12px] text-[#f9fafb] font-medium">
                          {task.title}
                        </span>
                        {task.identifier && (
                          <span className="text-[10px] text-[#6b7280] ml-1.5">
                            {task.identifier}
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge type="issue" value={task.status} />
                      </td>
                      <td>
                        <StatusBadge type="priority" value={task.priority} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Heartbeat Jobs */}
      <div>
        <h3 className="text-[14px] font-semibold text-[#f9fafb] mb-2">Heartbeat Jobs</h3>
        <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden">
          {jobsLoading ? (
            <SkeletonTable rows={3} cols={3} />
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-[13px] text-[#9ca3af]">No heartbeat jobs</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>Last Run</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.agentId}>
                      <td>
                        <span className="text-[12px] text-[#f9fafb] font-medium">
                          {job.agentName}
                        </span>
                        {job.heartbeatCron && (
                          <span className="text-[10px] text-[#6b7280] ml-1.5">
                            {job.heartbeatCron}
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge type="agent" value={job.status as any} />
                      </td>
                      <td className="text-[11px] text-[#9ca3af]">
                        {job.lastRunAt
                          ? new Date(job.lastRunAt).toLocaleString()
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Spoke Git Tasks */}
      <div>
        <h3 className="text-[14px] font-semibold text-[#f9fafb] mb-2 flex items-center gap-2">
          <GitBranch size={14} className="text-[#20808D]" />
          Spoke Tasks
        </h3>
        <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden">
          {gitTasksLoading ? (
            <SkeletonTable rows={3} cols={4} />
          ) : gitTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-[13px] text-[#9ca3af]">No git tasks assigned</p>
              <p className="text-[11px] text-[#6b7280] mt-1">
                Tasks will appear here when assigned from the hub
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {gitTasks.map((gt) => (
                    <tr key={gt.id}>
                      <td>
                        <span className="text-[12px] text-[#f9fafb] font-medium">
                          {gt.title}
                        </span>
                        {gt.repoUrl && (
                          <span className="text-[10px] text-[#6b7280] ml-1.5 truncate">
                            {gt.repoUrl}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="text-[11px] text-[#9ca3af] font-mono">
                          {gt.branch ?? "—"}
                        </span>
                      </td>
                      <td>
                        <StatusBadge type="spoke-task" value={gt.status} />
                      </td>
                      <td>
                        {gt.status === "in_progress" && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<GitPullRequest size={12} />}
                            onClick={() => handleSubmitPR(gt.id)}
                            loading={submittingPR === gt.id}
                          >
                            Submit PR
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Form */}
      <div>
        <h3 className="text-[14px] font-semibold text-[#f9fafb] mb-2">Submit Feedback</h3>
        <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4 space-y-3">
          <div>
            <label className="text-[11px] text-[#9ca3af] font-medium mb-1 block">
              Task
            </label>
            {tasks.length > 0 ? (
              <select
                className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-[12px] text-[#f9fafb] focus:outline-none focus:border-[#20808D]"
                value={feedbackIssueId}
                onChange={(e) => setFeedbackIssueId(e.target.value)}
              >
                <option value="">Select a task...</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.identifier ? `${t.identifier} — ` : ""}{t.title}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                placeholder="Issue ID (UUID)"
                value={feedbackIssueId}
                onChange={(e) => setFeedbackIssueId(e.target.value)}
              />
            )}
          </div>
          <div>
            <label className="text-[11px] text-[#9ca3af] font-medium mb-1 block">
              Comment
            </label>
            <textarea
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-[12px] text-[#f9fafb] placeholder:text-[#6b7280] focus:outline-none focus:border-[#20808D] resize-none"
              rows={3}
              placeholder="Describe the result or feedback..."
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              icon={<Send size={12} />}
              onClick={handleSubmitFeedback}
              disabled={!feedbackIssueId || !feedbackComment || feedbackMutation.isPending}
            >
              {feedbackMutation.isPending ? "Sending..." : "Submit"}
            </Button>
            {feedbackSent && (
              <span className="text-[11px] text-[#22c55e] font-medium">
                Feedback submitted
              </span>
            )}
            {feedbackMutation.isError && (
              <span className="text-[11px] text-[#ef4444] font-medium">
                Failed to submit
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
