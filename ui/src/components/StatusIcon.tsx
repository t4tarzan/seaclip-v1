import type { IssueStatus } from "../lib/types";

const colors: Record<IssueStatus, string> = {
  backlog: "#6b7280",
  todo: "#eab308",
  in_progress: "#20808D",
  in_review: "#06b6d4",
  done: "#22c55e",
};

export function StatusIcon({ status }: { status: string }) {
  const color = colors[status as IssueStatus] ?? "#6b7280";
  return (
    <div
      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}
