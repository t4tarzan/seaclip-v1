import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { SpokeTask, SpokeTaskStatus } from "../lib/types";

export interface SpokeTaskFilters {
  status?: SpokeTaskStatus;
  deviceId?: string;
}

export function useSpokeTasks(companyId: string | undefined, filters?: SpokeTaskFilters) {
  return useQuery({
    queryKey: ["spoke-tasks-list", companyId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.deviceId) params.set("deviceId", filters.deviceId);
      const qs = params.toString();
      const res = await api.get<{ data: SpokeTask[] }>(
        `/companies/${companyId}/spoke-tasks${qs ? `?${qs}` : ""}`
      );
      return res.data;
    },
    enabled: !!companyId,
    refetchInterval: 10_000,
  });
}

export function useSpokeTask(companyId: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: ["spoke-tasks-list", companyId, taskId],
    queryFn: () => api.get<SpokeTask>(`/companies/${companyId}/spoke-tasks/${taskId}`),
    enabled: !!companyId && !!taskId,
    refetchInterval: 5_000,
  });
}

export function useCreateSpokeTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      data,
    }: {
      companyId: string;
      data: Partial<SpokeTask>;
    }) => api.post<SpokeTask>(`/companies/${companyId}/spoke-tasks`, data),
    onSuccess: (_data, { companyId }) => {
      void qc.invalidateQueries({ queryKey: ["spoke-tasks-list", companyId] });
    },
  });
}

export function useUpdateSpokeTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      taskId,
      status,
    }: {
      companyId: string;
      taskId: string;
      status: SpokeTaskStatus;
    }) => api.patch<SpokeTask>(`/companies/${companyId}/spoke-tasks/${taskId}/status`, { status }),
    onSuccess: (_data, { companyId, taskId }) => {
      void qc.invalidateQueries({ queryKey: ["spoke-tasks-list", companyId] });
      void qc.invalidateQueries({ queryKey: ["spoke-tasks-list", companyId, taskId] });
    },
  });
}
