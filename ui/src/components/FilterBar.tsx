import { X } from "lucide-react";
import type { IssueStatus, IssuePriority } from "../lib/types";
import { cn } from "../lib/utils";

export interface FilterState {
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee?: string;
}

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  /** List of unique assignee names from the current dataset */
  assignees?: string[];
  className?: string;
}

const STATUS_OPTIONS: { value: IssueStatus; label: string; color: string }[] = [
  { value: "backlog", label: "Backlog", color: "#6b7280" },
  { value: "todo", label: "Todo", color: "#eab308" },
  { value: "in_progress", label: "In Progress", color: "#20808D" },
  { value: "in_review", label: "In Review", color: "#06b6d4" },
  { value: "done", label: "Done", color: "#22c55e" },
];

const PRIORITY_OPTIONS: { value: IssuePriority; label: string; color: string }[] = [
  { value: "urgent", label: "Urgent", color: "#ef4444" },
  { value: "high", label: "High", color: "#f97316" },
  { value: "medium", label: "Medium", color: "#eab308" },
  { value: "low", label: "Low", color: "#6b7280" },
];

function FilterChip({
  label,
  color,
  active,
  onClick,
  onClear,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
  onClear?: () => void;
}) {
  return (
    <button
      onClick={active && onClear ? onClear : onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
        "border",
        active
          ? "bg-[#20808D]/15 border-[#20808D]/40 text-[#f9fafb]"
          : "bg-[#1f2937] border-[#374151] text-[#9ca3af] hover:text-[#f9fafb] hover:border-[#4b5563]"
      )}
    >
      {color && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
      {active && onClear && (
        <X size={10} className="ml-0.5 text-[#9ca3af] hover:text-[#f9fafb]" />
      )}
    </button>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] mr-1">
        {label}
      </span>
      {children}
    </div>
  );
}

export function FilterBar({
  filters,
  onFiltersChange,
  assignees = [],
  className,
}: FilterBarProps) {
  const hasActiveFilters = filters.status || filters.priority || filters.assignee;

  function toggleStatus(status: IssueStatus) {
    onFiltersChange({
      ...filters,
      status: filters.status === status ? undefined : status,
    });
  }

  function togglePriority(priority: IssuePriority) {
    onFiltersChange({
      ...filters,
      priority: filters.priority === priority ? undefined : priority,
    });
  }

  function toggleAssignee(name: string) {
    onFiltersChange({
      ...filters,
      assignee: filters.assignee === name ? undefined : name,
    });
  }

  function clearAll() {
    onFiltersChange({});
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 py-2",
        className
      )}
    >
      {/* Status filters */}
      <FilterGroup label="Status">
        {STATUS_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            color={opt.color}
            active={filters.status === opt.value}
            onClick={() => toggleStatus(opt.value)}
            onClear={() => toggleStatus(opt.value)}
          />
        ))}
      </FilterGroup>

      <div className="w-px h-4 bg-[#374151]" />

      {/* Priority filters */}
      <FilterGroup label="Priority">
        {PRIORITY_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            color={opt.color}
            active={filters.priority === opt.value}
            onClick={() => togglePriority(opt.value)}
            onClear={() => togglePriority(opt.value)}
          />
        ))}
      </FilterGroup>

      {/* Assignee filters (only show if there are assignees) */}
      {assignees.length > 0 && (
        <>
          <div className="w-px h-4 bg-[#374151]" />
          <FilterGroup label="Assignee">
            {assignees.map((name) => (
              <FilterChip
                key={name}
                label={name}
                active={filters.assignee === name}
                onClick={() => toggleAssignee(name)}
                onClear={() => toggleAssignee(name)}
              />
            ))}
          </FilterGroup>
        </>
      )}

      {/* Clear all */}
      {hasActiveFilters && (
        <>
          <div className="w-px h-4 bg-[#374151]" />
          <button
            onClick={clearAll}
            className="text-[11px] text-[#6b7280] hover:text-[#f9fafb] transition-colors"
          >
            Clear all
          </button>
        </>
      )}
    </div>
  );
}
