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
import { Plus } from "lucide-react";
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
}

/* ── Droppable Column ── */

function KanbanColumn({
  status,
  issues,
  onAddIssue,
}: {
  status: IssueStatus;
  issues: Issue[];
  onAddIssue?: (status: IssueStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col flex-shrink-0 w-72">
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <StatusIcon status={status} />
        <span className="text-[12px] font-semibold text-[#f9fafb]">
          {statusLabel(status)}
        </span>
        <span className="ml-auto text-[10px] font-mono text-[#6b7280] bg-[#1f2937] px-1.5 py-0.5 rounded">
          {issues.length}
        </span>
        {onAddIssue && (
          <button
            onClick={() => onAddIssue(status)}
            className="p-1 rounded text-[#6b7280] hover:text-[#f9fafb] hover:bg-[#1f2937] transition-colors"
            title={`Add to ${statusLabel(status)}`}
          >
            <Plus size={12} />
          </button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-lg p-1.5 space-y-2 transition-colors ${
          isOver
            ? "bg-[#20808D]/10 border border-[#20808D]/30"
            : "bg-[#111827]/30"
        }`}
      >
        <SortableContext
          items={issues.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {issues.length === 0 ? (
            <p className="text-[11px] text-[#4b5563] text-center pt-10">
              No issues
            </p>
          ) : (
            issues.map((issue) => (
              <KanbanCard key={issue.id} issue={issue} />
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
}: {
  issue: Issue;
  isOverlay?: boolean;
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
      className={`bg-[#111827] border border-[#374151] rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all group ${
        isDragging && !isOverlay ? "opacity-30" : ""
      } ${
        isOverlay
          ? "shadow-lg shadow-[#20808D]/10 ring-1 ring-[#20808D]/30"
          : "hover:border-[#4b5563] hover:bg-[#1a2132]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[12px] font-medium text-[#f9fafb] leading-snug group-hover:text-white line-clamp-2">
          {issue.title}
        </p>
        <PriorityIcon priority={issue.priority} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#6b7280] font-mono">
          {issue.identifier}
        </span>
        {issue.projectName && (
          <>
            <span className="text-[#374151]">·</span>
            <span className="text-[10px] text-[#6b7280] truncate">
              {issue.projectName}
            </span>
          </>
        )}
        <span className="ml-auto text-[10px] text-[#6b7280]">
          {timeAgo(issue.updatedAt)}
        </span>
      </div>
      {issue.assigneeName && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-4 h-4 rounded-full bg-[#20808D]/20 flex items-center justify-center text-[7px] font-bold text-[#20808D]">
            {issue.assigneeName.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] text-[#9ca3af]">
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
      <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
        {BOARD_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            issues={columnIssues[status] ?? []}
            onAddIssue={onAddIssue}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? <KanbanCard issue={activeIssue} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
