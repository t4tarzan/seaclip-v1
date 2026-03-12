import React, { useState } from "react";
import { useCompanyContext } from "../context/CompanyContext";
import { useApprovals, useResolveApproval } from "../api/approvals";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { SkeletonCard } from "../components/ui/skeleton";
import { timeAgo, truncate } from "../lib/utils";
import { cn } from "../lib/utils";
import type { Approval } from "../lib/types";
import { CheckSquare, Clock, Check, X, AlertTriangle } from "lucide-react";

interface ApprovalCardProps {
  approval: Approval;
  onApprove?: () => void;
  onReject?: () => void;
  isResolving?: boolean;
}

function ApprovalCard({ approval, onApprove, onReject, isResolving }: ApprovalCardProps) {
  const isPending = approval.status === "pending";

  return (
    <div
      className={cn(
        isPending ? "border-[var(--border)]" : "border-[var(--border)]/50 opacity-70"
      )}
      style={{ backgroundColor: "var(--surface)", borderWidth: 1, borderStyle: "solid", borderRadius: "var(--radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            className={cn(
              isPending
                ? "bg-[var(--warning)]/15 border border-[var(--warning)]/25"
                : approval.status === "approved"
                ? "bg-[var(--success)]/15 border border-[var(--success)]/25"
                : "bg-[var(--error)]/15 border border-[var(--error)]/25"
            )}
            style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {isPending ? (
              <Clock size={13} className="text-[var(--warning)]" />
            ) : approval.status === "approved" ? (
              <Check size={13} className="text-[var(--success)]" />
            ) : (
              <X size={13} className="text-[var(--error)]" />
            )}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{approval.title}</p>
            <p className="text-[10px] text-[var(--text-muted)]">
              {approval.requestedById && (
                <>by <span className="text-[var(--text-secondary)]">{approval.requestedById}</span>{" · "}</>
              )}
              {timeAgo(approval.requestedAt)}
            </p>
          </div>
        </div>
        <StatusBadge type="approval" value={approval.status} />
      </div>

      {/* Description + metadata */}
      {approval.description && (
        <p className="text-[12px] text-[var(--text-secondary)]">{approval.description}</p>
      )}
      {approval.metadata && Object.keys(approval.metadata).length > 0 && (
        <div style={{ backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
          <p className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider" style={{ marginBottom: 6 }}>
            Details
          </p>
          <pre className="text-[11px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap" style={{ overflowX: "auto" }}>
            {truncate(JSON.stringify(approval.metadata, null, 2), 400)}
          </pre>
        </div>
      )}

      {/* Resolved info */}
      {!isPending && (approval.resolvedById || approval.resolvedAt) && (
        <div className="text-[11px] text-[var(--text-muted)]">
          {approval.decision === "approved" ? "Approved" : "Rejected"}
          {approval.resolvedById && (
            <> by <span className="text-[var(--text-secondary)]">{approval.resolvedById}</span></>
          )}
          {approval.resolvedAt && ` · ${timeAgo(approval.resolvedAt)}`}
          {approval.reason && (
            <span className="text-[var(--text-secondary)]" style={{ display: "block", marginTop: 2 }}>Reason: {approval.reason}</span>
          )}
        </div>
      )}

      {/* Actions */}
      {isPending && onApprove && onReject && (
        <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 border border-[var(--error)]/25 text-[var(--error)] hover:bg-[var(--error)]/10"
            icon={<X size={11} />}
            onClick={onReject}
            loading={isResolving}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            icon={<Check size={11} />}
            onClick={onApprove}
            loading={isResolving}
          >
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Approvals() {
  const { companyId } = useCompanyContext();
  const { data: approvals = [], isLoading } = useApprovals(companyId);
  const resolveApproval = useResolveApproval();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const pending = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending");

  const handleResolve = async (id: string, decision: "approved" | "rejected") => {
    if (!companyId) return;
    setResolvingId(id);
    try {
      await resolveApproval.mutateAsync({ companyId, id, decision });
    } finally {
      setResolvingId(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Approvals</h2>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
            {pending.length} pending · {resolved.length} resolved
          </p>
        </div>
        {pending.length > 0 && (
          <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/25" style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "6px 12px" }}>
            <AlertTriangle size={12} className="text-[var(--warning)]" />
            <span className="text-[11px] font-semibold text-[var(--warning)]">
              {pending.length} need{pending.length === 1 ? "s" : ""} review
            </span>
          </div>
        )}
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {pending.length > 0 && (
              <span className="ml-1.5 bg-[var(--warning)]/20 text-[var(--warning)] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pending.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", textAlign: "center", gap: 12 }}>
              <div className="bg-[var(--success)]/10 border border-[var(--success)]/25" style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckSquare size={22} className="text-[var(--success)]" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[var(--text-secondary)]">All caught up!</p>
                <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
                  No pending approvals right now.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
              {pending.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  isResolving={resolvingId === approval.id}
                  onApprove={() => handleResolve(approval.id, "approved")}
                  onReject={() => handleResolve(approval.id, "rejected")}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {resolved.length === 0 ? (
            <div className="text-[12px] text-[var(--text-muted)]" style={{ textAlign: "center", padding: "48px 0" }}>
              No resolved approvals yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
              {resolved.map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
