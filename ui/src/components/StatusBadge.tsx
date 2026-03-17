import React from "react";
import { Badge } from "./ui/badge";
import type {
  AgentStatus,
  IssueStatus,
  IssuePriority,
  DeviceStatus,
  ApprovalStatus,
  SpokeTaskStatus,
  PRStatus,
  PRReviewStatus,
} from "../lib/types";

interface StatusBadgeProps {
  type: "agent" | "issue" | "priority" | "device" | "approval" | "spoke-task" | "pr" | "pr-review";
  value: AgentStatus | IssueStatus | IssuePriority | DeviceStatus | ApprovalStatus | SpokeTaskStatus | PRStatus | PRReviewStatus;
}

const agentStatusConfig: Record<
  AgentStatus,
  { label: string; variant: "success" | "primary" | "error" | "muted" | "warning" }
> = {
  idle: { label: "Idle", variant: "muted" },
  active: { label: "Running", variant: "success" },
  running: { label: "Running", variant: "success" },
  error: { label: "Error", variant: "error" },
  offline: { label: "Offline", variant: "muted" },
  paused: { label: "Paused", variant: "warning" },
};

const issueStatusConfig: Record<
  IssueStatus,
  { label: string; variant: "muted" | "warning" | "primary" | "info" | "success" }
> = {
  backlog: { label: "Backlog", variant: "muted" },
  todo: { label: "Todo", variant: "warning" },
  in_progress: { label: "In Progress", variant: "primary" },
  in_review: { label: "In Review", variant: "info" },
  done: { label: "Done", variant: "success" },
};

const priorityConfig: Record<
  IssuePriority,
  { label: string; variant: "error" | "warning" | "primary" | "muted" }
> = {
  urgent: { label: "Urgent", variant: "error" },
  high: { label: "High", variant: "warning" },
  medium: { label: "Medium", variant: "primary" },
  low: { label: "Low", variant: "muted" },
};

const deviceStatusConfig: Record<
  DeviceStatus,
  { label: string; variant: "success" | "error" | "warning" }
> = {
  online: { label: "Online", variant: "success" },
  offline: { label: "Offline", variant: "error" },
  degraded: { label: "Degraded", variant: "warning" },
};

const approvalStatusConfig: Record<
  ApprovalStatus,
  { label: string; variant: "warning" | "success" | "error" }
> = {
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "error" },
};

const spokeTaskStatusConfig: Record<
  SpokeTaskStatus,
  { label: string; variant: "muted" | "warning" | "primary" | "info" | "success" }
> = {
  pending: { label: "Pending", variant: "muted" },
  assigned: { label: "Assigned", variant: "warning" },
  in_progress: { label: "In Progress", variant: "primary" },
  pr_raised: { label: "PR Raised", variant: "info" },
  merged: { label: "Merged", variant: "success" },
  done: { label: "Done", variant: "success" },
};

const prStatusConfig: Record<
  PRStatus,
  { label: string; variant: "primary" | "success" | "muted" }
> = {
  open: { label: "Open", variant: "primary" },
  merged: { label: "Merged", variant: "success" },
  closed: { label: "Closed", variant: "muted" },
};

const prReviewStatusConfig: Record<
  PRReviewStatus,
  { label: string; variant: "warning" | "success" | "error" }
> = {
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "error" },
};

export function StatusBadge({ type, value }: StatusBadgeProps) {
  let config: { label: string; variant: string } | undefined;

  if (type === "agent") config = agentStatusConfig[value as AgentStatus];
  else if (type === "issue") config = issueStatusConfig[value as IssueStatus];
  else if (type === "priority") config = priorityConfig[value as IssuePriority];
  else if (type === "device") config = deviceStatusConfig[value as DeviceStatus];
  else if (type === "approval") config = approvalStatusConfig[value as ApprovalStatus];
  else if (type === "spoke-task") config = spokeTaskStatusConfig[value as SpokeTaskStatus];
  else if (type === "pr") config = prStatusConfig[value as PRStatus];
  else if (type === "pr-review") config = prReviewStatusConfig[value as PRReviewStatus];

  if (!config) return null;

  return (
    <Badge
      variant={config.variant as Parameters<typeof Badge>[0]["variant"]}
      dot
    >
      {config.label}
    </Badge>
  );
}
