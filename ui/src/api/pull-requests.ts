import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { PullRequest, PRReviewStatus } from "../lib/types";

export interface PRFilters {
  reviewStatus?: PRReviewStatus;
  status?: string;
}

export function usePullRequests(companyId: string | undefined, filters?: PRFilters) {
  return useQuery({
    queryKey: ["pull-requests", companyId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.reviewStatus) params.set("reviewStatus", filters.reviewStatus);
      if (filters?.status) params.set("status", filters.status);
      const qs = params.toString();
      const res = await api.get<{ data: PullRequest[] }>(
        `/companies/${companyId}/pull-requests${qs ? `?${qs}` : ""}`
      );
      return res.data;
    },
    enabled: !!companyId,
    refetchInterval: 10_000,
  });
}

export function usePullRequest(companyId: string | undefined, prId: string | undefined) {
  return useQuery({
    queryKey: ["pull-requests", companyId, prId],
    queryFn: () => api.get<PullRequest>(`/companies/${companyId}/pull-requests/${prId}`),
    enabled: !!companyId && !!prId,
    refetchInterval: 5_000,
  });
}

export function useReviewPR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      prId,
      reviewStatus,
    }: {
      companyId: string;
      prId: string;
      reviewStatus: "approved" | "rejected";
    }) =>
      api.patch<PullRequest>(`/companies/${companyId}/pull-requests/${prId}`, {
        reviewStatus,
      }),
    onSuccess: (_data, { companyId, prId }) => {
      void qc.invalidateQueries({ queryKey: ["pull-requests", companyId] });
      void qc.invalidateQueries({ queryKey: ["pull-requests", companyId, prId] });
    },
  });
}

export function useMergePR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      prId,
    }: {
      companyId: string;
      prId: string;
    }) => api.post<PullRequest>(`/companies/${companyId}/pull-requests/${prId}/merge`, {}),
    onSuccess: (_data, { companyId, prId }) => {
      void qc.invalidateQueries({ queryKey: ["pull-requests", companyId] });
      void qc.invalidateQueries({ queryKey: ["pull-requests", companyId, prId] });
      void qc.invalidateQueries({ queryKey: ["spoke-tasks-list", companyId] });
    },
  });
}
