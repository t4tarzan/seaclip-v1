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
      <div className="p-6 flex flex-col items-center justify-center gap-3 py-20">
        <CheckSquare size={32} className="text-[#374151]" />
        <p className="text-[13px] text-[#9ca3af]">Approval not found</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/approvals")}>
          Back to Approvals
        </Button>
      </div>
    );
  }

  const isPending = approval.status === "pending";

  const handleResolve = (status: "approved" | "rejected") => {
    if (!companyId) return;
    resolveApproval.mutate(
      { companyId, id: approval.id, decision: status, reason: "" },
      { onSuccess: () => navigate("/approvals") }
    );
  };

  return (
    <div className="p-6 flex flex-col gap-5 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate("/approvals")} />
        <div>
          <h2 className="text-[18px] font-bold text-[#f9fafb]">Approval Request</h2>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            {approval.type} · requested {timeAgo(approval.createdAt)}
          </p>
        </div>
        <div className="ml-auto">
          <StatusBadge type="approval" value={approval.status} />
        </div>
      </div>

      {/* Details card */}
      <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">Type</label>
            <p className="text-[13px] text-[#f9fafb] mt-0.5">{approval.type}</p>
          </div>
          <div>
            <label className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">Requester</label>
            <p className="text-[13px] text-[#f9fafb] mt-0.5">{approval.requesterName}</p>
          </div>
          <div>
            <label className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">Status</label>
            <div className="mt-1">
              <StatusBadge type="approval" value={approval.status} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">Created</label>
            <p className="text-[13px] text-[#9ca3af] mt-0.5">
              {new Date(approval.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {approval.resolvedBy && (
          <div className="border-t border-[#374151] pt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">Resolved By</label>
              <p className="text-[13px] text-[#f9fafb] mt-0.5">{approval.resolvedBy}</p>
            </div>
            {approval.resolvedAt && (
              <div>
                <label className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">Resolved At</label>
                <p className="text-[13px] text-[#9ca3af] mt-0.5">
                  {new Date(approval.resolvedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}

        {approval.reason && (
          <div className="border-t border-[#374151] pt-4">
            <label className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">Reason</label>
            <p className="text-[13px] text-[#d1d5db] mt-1">{approval.reason}</p>
          </div>
        )}

        {/* Payload */}
        {Object.keys(approval.payload).length > 0 && (
          <div className="border-t border-[#374151] pt-4">
            <label className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">Payload</label>
            <pre className="mt-2 bg-[#111827] rounded-lg p-3 text-[11px] text-[#9ca3af] font-mono overflow-x-auto">
              {JSON.stringify(approval.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-3">
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
