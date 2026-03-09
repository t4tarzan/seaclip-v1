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
    <div className="p-6 flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-[#f9fafb]">Pull Requests</h2>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
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
      <div className="flex items-center gap-1.5">
        {REVIEW_TABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            className={cn(
              "px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors",
              tab === s.key
                ? "bg-[#20808D]/20 text-[#06b6d4] border border-[#20808D]/30"
                : "text-[#9ca3af] hover:text-[#f9fafb] hover:bg-[#1f2937] border border-transparent"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#1f2937] border border-[#374151] rounded-xl overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : prs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#374151] flex items-center justify-center mb-3">
              <GitPullRequest size={24} className="text-[#6b7280]" />
            </div>
            <p className="text-[13px] font-medium text-[#9ca3af]">
              {tab !== "all" ? "No PRs match this filter" : "No pull requests yet"}
            </p>
            <p className="text-[11px] text-[#6b7280] mt-1">
              {tab !== "all"
                ? "Try a different review filter"
                : "Spoke devices will submit PRs as they complete tasks"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                  <tr key={pr.id} className="hover:bg-[#263244] transition-colors">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#8b5cf6]/15 border border-[#8b5cf6]/25 flex items-center justify-center text-[#8b5cf6] flex-shrink-0">
                          <GitPullRequest size={12} />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-[#f9fafb]">{pr.title}</p>
                          {pr.description && (
                            <p className="text-[10px] text-[#6b7280] truncate max-w-[220px]">
                              {pr.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-[#f9fafb] font-mono">
                          {pr.sourceBranch}
                        </span>
                        <span className="text-[10px] text-[#6b7280]">
                          into {pr.targetBranch}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="text-[11px] bg-[#374151] text-[#9ca3af] px-2 py-0.5 rounded font-medium">
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
                        <div className="flex items-center gap-1">
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
                        <span className="text-[10px] text-[#6b7280]">
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
              Merge <strong className="text-[#f9fafb]">{mergeTarget?.sourceBranch}</strong> into{" "}
              <strong className="text-[#f9fafb]">{mergeTarget?.targetBranch}</strong>?
            </DialogDescription>
          </DialogHeader>
          <p className="text-[12px] text-[#9ca3af]">
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
