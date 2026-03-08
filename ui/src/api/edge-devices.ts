import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { EdgeDevice, EdgeMesh } from "../lib/types";

export function useEdgeDevices(companyId: string | undefined) {
  return useQuery({
    queryKey: ["edge-devices", companyId],
    queryFn: async () => {
      const res = await api.get<{ data: EdgeDevice[] }>(`/companies/${companyId}/edge-devices`);
      return res.data;
    },
    enabled: !!companyId,
    refetchInterval: 5_000,
  });
}

export function useEdgeDevice(companyId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ["edge-devices", companyId, id],
    queryFn: () => api.get<EdgeDevice>(`/companies/${companyId}/edge-devices/${id}`),
    enabled: !!companyId && !!id,
    refetchInterval: 3_000,
  });
}

export function useEdgeMesh(companyId: string | undefined) {
  return useQuery({
    queryKey: ["edge-mesh", companyId],
    queryFn: () => api.get<EdgeMesh>(`/companies/${companyId}/edge-mesh`),
    enabled: !!companyId,
    refetchInterval: 5_000,
  });
}

export function useRegisterDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      data,
    }: {
      companyId: string;
      data: Partial<EdgeDevice>;
    }) => api.post<EdgeDevice>(`/companies/${companyId}/edge-devices`, data),
    onSuccess: (_data, { companyId }) => {
      void qc.invalidateQueries({ queryKey: ["edge-devices", companyId] });
      void qc.invalidateQueries({ queryKey: ["edge-mesh", companyId] });
    },
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      id,
      data,
    }: {
      companyId: string;
      id: string;
      data: Partial<EdgeDevice>;
    }) => api.patch<EdgeDevice>(`/companies/${companyId}/edge-devices/${id}`, data),
    onSuccess: (_data, { companyId, id }) => {
      void qc.invalidateQueries({ queryKey: ["edge-devices", companyId] });
      void qc.invalidateQueries({ queryKey: ["edge-devices", companyId, id] });
      void qc.invalidateQueries({ queryKey: ["edge-mesh", companyId] });
    },
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, id }: { companyId: string; id: string }) =>
      api.delete<void>(`/companies/${companyId}/edge-devices/${id}`),
    onSuccess: (_data, { companyId }) => {
      void qc.invalidateQueries({ queryKey: ["edge-devices", companyId] });
      void qc.invalidateQueries({ queryKey: ["edge-mesh", companyId] });
    },
  });
}
