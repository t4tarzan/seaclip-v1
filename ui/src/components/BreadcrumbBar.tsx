import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  agents: "Agents",
  issues: "Issues",
  goals: "Goals",
  "spoke-tasks": "Spoke Tasks",
  "pull-requests": "Pull Requests",
  "edge-mesh": "Edge Mesh",
  costs: "Costs",
  approvals: "Approvals",
  activity: "Activity",
  settings: "Settings",
};

export function BreadcrumbBar() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs: { label: string; path: string }[] = [];
  let currentPath = "";

  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = ROUTE_LABELS[segment];
    if (label) {
      crumbs.push({ label, path: currentPath });
    } else if (crumbs.length > 0) {
      // UUID or dynamic segment — append as "Detail"
      crumbs.push({ label: "Detail", path: currentPath });
    }
  }

  if (crumbs.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] border-b border-[var(--border)]/50 bg-[var(--bg-alt)]">
      <Link to="/" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
        <Home size={11} />
      </Link>
      {crumbs.map((crumb, i) => (
        <React.Fragment key={crumb.path}>
          <ChevronRight size={10} className="text-[var(--border)]" />
          {i === crumbs.length - 1 ? (
            <span className="text-[var(--text-secondary)] font-medium">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
