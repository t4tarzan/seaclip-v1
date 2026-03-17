import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, ChevronRight } from "lucide-react";
import { useIssue, useUpdateIssue } from "../api/issues";
import { useCompanyContext } from "../context/CompanyContext";
import { StatusBadge } from "../components/StatusBadge";
import { CommentThread } from "../components/CommentThread";
import { PipelineActions } from "../components/PipelineActions";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { SkeletonCard } from "../components/ui/skeleton";
import { timeAgo } from "../lib/utils";
import type { IssueStatus, IssuePriority } from "../lib/types";

const STATUS_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  backlog: ["todo", "in_progress"],
  todo: ["in_progress", "backlog"],
  in_progress: ["in_review", "todo", "done"],
  in_review: ["done", "in_progress"],
  done: ["in_progress"],
};

const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

const PRIORITY_ICONS: Record<IssuePriority, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

export default function IssueDetail() {
  const { id } = useParams<{ id: string }>();
  const { companyId } = useCompanyContext();
  const navigate = useNavigate();
  const { data: issue, isLoading } = useIssue(companyId, id);
  const updateIssue = useUpdateIssue();

  const handleStatusChange = async (newStatus: IssueStatus) => {
    if (!companyId || !id) return;
    await updateIssue.mutateAsync({ companyId, id, data: { status: newStatus } });
  };

  if (isLoading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2" />
        <SkeletonCard />
      </div>
    );
  }

  if (!issue) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <p className="text-[var(--text-muted)]">Issue not found</p>
        <Button variant="ghost" size="sm" style={{ marginTop: 12 }} onClick={() => navigate("/issues")}>
          Back to Issues
        </Button>
      </div>
    );
  }

  const transitions = STATUS_TRANSITIONS[issue.status] ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        icon={<ArrowLeft size={12} />}
        onClick={() => navigate("/issues")}
        className="w-fit"
      >
        Issues
      </Button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }} className="lg:grid-cols-3">
        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="lg:col-span-2">
          {/* Issue header */}
          <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">{issue.identifier}</span>
                  <StatusBadge type="issue" value={issue.status} />
                  <span className="text-[13px]">{PRIORITY_ICONS[issue.priority]}</span>
                  <StatusBadge type="priority" value={issue.priority} />
                </div>
                <h1 className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{issue.title}</h1>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Edit2 size={12} />}
              >
                Edit
              </Button>
            </div>

            {issue.description ? (
              <div className="prose prose-invert max-w-none">
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {issue.description}
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-[var(--border-hover)] italic">No description provided.</p>
            )}
          </div>

          {/* Status transitions */}
          {transitions.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="text-[11px] text-[var(--text-muted)]">Move to:</span>
              {transitions.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  icon={<ChevronRight size={10} />}
                  onClick={() => handleStatusChange(s)}
                  loading={updateIssue.isPending}
                >
                  {STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
          )}

          {/* Tabs: Comments / Activity */}
          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="comments">
              <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: 16 }}>
                <CommentThread issueId={issue.id} />
              </div>
            </TabsContent>
            <TabsContent value="activity">
              <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 0,
                        backgroundColor: "var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span className="text-[9px] text-[var(--text-secondary)]">•</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Created {timeAgo(issue.createdAt)}
                    </p>
                  </div>
                  {issue.updatedAt !== issue.createdAt && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 0,
                          backgroundColor: "var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span className="text-[9px] text-[var(--text-secondary)]">✎</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Updated {timeAgo(issue.updatedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Details</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Status", value: <StatusBadge type="issue" value={issue.status} /> },
                { label: "Priority", value: <StatusBadge type="priority" value={issue.priority} /> },
                {
                  label: "Assignee",
                  value: issue.assigneeName ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        className="bg-[var(--primary)]/20 border border-[var(--primary)]/30 text-[8px] font-bold text-[var(--primary)]"
                      >
                        {issue.assigneeName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[11px] text-[var(--text-primary)]">{issue.assigneeName}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)]">Unassigned</span>
                  ),
                },
                {
                  label: "Project",
                  value: <span className="text-[11px] text-[var(--text-primary)]">{issue.projectName ?? "—"}</span>,
                },
                {
                  label: "Goal",
                  value: <span className="text-[11px] text-[var(--text-primary)]">{issue.goalName ?? "—"}</span>,
                },
                {
                  label: "Created",
                  value: <span className="text-[11px] text-[var(--text-secondary)]">{timeAgo(issue.createdAt)}</span>,
                },
                {
                  label: "Updated",
                  value: <span className="text-[11px] text-[var(--text-secondary)]">{timeAgo(issue.updatedAt)}</span>,
                },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span className="text-[11px] text-[var(--text-muted)]" style={{ flexShrink: 0 }}>{label}</span>
                  <div>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <PipelineActions issue={issue} />
        </div>
      </div>
    </div>
  );
}
