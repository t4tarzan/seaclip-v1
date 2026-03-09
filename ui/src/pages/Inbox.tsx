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
        title: `Approval: ${a.type}`,
        description: `Requested by ${a.requesterName}`,
        icon: CheckSquare,
        route: `/approvals/${a.id}`,
        time: a.createdAt,
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
    <div className="p-6 flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-[#f9fafb]">Inbox</h2>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            {items.length} item{items.length !== 1 ? "s" : ""} needing your attention
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors flex items-center gap-1.5",
              tab === t.key
                ? "bg-[#20808D]/20 text-[#06b6d4] border border-[#20808D]/30"
                : "text-[#9ca3af] hover:text-[#f9fafb] hover:bg-[#1f2937] border border-transparent"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className="bg-[#374151] text-[#9ca3af] text-[9px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#374151] flex items-center justify-center mb-3">
              <Check size={24} className="text-[#22c55e]" />
            </div>
            <p className="text-[13px] font-medium text-[#9ca3af]">All caught up!</p>
            <p className="text-[11px] text-[#6b7280] mt-1">
              No pending items in your inbox
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#374151]/50">
            {filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.route)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#263244] transition-colors group/item"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#374151] flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-[#9ca3af]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#f9fafb] truncate">{item.title}</p>
                    <p className="text-[10px] text-[#6b7280] truncate">{item.description}</p>
                  </div>
                  <span className="text-[10px] text-[#6b7280] flex-shrink-0">{timeAgo(item.time)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(item.id); }}
                    className="p-1 rounded text-[#6b7280] hover:text-[#f9fafb] hover:bg-[#374151] transition-colors flex-shrink-0 opacity-0 group-hover/item:opacity-100"
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
