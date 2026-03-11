import React, { useState } from "react";
import { GitPullRequest, RefreshCw, Check, X, GitMerge } from "lucide-react";
import { usePullRequests, useReviewPR, useMergePR } from "../api/pull-requests";
import { useCompanyContext } from "../context/CompanyContext";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { SkeletonTable } from "../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { timeAgo, cn } from "../lib/utils";
import type { PRReviewStatus, PullRequest } from "../lib/types";
import { useQueryClient } from "@tanstack/react-query";

const REVIEW_TABS = [
  { key: "all" as const, label: "All" },
  { key: "pending" as const, label: "Pending Review" },
  { key: "approved" as const, label: "Approved" },
  { key: "rejected" as const, label: "Rejected" },
] as const;

type TabKey = (typeof REVIEW_TABS)[number]["key"];

export default function PullRequests() {
  const { companyId } = useCompanyContext();
  const [tab, setTab] = useState<TabKey>("pending");
  const filters = tab === "all" ? undefined : { reviewStatus: tab as PRReviewStatus };
  const { data: prs = [], isLoading, isFetching } = usePullRequests(companyId, filters);
  const qc = useQueryClient();
  const reviewPR = useReviewPR();
  const mergePR = useMergePR();
  const [mergeTarget, setMergeTarget] = useState<PullRequest | null>(null);

  const handleReview = (prId: string, action: "approved" | "rejected") => {
    if (!companyId) return;
    reviewPR.mutate({ companyId, prId, action, reviewedBy: "dashboard-user" });
  };

  const handleMerge = () => {
    if (!companyId || !mergeTarget) return;
    mergePR.mutate(
      { companyId, prId: mergeTarget.id },
      { onSuccess: () => setMergeTarget(null) }
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Pull Requests</h2>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
            {prs.length} PR{prs.length !== 1 ? "s" : ""} — review and merge spoke submissions
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />}
          onClick={() => qc.invalidateQueries({ queryKey: ["pull-requests", companyId] })}
        >
          Refresh
        </Button>
      </div>

      {/* Review Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {REVIEW_TABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            className={cn(
              "px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors",
              tab === s.key
                ? "bg-[var(--primary)]/20 text-[var(--accent)] border border-[var(--primary)]/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border border-transparent"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {isLoading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : prs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0" }} className="text-center">
            <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <GitPullRequest size={24} className="text-[var(--text-muted)]" />
            </div>
            <p className="text-[13px] font-medium text-[var(--text-secondary)]">
              {tab !== "all" ? "No PRs match this filter" : "No pull requests yet"}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: 4 }}>
              {tab !== "all"
                ? "Try a different review filter"
                : "Spoke devices will submit PRs as they complete tasks"}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Branch</th>
                  <th>Device</th>
                  <th>Status</th>
                  <th>Review</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {prs.map((pr) => (
                  <tr key={pr.id} className="hover:bg-[var(--surface-raised)] transition-colors">
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} className="bg-[#8b5cf6]/15 border border-[#8b5cf6]/25 text-[#8b5cf6]">
                          <GitPullRequest size={12} />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{pr.title}</p>
                          {pr.description && (
                            <p className="text-[10px] text-[var(--text-muted)] truncate" style={{ maxWidth: 220 }}>
                              {pr.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span className="text-[11px] text-[var(--text-primary)] font-mono">
                          {pr.sourceBranch}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          into {pr.targetBranch}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="text-[11px] bg-[var(--border)] text-[var(--text-secondary)] rounded font-medium" style={{ padding: "2px 8px" }}>
                        {pr.deviceId.slice(0, 8)}...
                      </span>
                    </td>
                    <td>
                      <StatusBadge type="pr" value={pr.status} />
                    </td>
                    <td>
                      <StatusBadge type="pr-review" value={pr.reviewStatus} />
                    </td>
                    <td>
                      {pr.status === "open" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {pr.reviewStatus !== "approved" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Check size={12} />}
                              onClick={() => handleReview(pr.id, "approved")}
                              disabled={reviewPR.isPending}
                            >
                              Approve
                            </Button>
                          )}
                          {pr.reviewStatus !== "rejected" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<X size={12} />}
                              onClick={() => handleReview(pr.id, "rejected")}
                              disabled={reviewPR.isPending}
                            >
                              Reject
                            </Button>
                          )}
                          {pr.reviewStatus === "approved" && (
                            <Button
                              variant="primary"
                              size="sm"
                              icon={<GitMerge size={12} />}
                              onClick={() => setMergeTarget(pr)}
                            >
                              Merge
                            </Button>
                          )}
                        </div>
                      )}
                      {pr.status === "merged" && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          Merged {pr.mergedAt ? timeAgo(pr.mergedAt) : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Merge Confirmation Dialog */}
      <Dialog open={!!mergeTarget} onOpenChange={(open) => !open && setMergeTarget(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Confirm Merge</DialogTitle>
            <DialogDescription>
              Merge <strong className="text-[var(--text-primary)]">{mergeTarget?.sourceBranch}</strong> into{" "}
              <strong className="text-[var(--text-primary)]">{mergeTarget?.targetBranch}</strong>?
            </DialogDescription>
          </DialogHeader>
          <p className="text-[12px] text-[var(--text-secondary)]">
            This will merge the changes from the spoke device into the target branch. This action
            cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setMergeTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<GitMerge size={12} />}
              onClick={handleMerge}
              loading={mergePR.isPending}
            >
              Merge PR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
