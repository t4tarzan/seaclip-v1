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
    queryFn: () => api.get<{ data: SpokeTask[] }>(`/spoke/${deviceId}/spoke-tasks`),
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

  const handleSubmitPR = async (task: SpokeTask) => {
    if (!deviceId || !task.companyId) return;
    setSubmittingPR(task.id);
    try {
      // Update task status to pr_raised
      await api.patch(`/companies/${task.companyId}/spoke-tasks/${task.id}/status`, {
        status: "pr_raised",
      });
      // Create a PR for this task
      await api.post(`/companies/${task.companyId}/pull-requests`, {
        spokeTaskId: task.id,
        deviceId,
        title: task.title,
        description: task.description ?? "",
        sourceBranch: task.branch ?? `spoke/${deviceId}/${task.id}`,
        targetBranch: "main",
      });
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
      ? "bg-[var(--success)]"
      : status?.status === "degraded"
        ? "bg-[var(--warning)]"
        : "bg-[var(--error)]";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 768, margin: "0 auto" }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className={cn("rounded-full", statusColor)} style={{ width: 12, height: 12, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)] truncate">
            {statusLoading ? "Loading..." : status?.name ?? "Unknown Device"}
          </h2>
          <p className="text-[11px] text-[var(--text-muted)]">
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="sm:grid-cols-4">
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
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]" style={{ marginBottom: 8 }}>Assigned Tasks</h3>
        <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {tasksLoading ? (
            <SkeletonTable rows={4} cols={3} />
          ) : tasks.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0" }} className="text-center">
              <p className="text-[13px] text-[var(--text-secondary)]">No tasks assigned</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
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
                        <span className="text-[12px] text-[var(--text-primary)] font-medium">
                          {task.title}
                        </span>
                        {task.identifier && (
                          <span className="text-[10px] text-[var(--text-muted)]" style={{ marginLeft: 6 }}>
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
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]" style={{ marginBottom: 8 }}>Heartbeat Jobs</h3>
        <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {jobsLoading ? (
            <SkeletonTable rows={3} cols={3} />
          ) : jobs.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0" }} className="text-center">
              <p className="text-[13px] text-[var(--text-secondary)]">No heartbeat jobs</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
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
                        <span className="text-[12px] text-[var(--text-primary)] font-medium">
                          {job.agentName}
                        </span>
                        {job.heartbeatCron && (
                          <span className="text-[10px] text-[var(--text-muted)]" style={{ marginLeft: 6 }}>
                            {job.heartbeatCron}
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge type="agent" value={job.status as any} />
                      </td>
                      <td className="text-[11px] text-[var(--text-secondary)]">
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
        <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }} className="text-[14px] font-semibold text-[var(--text-primary)]">
          <GitBranch size={14} className="text-[var(--primary)]" />
          Spoke Tasks
        </h3>
        <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {gitTasksLoading ? (
            <SkeletonTable rows={3} cols={4} />
          ) : gitTasks.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0" }} className="text-center">
              <p className="text-[13px] text-[var(--text-secondary)]">No git tasks assigned</p>
              <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: 4 }}>
                Tasks will appear here when assigned from the hub
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
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
                        <span className="text-[12px] text-[var(--text-primary)] font-medium">
                          {gt.title}
                        </span>
                        {gt.repoUrl && (
                          <span className="text-[10px] text-[var(--text-muted)] truncate" style={{ marginLeft: 6 }}>
                            {gt.repoUrl}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="text-[11px] text-[var(--text-secondary)] font-mono">
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
                            onClick={() => handleSubmitPR(gt)}
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
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]" style={{ marginBottom: 8 }}>Submit Feedback</h3>
        <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-medium" style={{ marginBottom: 4, display: "block" }}>
              Task
            </label>
            {tasks.length > 0 ? (
              <select
                style={{ width: "100%", backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px" }}
                className="text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
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
            <label className="text-[11px] text-[var(--text-secondary)] font-medium" style={{ marginBottom: 4, display: "block" }}>
              Comment
            </label>
            <textarea
              style={{ width: "100%", backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", resize: "none" }}
              className="text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
              rows={3}
              placeholder="Describe the result or feedback..."
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              size="sm"
              icon={<Send size={12} />}
              onClick={handleSubmitFeedback}
              disabled={!feedbackIssueId || !feedbackComment || feedbackMutation.isPending}
            >
              {feedbackMutation.isPending ? "Sending..." : "Submit"}
            </Button>
            {feedbackSent && (
              <span className="text-[11px] text-[var(--success)] font-medium">
                Feedback submitted
              </span>
            )}
            {feedbackMutation.isError && (
              <span className="text-[11px] text-[var(--error)] font-medium">
                Failed to submit
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
