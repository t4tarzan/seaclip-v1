import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Filter, LayoutGrid, List } from "lucide-react";
import { useIssues, useUpdateIssue } from "../api/issues";
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
  { status: "backlog", label: "Backlog", color: "#6b7280" },
  { status: "todo", label: "Todo", color: "#eab308" },
  { status: "in_progress", label: "In Progress", color: "#20808D" },
  { status: "in_review", label: "In Review", color: "#06b6d4" },
  { status: "done", label: "Done", color: "#22c55e" },
];

const PRIORITY_ICONS: Record<IssuePriority, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

function IssueCard({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-[#111827] border border-[#374151] rounded-lg p-3 cursor-pointer hover:border-[#4b5563] hover:bg-[#1a2132] transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[12px] font-medium text-[#f9fafb] leading-snug group-hover:text-white line-clamp-2">
          {issue.title}
        </p>
        <span className="flex-shrink-0 text-[13px]">{PRIORITY_ICONS[issue.priority]}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#6b7280] font-mono">{issue.identifier}</span>
        {issue.projectName && (
          <>
            <span className="text-[#374151]">·</span>
            <span className="text-[10px] text-[#6b7280] truncate">{issue.projectName}</span>
          </>
        )}
        <span className="ml-auto text-[10px] text-[#6b7280]">{timeAgo(issue.updatedAt)}</span>
      </div>
      {issue.assigneeName && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-4 h-4 rounded-full bg-[#20808D]/20 flex items-center justify-center text-[7px] font-bold text-[#20808D]">
            {issue.assigneeName.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] text-[#9ca3af]">{issue.assigneeName}</span>
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
        !issue.identifier.toLowerCase().includes(q)
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
    <div className="p-6 flex flex-col gap-5 animate-fade-in h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-[#f9fafb]">Issues</h2>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            {issues.length} issue{issues.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-[#1f2937] rounded-lg p-0.5">
            <button
              onClick={() => handleViewChange("board")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                viewMode === "board"
                  ? "bg-[#20808D] text-white"
                  : "text-[#6b7280] hover:text-[#f9fafb]"
              )}
            >
              <LayoutGrid size={12} />
              Board
            </button>
            <button
              onClick={() => handleViewChange("list")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                viewMode === "list"
                  ? "bg-[#20808D] text-white"
                  : "text-[#6b7280] hover:text-[#f9fafb]"
              )}
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
            className={showFilters ? "text-[#20808D]" : undefined}
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
      <div className="w-72">
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
        <div className="flex gap-4">
          {COLUMNS.map((col) => (
            <div key={col.status} className="flex-1 min-w-0">
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
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map((col) => {
            const colIssues = issuesByStatus[col.status];
            return (
              <div
                key={col.status}
                className="flex flex-col flex-shrink-0 w-72"
              >
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-0.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="text-[12px] font-semibold text-[#f9fafb]">
                    {col.label}
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-[#6b7280] bg-[#1f2937] px-1.5 py-0.5 rounded">
                    {colIssues.length}
                  </span>
                  <button
                    onClick={() => { setNewIssueStatus(col.status); setShowNewDialog(true); }}
                    className="p-1 rounded text-[#6b7280] hover:text-[#f9fafb] hover:bg-[#1f2937] transition-colors"
                    title={`Add to ${col.label}`}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Issues */}
                <div className={cn(
                  "kanban-column",
                  colIssues.length === 0 &&
                    "items-center justify-center rounded-xl border-2 border-dashed border-[#374151] min-h-[120px]"
                )}>
                  {colIssues.length === 0 ? (
                    <p className="text-[11px] text-[#4b5563] text-center">No issues</p>
                  ) : (
                    colIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        onClick={() => navigate(`/issues/${issue.id}`)}
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
