import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckSquare, Check, X, Clock } from "lucide-react";
import { useCompanyContext } from "../context/CompanyContext";
import { useApprovals, useResolveApproval } from "../api/approvals";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { timeAgo } from "../lib/utils";

export default function ApprovalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { companyId } = useCompanyContext();
  const { data: approvals = [] } = useApprovals(companyId);
  const approval = approvals.find((a) => a.id === id);
  const resolveApproval = useResolveApproval();

  if (!approval) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "80px 0" }}>
        <CheckSquare size={32} className="text-[var(--border)]" />
        <p className="text-[13px] text-[var(--text-secondary)]">Approval not found</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/approvals")}>
          Back to Approvals
        </Button>
      </div>
    );
  }

  const isPending = approval.status === "pending";

  const handleResolve = (decision: "approved" | "rejected") => {
    if (!companyId) return;
    resolveApproval.mutate(
      { companyId, id: approval.id, decision, reason: "" },
      { onSuccess: () => navigate("/approvals") }
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 768 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate("/approvals")} />
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{approval.title}</h2>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
            {approval.requestedById && `by ${approval.requestedById} · `}
            requested {timeAgo(approval.requestedAt)}
          </p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <StatusBadge type="approval" value={approval.status} />
        </div>
      </div>

      {/* Details card */}
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Description */}
        {approval.description && (
          <p className="text-[13px] text-[var(--text-secondary)]">{approval.description}</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Title</label>
            <p className="text-[13px] text-[var(--text-primary)]" style={{ marginTop: 2 }}>{approval.title}</p>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Requester</label>
            <p className="text-[13px] text-[var(--text-primary)]" style={{ marginTop: 2 }}>{approval.requestedById ?? "—"}</p>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Status</label>
            <div style={{ marginTop: 4 }}>
              <StatusBadge type="approval" value={approval.status} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Created</label>
            <p className="text-[13px] text-[var(--text-secondary)]" style={{ marginTop: 2 }}>
              {new Date(approval.requestedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {approval.resolvedById && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Resolved By</label>
              <p className="text-[13px] text-[var(--text-primary)]" style={{ marginTop: 2 }}>{approval.resolvedById}</p>
            </div>
            {approval.resolvedAt && (
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Resolved At</label>
                <p className="text-[13px] text-[var(--text-secondary)]" style={{ marginTop: 2 }}>
                  {new Date(approval.resolvedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}

        {approval.reason && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Reason</label>
            <p className="text-[13px] text-[var(--text-secondary)]" style={{ marginTop: 4 }}>{approval.reason}</p>
          </div>
        )}

        {/* Metadata */}
        {approval.metadata && Object.keys(approval.metadata).length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Details</label>
            <pre
              style={{
                marginTop: 8,
                backgroundColor: "var(--bg-alt)",
                borderRadius: 0,
                padding: 12,
                overflowX: "auto",
              }}
              className="text-[11px] text-[var(--text-secondary)] font-mono"
            >
              {JSON.stringify(approval.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Actions */}
      {isPending && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button
            variant="primary"
            size="sm"
            icon={<Check size={14} />}
            onClick={() => handleResolve("approved")}
            loading={resolveApproval.isPending}
          >
            Approve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<X size={14} />}
            onClick={() => handleResolve("rejected")}
            loading={resolveApproval.isPending}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
