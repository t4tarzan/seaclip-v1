import type { IssueStatus } from "../lib/types";

const colors: Record<IssueStatus, string> = {
  backlog: "var(--text-muted)",
  todo: "var(--warning)",
  in_progress: "var(--primary)",
  in_review: "var(--accent)",
  done: "var(--success)",
};

export function StatusIcon({ status }: { status: string }) {
  const color = colors[status as IssueStatus] ?? "var(--text-muted)";
  return (
    <div
      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}
