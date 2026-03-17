import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FolderKanban, CircleDot, ArrowLeft, List, LayoutGrid } from "lucide-react";
import { useCompanyContext } from "../context/CompanyContext";
import { useProjects } from "../api/projects";
import { useIssues, useUpdateIssue } from "../api/issues";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { KanbanBoard } from "../components/KanbanBoard";
import { SkeletonTable } from "../components/ui/skeleton";
import { timeAgo, cn } from "../lib/utils";

type ViewMode = "list" | "board";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { companyId } = useCompanyContext();
  const { data: projects = [] } = useProjects(companyId);
  const project = projects.find((p) => p.id === id);
  const { data: issues = [], isLoading } = useIssues(companyId, id ? { projectId: id } : undefined);
  const updateIssue = useUpdateIssue();
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem("projectDetail.viewMode") as ViewMode) || "list",
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate(-1)} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          {project && (
            <div
              style={{ width: 32, height: 32, borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: `${project.color}20`, borderColor: `${project.color}40`, borderWidth: 1 }}
            >
              <FolderKanban size={14} style={{ color: project.color }} />
            </div>
          )}
          <div>
            <h2 className="text-[18px] font-bold text-[var(--text-primary)]">
              {project?.name ?? "Project"}
            </h2>
            <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
              {issues.length} issue{issues.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 0, padding: 2, border: "1px solid var(--border)" }} className="bg-[var(--bg-alt)]">
          <button
            onClick={() => { setViewMode("list"); localStorage.setItem("projectDetail.viewMode", "list"); }}
            style={{ padding: 6, borderRadius: 0 }}
            className={cn(
              "transition-colors",
              viewMode === "list" ? "bg-[var(--surface)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
            title="List view"
          >
            <List size={14} />
          </button>
          <button
            onClick={() => { setViewMode("board"); localStorage.setItem("projectDetail.viewMode", "board"); }}
            style={{ padding: 6, borderRadius: 0 }}
            className={cn(
              "transition-colors",
              viewMode === "board" ? "bg-[var(--surface)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
            title="Board view"
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* Issues */}
      {isLoading ? (
        <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, overflow: "hidden" }}>
          <SkeletonTable rows={6} cols={4} />
        </div>
      ) : issues.length === 0 ? (
        <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", textAlign: "center" }}>
            <CircleDot size={24} className="text-[var(--border)]" style={{ marginBottom: 12 }} />
            <p className="text-[13px] text-[var(--text-secondary)]">No issues in this project</p>
          </div>
        </div>
      ) : viewMode === "board" ? (
        <KanbanBoard
          issues={issues}
          onUpdateIssue={(issueId, data) => {
            if (!companyId) return;
            updateIssue.mutate({ companyId, id: issueId, data });
          }}
        />
      ) : (
        <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr
                    key={issue.id}
                    className="hover:bg-[var(--surface-raised)] transition-colors cursor-pointer"
                    onClick={() => navigate(`/issues/${issue.id}`)}
                  >
                    <td>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">{issue.identifier}</span>
                    </td>
                    <td>
                      <p className="text-[12px] font-semibold text-[var(--text-primary)]">{issue.title}</p>
                    </td>
                    <td>
                      <StatusBadge type="issue" value={issue.status} />
                    </td>
                    <td>
                      <StatusBadge type="priority" value={issue.priority} />
                    </td>
                    <td>
                      <span className="text-[11px] text-[var(--text-secondary)]">{timeAgo(issue.updatedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
