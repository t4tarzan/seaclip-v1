import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Agent, HeartbeatRun } from "../lib/types";

export function useAgents(companyId: string | undefined) {
  return useQuery({
    queryKey: ["agents", companyId],
    queryFn: async () => {
      const res = await api.get<{ data: Agent[] }>(`/companies/${companyId}/agents`);
      return res.data;
    },
    enabled: !!companyId,
    refetchInterval: 5_000,
  });
}

export function useAgent(companyId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ["agents", companyId, id],
    queryFn: () => api.get<Agent>(`/companies/${companyId}/agents/${id}`),
    enabled: !!companyId && !!id,
    refetchInterval: 5_000,
  });
}

export function useAgentRuns(companyId: string | undefined, agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-runs", companyId, agentId],
    queryFn: async () => {
      const res = await api.get<{ data: HeartbeatRun[] }>(`/companies/${companyId}/agents/${agentId}/runs`);
      return res.data;
    },
    enabled: !!companyId && !!agentId,
    refetchInterval: 5_000,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      data,
    }: {
      companyId: string;
      data: Partial<Agent>;
    }) => api.post<Agent>(`/companies/${companyId}/agents`, data),
    onSuccess: (_data, { companyId }) => {
      void qc.invalidateQueries({ queryKey: ["agents", companyId] });
    },
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      id,
      data,
    }: {
      companyId: string;
      id: string;
      data: Partial<Agent>;
    }) => api.patch<Agent>(`/companies/${companyId}/agents/${id}`, data),
    onSuccess: (_data, { companyId, id }) => {
      void qc.invalidateQueries({ queryKey: ["agents", companyId] });
      void qc.invalidateQueries({ queryKey: ["agents", companyId, id] });
    },
  });
}

export function useInvokeAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      id,
      payload,
    }: {
      companyId: string;
      id: string;
      payload?: Record<string, unknown>;
    }) =>
      api.post<HeartbeatRun>(`/companies/${companyId}/agents/${id}/invoke`, payload ?? {}),
    onSuccess: (_data, { companyId, id }) => {
      void qc.invalidateQueries({ queryKey: ["agents", companyId, id] });
      void qc.invalidateQueries({ queryKey: ["agent-runs", companyId, id] });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, id }: { companyId: string; id: string }) =>
      api.delete<void>(`/companies/${companyId}/agents/${id}`),
    onSuccess: (_data, { companyId }) => {
      void qc.invalidateQueries({ queryKey: ["agents", companyId] });
    },
  });
}
