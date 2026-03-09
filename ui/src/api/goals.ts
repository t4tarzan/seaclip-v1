import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Goal } from "../lib/types";

export function useGoals(companyId: string | undefined) {
  return useQuery({
    queryKey: ["goals", companyId],
    queryFn: async () => {
      const res = await api.get<{ data: Goal[]; count: number }>(
        `/companies/${companyId}/goals`
      );
      return res.data;
    },
    enabled: !!companyId,
  });
}

export function useGoal(companyId: string | undefined, goalId: string | undefined) {
  return useQuery({
    queryKey: ["goal", companyId, goalId],
    queryFn: () => api.get<Goal>(`/companies/${companyId}/goals/${goalId}`),
    enabled: !!companyId && !!goalId,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: Partial<Goal> }) =>
      api.post<Goal>(`/companies/${companyId}/goals`, data),
    onSuccess: (_, { companyId }) => {
      qc.invalidateQueries({ queryKey: ["goals", companyId] });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      goalId,
      data,
    }: {
      companyId: string;
      goalId: string;
      data: Partial<Goal>;
    }) => api.patch<Goal>(`/companies/${companyId}/goals/${goalId}`, data),
    onSuccess: (_, { companyId }) => {
      qc.invalidateQueries({ queryKey: ["goals", companyId] });
    },
  });
}
