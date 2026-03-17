import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Filter, LayoutGrid, List, Trash2 } from "lucide-react";
import { useIssues, useUpdateIssue, useDeleteIssue } from "../api/issues";
import { useCompanyContext } from "../context/CompanyContext";
import { StatusBadge } from "../components/StatusBadge";
import { NewIssueDialog } from "../components/NewIssueDialog";
import { KanbanBoard } from "../components/KanbanBoard";
import { FilterBar, type FilterState } from "../components/FilterBar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SkeletonCard } from "../components/ui/skeleton";
import type { Issue, IssueStatus, IssuePriority } from "../lib/types";
import { cn, timeAgo } from "../lib/utils";

type ViewMode = "board" | "list";

const COLUMNS: { status: IssueStatus; label: string; color: string }[] = [
  { status: "backlog", label: "Backlog", color: "var(--text-muted)" },
  { status: "todo", label: "Todo", color: "var(--warning)" },
  { status: "in_progress", label: "In Progress", color: "var(--primary)" },
  { status: "in_review", label: "In Review", color: "var(--accent)" },
  { status: "done", label: "Done", color: "var(--success)" },
];

const PRIORITY_ICONS: Record<IssuePriority, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

function IssueCard({ issue, onClick, onDelete }: { issue: Issue; onClick: () => void; onDelete?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer hover:border-[var(--border-hover)] hover:bg-[#1a2132] transition-all group"
      style={{ backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 0, padding: 16, position: "relative" }}
    >
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            position: "absolute", top: 6, right: 6,
            padding: 4, borderRadius: 0, border: "none",
            backgroundColor: "transparent", cursor: "pointer",
            color: "var(--text-muted)", display: "flex", alignItems: "center",
          }}
          title="Delete issue"
        >
          <Trash2 size={12} />
        </button>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 8, paddingRight: 12 }}>
        <p className="text-[12px] font-medium text-[var(--text-primary)] leading-snug group-hover:text-white line-clamp-2" style={{ minWidth: 0 }}>
          {issue.title}
        </p>
        <span className="text-[13px]" style={{ flexShrink: 0 }}>{PRIORITY_ICONS[issue.priority]}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span className="text-[10px] text-[var(--text-muted)] font-mono" style={{ flexShrink: 0 }}>{issue.identifier}</span>
        {issue.projectName && (
          <>
            <span className="text-[var(--border)]">·</span>
            <span className="text-[10px] text-[var(--text-muted)] truncate">{issue.projectName}</span>
          </>
        )}
        <span className="text-[10px] text-[var(--text-muted)]" style={{ marginLeft: "auto" }}>{timeAgo(issue.updatedAt)}</span>
      </div>
      {issue.assigneeName && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <div className="text-[7px] font-bold text-[var(--primary)]" style={{ width: 16, height: 16, borderRadius: 0, backgroundColor: "rgba(var(--primary-rgb), 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {issue.assigneeName.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] text-[var(--text-secondary)]">{issue.assigneeName}</span>
        </div>
      )}
    </div>
  );
}

function getInitialViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem("seaclip-issues-view");
    if (stored === "board" || stored === "list") return stored;
  } catch {
    // localStorage unavailable
  }
  return "board";
}

