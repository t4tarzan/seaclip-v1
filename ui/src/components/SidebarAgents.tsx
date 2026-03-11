import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronRight, Plus, Bot } from "lucide-react";
import { useAgents } from "../api/agents";
import { useCompanyContext } from "../context/CompanyContext";
import { cn } from "../lib/utils";
import type { Agent, AgentStatus } from "../lib/types";

const STATUS_COLORS: Record<AgentStatus, string> = {
  running: "bg-[var(--success)]",
  idle: "bg-[var(--accent)]",
  error: "bg-[var(--error)]",
  offline: "bg-[var(--text-muted)]",
  paused: "bg-[var(--warning)]",
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
              "text-[var(--text-muted)]/60 transition-transform opacity-0 group-hover:opacity-100",
              open && "rotate-90",
            )}
          />
          <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-[var(--text-muted)]/60">
            Agents
          </span>
        </button>
        {onNewAgent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewAgent();
            }}
            className="flex items-center justify-center h-4 w-4 rounded text-[var(--text-muted)]/60 hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
            aria-label="New agent"
          >
            <Plus size={10} />
          </button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {visibleAgents.length === 0 && (
            <p className="px-3 py-1 text-[10px] text-[var(--text-muted)]">No agents</p>
          )}
          {visibleAgents.map((agent: Agent) => {
            const statusColor = STATUS_COLORS[agent.status] ?? "bg-[var(--text-muted)]";
            const isRunning = agent.status === "running";

            return (
              <NavLink
                key={agent.id}
                to={`/agents/${agent.id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors mx-1 rounded-md",
                    isActive
                      ? "bg-[var(--primary)]/15 text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]",
                  )
                }
              >
                <div className="w-5 h-5 rounded-md bg-[var(--primary)]/15 border border-[var(--primary)]/25 flex items-center justify-center flex-shrink-0">
                  <Bot size={10} className="text-[var(--primary)]" />
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
