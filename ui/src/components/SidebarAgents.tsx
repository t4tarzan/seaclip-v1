import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronRight, Plus, Bot } from "lucide-react";
import { useAgents } from "../api/agents";
import { useCompanyContext } from "../context/CompanyContext";
import { cn } from "../lib/utils";
import type { Agent, AgentStatus } from "../lib/types";

const STATUS_COLORS: Record<AgentStatus, string> = {
  running: "bg-[#22c55e]",
  idle: "bg-[#06b6d4]",
  error: "bg-[#ef4444]",
  offline: "bg-[#6b7280]",
  paused: "bg-[#eab308]",
};

interface SidebarAgentsProps {
  collapsed?: boolean;
  onNewAgent?: () => void;
}

export function SidebarAgents({ collapsed, onNewAgent }: SidebarAgentsProps) {
  const [open, setOpen] = useState(true);
  const { companyId } = useCompanyContext();
  const { data: agents = [] } = useAgents(companyId);

  // Filter out terminated/offline agents that aren't interesting
  const visibleAgents = agents.filter(
    (a: Agent) => a.status !== "offline",
  );

  if (collapsed) return null;

  return (
    <div className="group">
      <div className="flex items-center px-3 py-1.5">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 flex-1 min-w-0"
        >
          <ChevronRight
            size={10}
            className={cn(
              "text-[#6b7280]/60 transition-transform opacity-0 group-hover:opacity-100",
              open && "rotate-90",
            )}
          />
          <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-[#6b7280]/60">
            Agents
          </span>
        </button>
        {onNewAgent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewAgent();
            }}
            className="flex items-center justify-center h-4 w-4 rounded text-[#6b7280]/60 hover:text-[#f9fafb] hover:bg-[#1f2937] transition-colors"
            aria-label="New agent"
          >
            <Plus size={10} />
          </button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {visibleAgents.length === 0 && (
            <p className="px-3 py-1 text-[10px] text-[#6b7280]">No agents</p>
          )}
          {visibleAgents.map((agent: Agent) => {
            const statusColor = STATUS_COLORS[agent.status] ?? "bg-[#6b7280]";
            const isRunning = agent.status === "running";

            return (
              <NavLink
                key={agent.id}
                to={`/agents/${agent.id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors mx-1 rounded-md",
                    isActive
                      ? "bg-[#20808D]/15 text-[#f9fafb]"
                      : "text-[#9ca3af] hover:bg-[#1f2937] hover:text-[#f9fafb]",
                  )
                }
              >
                <div className="w-5 h-5 rounded-md bg-[#20808D]/15 border border-[#20808D]/25 flex items-center justify-center flex-shrink-0">
                  <Bot size={10} className="text-[#20808D]" />
                </div>
                <span className="flex-1 truncate text-[12px]">{agent.name}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className={cn("w-1.5 h-1.5 rounded-full relative", statusColor)}>
                    {isRunning && (
                      <span
                        className={cn(
                          "absolute inset-0 rounded-full animate-ping opacity-60",
                          statusColor,
                        )}
                      />
                    )}
                  </span>
                </span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
