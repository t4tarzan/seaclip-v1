import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Trash2 } from "lucide-react";
import { StatusIcon } from "./StatusIcon";
import { PriorityIcon } from "./PriorityIcon";
import type { Issue, IssueStatus } from "../lib/types";
import { timeAgo } from "../lib/utils";

const BOARD_STATUSES: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
];

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface KanbanBoardProps {
  issues: Issue[];
  onUpdateIssue: (id: string, data: Record<string, unknown>) => void;
  onAddIssue?: (status: IssueStatus) => void;
  onDeleteIssue?: (id: string) => void;
}

/* ── Droppable Column ── */

function KanbanColumn({
  status,
  issues,
  onAddIssue,
  onDeleteIssue,
}: {
  status: IssueStatus;
  issues: Issue[];
  onAddIssue?: (status: IssueStatus) => void;
  onDeleteIssue?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col flex-1 min-w-[220px]">
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <StatusIcon status={status} />
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">
          {statusLabel(status)}
        </span>
        <span className="ml-auto text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface)] px-1.5 py-0.5 rounded-none">
          {issues.length}
        </span>
        {onAddIssue && (
          <button
            onClick={() => onAddIssue(status)}
            className="p-1 rounded-none text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
            title={`Add to ${statusLabel(status)}`}
          >
            <Plus size={12} />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-none p-2 space-y-2 transition-colors ${
          isOver
            ? "bg-[var(--primary)]/10 border border-[var(--primary)]/30"
            : "bg-[var(--bg-alt)]/30"
        }`}
      >
        <SortableContext
          items={issues.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {issues.length === 0 ? (
            <p className="text-[11px] text-[var(--border-hover)] text-center pt-10">
              No issues
            </p>
          ) : (
            issues.map((issue) => (
              <KanbanCard key={issue.id} issue={issue} onDelete={onDeleteIssue ? () => onDeleteIssue(issue.id) : undefined} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

/* ── Draggable Card ── */

function KanbanCard({
  issue,
  isOverlay,
  onDelete,
}: {
  issue: Issue;
  isOverlay?: boolean;
  onDelete?: () => void;
}) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id, data: { issue } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) navigate(`/issues/${issue.id}`);
      }}
      className={`relative bg-[var(--bg-alt)] border border-[var(--border)] rounded-none px-4 py-3.5 cursor-grab active:cursor-grabbing transition-all group ${
        isDragging && !isOverlay ? "opacity-30" : ""
      } ${
        isOverlay
          ? "shadow-lg shadow-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30 rounded-none"
          : "hover:border-[var(--border-hover)] hover:bg-[#1a2132]"
      }`}
    >
      {onDelete && !isOverlay && (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-none hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
          style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", zIndex: 10 }}
          title="Delete issue"
        >
          <Trash2 size={13} />
        </button>
      )}
      <div className="flex items-start justify-between gap-1.5 mb-2 pr-3">
        <p className="text-[12px] font-medium text-[var(--text-primary)] leading-snug group-hover:text-white line-clamp-2 min-w-0">
          {issue.title}
        </p>
        <span className="shrink-0"><PriorityIcon priority={issue.priority} /></span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
          {issue.identifier}
        </span>
        {issue.projectName && (
          <>
            <span className="text-[var(--border)]">·</span>
            <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[80px]">
              {issue.projectName}
            </span>
          </>
        )}
        <span className="ml-auto text-[10px] text-[var(--text-muted)] shrink-0">
          {timeAgo(issue.updatedAt)}
        </span>
      </div>
      {(() => {
        const meta = issue.metadata as Record<string, unknown> | undefined;
        const stage = meta?.pipelineStage as string | undefined;
        if (!stage) return null;
        const colors: Record<string, string> = {
          plan: "bg-gray-400", researched: "bg-blue-400", planned: "bg-purple-400",
          coded: "bg-yellow-400", tested: "bg-cyan-400", reviewed: "bg-green-400", completed: "bg-green-400",
        };
        return (
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`inline-block w-2 h-2 rounded-full ${colors[stage] ?? "bg-gray-400"}`} />
            <span className="text-[10px] text-[var(--text-muted)]">{stage}</span>
          </div>
        );
      })()}
      {issue.assigneeName && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-4 h-4 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-[7px] font-bold text-[var(--primary)]">
            {issue.assigneeName.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] text-[var(--text-secondary)]">
            {issue.assigneeName}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Main Board ── */

export function KanbanBoard({
  issues,
  onUpdateIssue,
  onAddIssue,
  onDeleteIssue,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columnIssues = useMemo(() => {
    const grouped: Record<string, Issue[]> = {};
    for (const status of BOARD_STATUSES) {
      grouped[status] = [];
    }
    for (const issue of issues) {
      if (grouped[issue.status]) {
        grouped[issue.status].push(issue);
      }
    }
    return grouped;
  }, [issues]);

  const activeIssue = useMemo(
    () => (activeId ? issues.find((i) => i.id === activeId) ?? null : null),
    [activeId, issues]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const issueId = active.id as string;
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;

    let targetStatus: string | null = null;

    if ((BOARD_STATUSES as string[]).includes(over.id as string)) {
      targetStatus = over.id as string;
    } else {
      const targetIssue = issues.find((i) => i.id === over.id);
      if (targetIssue) {
        targetStatus = targetIssue.status;
      }
    }

    if (targetStatus && targetStatus !== issue.status) {
      onUpdateIssue(issueId, { status: targetStatus });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {BOARD_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            issues={columnIssues[status] ?? []}
            onAddIssue={onAddIssue}
            onDeleteIssue={onDeleteIssue}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? <KanbanCard issue={activeIssue} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
