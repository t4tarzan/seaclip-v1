import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Approval } from "../lib/types";

export function useApprovals(companyId: string | undefined) {
  return useQuery({
    queryKey: ["approvals", companyId],
    queryFn: async () => {
      const res = await api.get<{ data: Approval[] }>(`/companies/${companyId}/approvals`);
      return res.data;
    },
    enabled: !!companyId,
    refetchInterval: 15_000,
  });
}

export function usePendingApprovals(companyId: string | undefined) {
  return useQuery({
    queryKey: ["approvals", companyId, "pending"],
    queryFn: async () => {
      const res = await api.get<{ data: Approval[] }>(`/companies/${companyId}/approvals?status=pending`);
      return res.data;
    },
    enabled: !!companyId,
    refetchInterval: 10_000,
  });
}

export function useResolveApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      id,
      decision,
      reason,
    }: {
      companyId: string;
      id: string;
      decision: "approved" | "rejected";
      reason?: string;
    }) =>
      api.patch<Approval>(`/companies/${companyId}/approvals/${id}`, {
        status: decision,
        reason,
      }),
    onSuccess: (_data, { companyId }) => {
      void qc.invalidateQueries({ queryKey: ["approvals", companyId] });
    },
  });
}
