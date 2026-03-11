import {
  AlertTriangle,
  ArrowUp,
  Minus,
  ArrowDown,
} from "lucide-react";
import type { IssuePriority } from "../lib/types";

const config: Record<IssuePriority, { icon: typeof AlertTriangle; color: string; label: string }> = {
  urgent: { icon: AlertTriangle, color: "var(--error)", label: "Urgent" },
  high: { icon: ArrowUp, color: "#f97316", label: "High" },
  medium: { icon: Minus, color: "var(--warning)", label: "Medium" },
  low: { icon: ArrowDown, color: "var(--text-muted)", label: "Low" },
};

export function PriorityIcon({ priority }: { priority: IssuePriority }) {
  const { icon: Icon, color, label } = config[priority] ?? config.medium;
  return <Icon size={14} color={color} aria-label={label} />;
}
