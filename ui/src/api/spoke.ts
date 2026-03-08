import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Issue } from "../lib/types";

export interface SpokeStatus {
  deviceId: string;
  name: string;
  status: "online" | "offline" | "degraded" | "unknown";
  deviceType: string;
  location: string | null;
  lastSeenAt: string | null;
  capabilities: string[];
  agents: {
    total: number;
    active: number;
    paused: number;
    error: number;
    idle: number;
  };
}

export interface SpokeJob {
  agentId: string;
  agentName: string;
  status: string;
  heartbeatCron: string | null;
  lastHeartbeatAt: string | null;
  lastRunAt: string | null;
}

export function useSpokeStatus(deviceId: string | undefined) {
  return useQuery({
    queryKey: ["spoke-status", deviceId],
    queryFn: () => api.get<SpokeStatus>(`/spoke/${deviceId}/status`),
    enabled: !!deviceId,
    refetchInterval: 5_000,
  });
}

export function useSpokeTasks(deviceId: string | undefined) {
  return useQuery({
    queryKey: ["spoke-tasks", deviceId],
    queryFn: () => api.get<{ data: Issue[]; count: number }>(`/spoke/${deviceId}/tasks`),
    enabled: !!deviceId,
    refetchInterval: 10_000,
  });
}

export function useSpokeJobs(deviceId: string | undefined) {
  return useQuery({
    queryKey: ["spoke-jobs", deviceId],
    queryFn: () => api.get<{ data: SpokeJob[]; count: number }>(`/spoke/${deviceId}/jobs`),
    enabled: !!deviceId,
    refetchInterval: 10_000,
  });
}

export function useSpokeFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      deviceId,
      issueId,
      comment,
      status,
    }: {
      deviceId: string;
      issueId: string;
      comment: string;
      status?: string;
    }) =>
      api.post<{ accepted: boolean; issueId: string }>(`/spoke/${deviceId}/feedback`, {
        issueId,
        comment,
        status,
      }),
    onSuccess: (_data, { deviceId }) => {
      void qc.invalidateQueries({ queryKey: ["spoke-tasks", deviceId] });
    },
  });
}
