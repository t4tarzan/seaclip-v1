import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import { useProjects } from "../api/projects";
import { useCompanyContext } from "../context/CompanyContext";
import { cn } from "../lib/utils";
import type { Project } from "../lib/types";

interface SidebarProjectsProps {
  collapsed?: boolean;
}

export function SidebarProjects({ collapsed }: SidebarProjectsProps) {
  const [open, setOpen] = useState(true);
  const { companyId } = useCompanyContext();
  const { data: projects = [] } = useProjects(companyId);

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
            Projects
          </span>
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {projects.length === 0 && (
            <p className="px-3 py-1 text-[10px] text-[var(--text-muted)]">No projects</p>
          )}
          {projects.map((project: Project) => (
            <NavLink
              key={project.id}
              to={`/issues?projectId=${project.id}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-3 py-1.5 text-[12px] font-medium transition-colors mx-1 rounded-md",
                  isActive
                    ? "bg-[var(--primary)]/15 text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]",
                )
              }
            >
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: project.color || "#6366f1" }}
              />
              <span className="flex-1 truncate">{project.name}</span>
              {project.issueCount > 0 && (
                <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{project.issueCount}</span>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
