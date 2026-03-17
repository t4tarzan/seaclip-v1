import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { EdgeDevice, EdgeMesh, DeviceTelemetry } from "../lib/types";

// Server response shapes (different from UI types)
interface ServerDevice {
  id: string;
  companyId: string;
  name: string;
  deviceType: string;
  hardwareId?: string;
  ipAddress?: string;
  endpoint?: string;
  location?: string;
  capabilities: string[];
  status: string;
  metadata: Record<string, unknown>;
  registeredAt: string;
  lastSeenAt?: string;
  updatedAt: string;
}

interface ServerTelemetryEntry {
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  temperatureCelsius?: number;
  networkBytesIn?: number;
  networkBytesOut?: number;
  uptimeSeconds?: number;
}

interface ServerMeshNode {
  id: string;
  name: string;
  deviceType: string;
  status: string;
  location?: string;
  capabilities: string[];
}

interface ServerMeshEdge {
  sourceId: string;
  targetId: string;
  edgeType: string;
  latencyMs?: number;
}

const DEFAULT_TELEMETRY: DeviceTelemetry = {
  cpuPercent: 0,
  memoryPercent: 0,
  diskPercent: 0,
  temperatureCelsius: 0,
  networkRxBps: 0,
  networkTxBps: 0,
  tasksProcessed: 0,
  uptime: 0,
};

function mapServerDevice(d: ServerDevice, telemetry?: ServerTelemetryEntry): EdgeDevice {
  return {
    id: d.id,
    companyId: d.companyId,
    name: d.name,
    hostname: d.ipAddress ?? d.name,
    deviceType: (d.deviceType ?? "linux") as EdgeDevice["deviceType"],
    status: (d.status === "unknown" ? "offline" : d.status) as EdgeDevice["status"],
    ipAddress: d.ipAddress ?? "—",
    location: d.location,
    assignedAgentId: (d.metadata?.assignedAgentId as string) ?? undefined,
    assignedAgentName: (d.metadata?.assignedAgentName as string) ?? undefined,
    telemetry: telemetry
      ? {
          cpuPercent: telemetry.cpuPercent ?? 0,
          memoryPercent: telemetry.memoryPercent ?? 0,
          diskPercent: telemetry.diskPercent ?? 0,
          temperatureCelsius: telemetry.temperatureCelsius ?? 0,
          networkRxBps: telemetry.networkBytesIn ?? 0,
          networkTxBps: telemetry.networkBytesOut ?? 0,
          tasksProcessed: 0,
          uptime: telemetry.uptimeSeconds ?? 0,
        }
      : { ...DEFAULT_TELEMETRY },
    lastSeenAt: d.lastSeenAt ?? d.updatedAt,
    registeredAt: d.registeredAt,
  };
}

export function useEdgeDevices(companyId: string | undefined) {
  return useQuery({
    queryKey: ["edge-devices", companyId],
    queryFn: async () => {
      const res = await api.get<{ data: ServerDevice[] }>(`/companies/${companyId}/edge-devices`);
      return (res.data ?? []).map((d) => mapServerDevice(d));
    },
    enabled: !!companyId,
    refetchInterval: 5_000,
  });
}

export function useEdgeDevice(companyId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ["edge-devices", companyId, id],
    queryFn: async () => {
      const res = await api.get<ServerDevice & { telemetryHistory?: ServerTelemetryEntry[] }>(
        `/companies/${companyId}/edge-devices/${id}`
      );
      const latest = res.telemetryHistory?.[0];
      return mapServerDevice(res, latest);
    },
    enabled: !!companyId && !!id,
    refetchInterval: 3_000,
  });
}

export function useEdgeMesh(companyId: string | undefined) {
  return useQuery({
    queryKey: ["edge-mesh", companyId],
    queryFn: async () => {
      // Fetch both mesh topology and full device list in parallel
      const [meshRes, devicesRes] = await Promise.all([
        api.get<{ nodes: ServerMeshNode[]; edges: ServerMeshEdge[]; generatedAt: string }>(
          `/companies/${companyId}/edge-devices/mesh`
        ),
        api.get<{ data: ServerDevice[] }>(`/companies/${companyId}/edge-devices`),
      ]);

      const serverDevices = devicesRes.data ?? [];
      const devices: EdgeDevice[] = serverDevices.map((d) => mapServerDevice(d));

      // Map edges to connections
      const connections = (meshRes.edges ?? []).map((e) => ({
        fromId: e.sourceId,
        toId: e.targetId,
        quality: (e.edgeType === "sync" ? "healthy" : "degraded") as "healthy" | "degraded" | "offline",
        latencyMs: e.latencyMs ?? 0,
      }));

      // Pick first device as hub (or first online one)
      const hubDevice = devices.find((d) => d.status === "online") ?? devices[0];

      const onlineCount = devices.filter((d) => d.status === "online").length;
      const offlineCount = devices.filter((d) => d.status === "offline").length;
      const degradedCount = devices.filter((d) => d.status === "degraded").length;

      return {
        hubDeviceId: hubDevice?.id ?? "",
        devices,
        connections,
        totalTasksProcessing: 0,
        onlineCount,
        offlineCount,
        degradedCount,
      } as EdgeMesh;
    },
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