export default function Issues() {
  const { companyId } = useCompanyContext();
  const navigate = useNavigate();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newIssueStatus, setNewIssueStatus] = useState<IssueStatus>("backlog");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [filters, setFilters] = useState<FilterState>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data: issues = [], isLoading } = useIssues(companyId);
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();

  const uniqueAssignees = useMemo(() => {
    const names = new Set<string>();
    for (const issue of issues) {
      if (issue.assigneeName) names.add(issue.assigneeName);
    }
    return Array.from(names).sort();
  }, [issues]);

  const filteredIssues = issues.filter((issue) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !issue.title.toLowerCase().includes(q) &&
        !(issue.identifier ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (filters.status && issue.status !== filters.status) return false;
    if (filters.priority && issue.priority !== filters.priority) return false;
    if (filters.assignee && issue.assigneeName !== filters.assignee) return false;
    return true;
  });

  const issuesByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.status] = filteredIssues.filter((i) => i.status === col.status);
    return acc;
  }, {} as Record<IssueStatus, Issue[]>);

  function handleViewChange(mode: ViewMode) {
    setViewMode(mode);
    try {
      localStorage.setItem("seaclip-issues-view", mode);
    } catch {
      // localStorage unavailable
    }
  }

  function handleUpdateIssue(id: string, data: Record<string, unknown>) {
    if (!companyId) return;
    updateIssue.mutate({ companyId, id, data: data as Partial<Issue> });
  }

  function handleAddIssue(status: IssueStatus) {
    setNewIssueStatus(status);
    setShowNewDialog(true);
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24, height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Issues</h2>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
            {issues.length} issue{issues.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* View Toggle */}
          <div style={{ display: "flex", alignItems: "center", backgroundColor: "var(--surface)", borderRadius: 0, padding: 2 }}>
            <button
              onClick={() => handleViewChange("board")}
              className={cn(
                "text-[11px] font-medium transition-colors",
                viewMode === "board"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 0 }}
            >
              <LayoutGrid size={12} />
              Board
            </button>
            <button
              onClick={() => handleViewChange("list")}
              className={cn(
                "text-[11px] font-medium transition-colors",
                viewMode === "list"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 0 }}
            >
              <List size={12} />
              List
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Filter size={12} />}
            onClick={() => setShowFilters((v) => !v)}
            className={showFilters ? "text-[var(--primary)]" : undefined}
          >
            Filter
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={12} />}
            onClick={() => { setNewIssueStatus("backlog"); setShowNewDialog(true); }}
          >
            New Issue
          </Button>
        </div>
      </div>

      {/* Search */}
      <div style={{ width: 288 }}>
        <Input
          placeholder="Search issues..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          assignees={uniqueAssignees}
        />
      )}

      {/* Content */}
      {isLoading ? (
        <div style={{ display: "flex", gap: 16 }}>
          {COLUMNS.map((col) => (
            <div key={col.status} style={{ flex: 1, minWidth: 0 }}>
              <SkeletonCard />
              <SkeletonCard className="mt-2" />
            </div>
          ))}
        </div>
      ) : viewMode === "board" ? (
        <KanbanBoard
          issues={filteredIssues}
          onUpdateIssue={handleUpdateIssue}
          onAddIssue={handleAddIssue}
          onDeleteIssue={(id) => {
            if (companyId) deleteIssue.mutate({ companyId, id });
          }}
        />
      ) : (
        <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, flex: 1 }}>
          {COLUMNS.map((col) => {
            const colIssues = issuesByStatus[col.status];
            return (
              <div
                key={col.status}
                style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 220 }}
              >
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 2px" }}>
                  <div
                    style={{ width: 10, height: 10, borderRadius: 0, flexShrink: 0, backgroundColor: col.color }}
                  />
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                    {col.label}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface)] px-1.5 py-0.5 rounded-none" style={{ marginLeft: "auto" }}>
                    {colIssues.length}
                  </span>
                  <button
                    onClick={() => { setNewIssueStatus(col.status); setShowNewDialog(true); }}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
                    style={{ padding: 4, borderRadius: 0 }}
                    title={`Add to ${col.label}`}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Issues */}
                <div className={cn(
                  "kanban-column",
                  colIssues.length === 0 &&
                    "items-center justify-center rounded-none border-2 border-dashed border-[var(--border)] min-h-[120px]"
                )}>
                  {colIssues.length === 0 ? (
                    <p className="text-[11px] text-[var(--border-hover)] text-center">No issues</p>
                  ) : (
                    colIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        onClick={() => navigate(`/issues/${issue.id}`)}
                        onDelete={() => {
                          if (companyId) deleteIssue.mutate({ companyId, id: issue.id });
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewIssueDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        defaultStatus={newIssueStatus}
      />
    </div>
  );
}
