import React from "react";
import { cn, timeAgo } from "../lib/utils";
import type { ActivityEvent } from "../lib/types";
import { Bot, User, Cpu, Zap, AlertCircle, CheckCircle, XCircle } from "lucide-react";

interface ActivityRowProps {
  event: ActivityEvent;
  compact?: boolean;
}

const actorIcons: Record<ActivityEvent["actorType"], React.ElementType> = {
  agent: Bot,
  user: User,
  system: Cpu,
};

const actionColors: Record<string, string> = {
  created: "text-[#22c55e]",
  updated: "text-[#06b6d4]",
  deleted: "text-[#ef4444]",
  started: "text-[#20808D]",
  completed: "text-[#22c55e]",
  failed: "text-[#ef4444]",
  approved: "text-[#22c55e]",
  rejected: "text-[#ef4444]",
  invoked: "text-[#eab308]",
  heartbeat: "text-[#6b7280]",
  registered: "text-[#20808D]",
};

function getActionColor(action: string): string {
  const key = Object.keys(actionColors).find((k) => action.toLowerCase().includes(k));
  return key ? actionColors[key] : "text-[#9ca3af]";
}

function getActionIcon(action: string): React.ElementType {
  if (action.includes("fail") || action.includes("error")) return AlertCircle;
  if (action.includes("complet") || action.includes("approv")) return CheckCircle;
  if (action.includes("reject") || action.includes("delet")) return XCircle;
  return Zap;
}

export function ActivityRow({ event, compact = false }: ActivityRowProps) {
  // Normalize server fields to UI fields (server sends eventType/summary/occurredAt)
  const raw = event as any;
  const action = event.action ?? raw.eventType ?? "";
  const actorName = event.actorName ?? raw.actorId?.slice(0, 8) ?? "system";
  const entityName = event.entityName ?? raw.summary ?? "";
  const entityType = event.entityType ?? raw.entityType ?? "";
  const createdAt = event.createdAt ?? raw.occurredAt ?? new Date().toISOString();
  const detail = event.detail ?? raw.summary;

  const ActorIcon = actorIcons[event.actorType] ?? User;
  const ActionIcon = getActionIcon(action);
  const actionColor = getActionColor(action);

  if (compact) {
    return (
      <div className="flex items-start gap-2.5 py-2">
        <div className="w-6 h-6 rounded-full bg-[#374151] flex items-center justify-center flex-shrink-0 mt-0.5">
          <ActorIcon size={11} className="text-[#9ca3af]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[#d1d5db] leading-relaxed">
            <span className="font-medium text-[#f9fafb]">{actorName}</span>{" "}
            <span className={cn("font-medium", actionColor)}>{action}</span>{" "}
            <span className="text-[#9ca3af]">{entityType}</span>{" "}
            <span className="font-medium text-[#f9fafb] truncate">{entityName}</span>
          </p>
          {detail && (
            <p className="text-[10px] text-[#6b7280] truncate mt-0.5">{detail}</p>
          )}
        </div>
        <span className="text-[10px] text-[#6b7280] flex-shrink-0 mt-0.5">
          {timeAgo(createdAt)}
        </span>
      </div>
    );
  }

  return (
    <tr className="group hover:bg-[#1a2132] transition-colors">
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-[11px] text-[#9ca3af] font-mono">
          {new Date(createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
        <br />
        <span className="text-[10px] text-[#6b7280]">
          {new Date(createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#374151] flex items-center justify-center flex-shrink-0">
            <ActorIcon size={11} className="text-[#9ca3af]" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#f9fafb]">{actorName}</p>
            <p className="text-[10px] text-[#6b7280] capitalize">{event.actorType}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <ActionIcon size={11} className={actionColor} />
          <span className={cn("text-[12px] font-medium capitalize", actionColor)}>
            {action}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <p className="text-[12px] text-[#f9fafb] capitalize">{entityType}</p>
        <p className="text-[10px] text-[#9ca3af]">{entityName}</p>
      </td>
      <td className="px-3 py-2.5 max-w-[280px]">
        <p className="text-[11px] text-[#6b7280] truncate">{detail ?? "—"}</p>
      </td>
    </tr>
  );
}
