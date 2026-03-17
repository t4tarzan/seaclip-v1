import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox as InboxIcon, CheckSquare, CircleDot, GitPullRequest, Bell, Check, AlertTriangle, X } from "lucide-react";
import { useCompanyContext } from "../context/CompanyContext";
import { useApprovals } from "../api/approvals";
import { useIssues } from "../api/issues";
import { usePullRequests } from "../api/pull-requests";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { SkeletonCard } from "../components/ui/skeleton";
import { timeAgo, cn } from "../lib/utils";

type InboxTab = "all" | "approvals" | "issues" | "prs";

interface InboxItem {
  id: string;
  type: "approval" | "issue" | "mention" | "pr";
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  time: string;
  read: boolean;
}

export default function Inbox() {
  const { companyId } = useCompanyContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState<InboxTab>("all");
  const { data: approvals = [], isLoading: approvalsLoading } = useApprovals(companyId);
  const { data: issues = [], isLoading: issuesLoading } = useIssues(companyId, { status: "in_progress" });
  const { data: pendingPRs = [], isLoading: prsLoading } = usePullRequests(companyId, { reviewStatus: "pending" });

  const isLoading = approvalsLoading || issuesLoading || prsLoading;

  // Dismissed items stored in localStorage
  const [dismissed, setDismissed] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem("inbox.dismissed") ?? "[]")),
  );
  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("inbox.dismissed", JSON.stringify([...next]));
      return next;
    });
  };

  // Build inbox items from pending approvals, active issues, and PRs awaiting review
  const items: InboxItem[] = [
    ...approvals
      .filter((a) => a.status === "pending")
      .map((a) => ({
        id: `approval-${a.id}`,
        type: "approval" as const,
        title: a.title,
        description: a.requestedById ? `Requested by ${a.requestedById}` : "Pending review",
        icon: CheckSquare,
        route: `/approvals/${a.id}`,
        time: a.requestedAt,
        read: false,
      })),
    ...issues.slice(0, 10).map((issue) => ({
      id: `issue-${issue.id}`,
      type: "issue" as const,
      title: `${issue.identifier}: ${issue.title}`,
      description: `Status: ${issue.status} · Priority: ${issue.priority}`,
      icon: CircleDot,
      route: `/issues/${issue.id}`,
      time: issue.updatedAt,
      read: false,
    })),
    ...pendingPRs.map((pr) => ({
      id: `pr-${pr.id}`,
      type: "pr" as const,
      title: `PR: ${pr.title}`,
      description: `${pr.sourceBranch} → ${pr.targetBranch}`,
      icon: GitPullRequest,
      route: `/pull-requests`,
      time: pr.createdAt,
      read: false,
    })),
  ]
    .filter((item) => !dismissed.has(item.id))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const filtered = tab === "all"
    ? items
    : tab === "prs"
      ? items.filter((i) => i.type === "pr")
      : items.filter((i) => i.type === tab.replace(/s$/, ""));

  const tabs: { key: InboxTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: items.length },
    { key: "approvals", label: "Approvals", count: items.filter((i) => i.type === "approval").length },
    { key: "issues", label: "Issues", count: items.filter((i) => i.type === "issue").length },
    { key: "prs", label: "PRs", count: items.filter((i) => i.type === "pr").length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Inbox</h2>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
            {items.length} item{items.length !== 1 ? "s" : ""} needing your attention
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 0 }}
            className={cn(
              "text-[11px] font-medium transition-colors",
              tab === t.key
                ? "bg-[var(--primary)]/20 text-[var(--accent)] border border-[var(--primary)]/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border border-transparent"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span
                style={{ padding: "2px 6px", borderRadius: 0, minWidth: 16, textAlign: "center" }}
                className="bg-[var(--border)] text-[var(--text-secondary)] text-[9px]"
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Items */}
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 0, backgroundColor: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Check size={24} className="text-[var(--success)]" />
            </div>
            <p className="text-[13px] font-medium text-[var(--text-secondary)]">All caught up!</p>
            <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: 4 }}>
              No pending items in your inbox
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]/50">
            {filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.route)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textAlign: "left" }}
                  className="hover:bg-[var(--surface-raised)] transition-colors group/item"
                >
                  <div style={{ width: 32, height: 32, borderRadius: 0, backgroundColor: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={14} className="text-[var(--text-secondary)]" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{item.title}</p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">{item.description}</p>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]" style={{ flexShrink: 0 }}>{timeAgo(item.time)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(item.id); }}
                    style={{ padding: 4, flexShrink: 0, borderRadius: 4 }}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors opacity-0 group-hover/item:opacity-100"
                    title="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
