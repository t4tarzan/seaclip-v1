/**
 * edge-devices service — device registration, telemetry ingestion,
 * mesh topology builder, health check aggregation.
 */
import { getDb } from "../db.js";
import { eq, and, asc } from "drizzle-orm";
import { edgeDevices } from "@seaclip/db";
import { notFound } from "../errors.js";

export type DeviceStatus = "online" | "offline" | "degraded" | "unknown";

export interface EdgeDevice {
  id: string;
  companyId: string;
  name: string;
  deviceType: string;
  hardwareId?: string;
  ipAddress?: string;
  endpoint?: string;
  location?: string;
  capabilities: string[];
  status: DeviceStatus;
  metadata: Record<string, unknown>;
  registeredAt: string;
  lastSeenAt?: string;
  updatedAt: string;
}

export interface DeviceTelemetry {
  id: string;
  deviceId: string;
  companyId: string;
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  gpuPercent?: number;
  gpuMemoryPercent?: number;
  temperatureCelsius?: number;
  networkBytesIn?: number;
  networkBytesOut?: number;
  uptimeSeconds?: number;
  customMetrics?: Record<string, number>;
  timestamp: string;
  receivedAt: string;
}

export interface TelemetryInput {
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  gpuPercent?: number;
  gpuMemoryPercent?: number;
  temperatureCelsius?: number;
  networkBytesIn?: number;
  networkBytesOut?: number;
  uptimeSeconds?: number;
  customMetrics?: Record<string, number>;
  timestamp?: string;
}

export interface MeshTopology {
  nodes: MeshNode[];
  edges: MeshEdge[];
  generatedAt: string;
}

export interface MeshNode {
  id: string;
  name: string;
  deviceType: string;
  status: DeviceStatus;
  location?: string;
  capabilities: string[];
}

export interface MeshEdge {
  sourceId: string;
  targetId: string;
  edgeType: "agent" | "sync" | "tunnel";
  latencyMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToDevice(row: typeof edgeDevices.$inferSelect): EdgeDevice {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const caps = Array.isArray(row.capabilities) ? (row.capabilities as string[]) : [];

  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    deviceType: row.deviceType,
    hardwareId: typeof meta.hardwareId === "string" ? meta.hardwareId : undefined,
    ipAddress: row.ipAddress ?? undefined,
    endpoint: typeof meta.endpoint === "string" ? meta.endpoint : undefined,
    location: typeof meta.location === "string" ? meta.location : undefined,
    capabilities: caps,
    status: (row.status as DeviceStatus) ?? "unknown",
    metadata: meta,
    registeredAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastHeartbeatAt?.toISOString() ?? row.lastPingAt?.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function determineStatus(
  lastSeenAt: string | undefined,
  telemetry?: TelemetryInput,
): DeviceStatus {
  if (!lastSeenAt) return "unknown";

  const lastSeen = new Date(lastSeenAt).getTime();
  const staleThresholdMs = 5 * 60 * 1000; // 5 minutes

  if (Date.now() - lastSeen > staleThresholdMs) return "offline";

  if (telemetry) {
    const cpu = telemetry.cpuPercent ?? 0;
    const mem = telemetry.memoryPercent ?? 0;
    const temp = telemetry.temperatureCelsius ?? 0;

    if (cpu > 95 || mem > 95 || temp > 80) return "degraded";
  }

  return "online";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listEdgeDevices(companyId: string): Promise<EdgeDevice[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(edgeDevices)
    .where(eq(edgeDevices.companyId, companyId))
    .orderBy(asc(edgeDevices.createdAt));

  return rows.map(rowToDevice);
}

export async function registerEdgeDevice(
  companyId: string,
  input: {
    name: string;
    deviceType: string;
    hardwareId?: string;
    ipAddress?: string;
    endpoint?: string;
    location?: string;
    capabilities?: string[];
    metadata?: Record<string, unknown>;
  },
): Promise<EdgeDevice> {
  const db = getDb();

  const metadata: Record<string, unknown> = { ...(input.metadata ?? {}) };
  if (input.hardwareId) metadata.hardwareId = input.hardwareId;
  if (input.endpoint) metadata.endpoint = input.endpoint;
  if (input.location) metadata.location = input.location;

  const [row] = await db
    .insert(edgeDevices)
    .values({
      companyId,
      name: input.name,
      deviceType: input.deviceType,
      ipAddress: input.ipAddress ?? null,
      status: "unknown",
      capabilities: input.capabilities ?? [],
      metadata,
    })
    .returning();

  return rowToDevice(row);
}

export async function getEdgeDevice(
  companyId: string,
  id: string,
): Promise<EdgeDevice & { telemetryHistory: DeviceTelemetry[] }> {
  const db = getDb();

  const [row] = await db
    .select()
    .from(edgeDevices)
    .where(and(eq(edgeDevices.id, id), eq(edgeDevices.companyId, companyId)));

  if (!row) {
    throw notFound(`Edge device "${id}" not found`);
  }

  const device = rowToDevice(row);

  // Build a synthetic telemetry entry from latest persisted telemetry fields on the device row
  const telemetryHistory: DeviceTelemetry[] = [];
  const hasAnyTelemetry =
    row.cpuUsage !== null ||
    row.memoryUsageMb !== null ||
    row.gpuUsagePct !== null ||
    row.diskUsagePct !== null ||
    row.temperature !== null;

  if (hasAnyTelemetry) {
    const ts = row.lastHeartbeatAt ?? row.updatedAt;
    telemetryHistory.push({
      id: crypto.randomUUID(),
      deviceId: row.id,
      companyId: row.companyId,
      cpuPercent: row.cpuUsage ?? undefined,
      memoryPercent: undefined, // stored as MB not %; no direct mapping without total RAM
      diskPercent: row.diskUsagePct ?? undefined,
      gpuPercent: row.gpuUsagePct ?? undefined,
      temperatureCelsius: row.temperature ?? undefined,
      timestamp: ts.toISOString(),
      receivedAt: ts.toISOString(),
    });
  }

  return { ...device, telemetryHistory };
}

export async function updateEdgeDevice(
  companyId: string,
  id: string,
  input: Partial<{
    name: string;
    deviceType: string;
    ipAddress: string;
    endpoint: string;
    location: string;
    capabilities: string[];
    metadata: Record<string, unknown>;
  }>,
): Promise<EdgeDevice> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(edgeDevices)
    .where(and(eq(edgeDevices.id, id), eq(edgeDevices.companyId, companyId)));

  if (!existing) {
    throw notFound(`Edge device "${id}" not found`);
  }

  const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>;
  const mergedMeta = input.metadata !== undefined
    ? { ...existingMeta, ...input.metadata }
    : existingMeta;

  if (input.endpoint !== undefined) mergedMeta.endpoint = input.endpoint;
  if (input.location !== undefined) mergedMeta.location = input.location;

  const updateValues: Partial<typeof edgeDevices.$inferInsert> = {
    updatedAt: new Date(),
    metadata: mergedMeta,
  };
  if (input.name !== undefined) updateValues.name = input.name;
  if (input.deviceType !== undefined) updateValues.deviceType = input.deviceType;
  if (input.ipAddress !== undefined) updateValues.ipAddress = input.ipAddress;
  if (input.capabilities !== undefined) updateValues.capabilities = input.capabilities;

  const [row] = await db
    .update(edgeDevices)
    .set(updateValues)
    .where(eq(edgeDevices.id, id))
    .returning();

  return rowToDevice(row);
}

export async function deregisterEdgeDevice(
  companyId: string,
  id: string,
): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(edgeDevices)
    .where(and(eq(edgeDevices.id, id), eq(edgeDevices.companyId, companyId)));

  if (!existing) {
    throw notFound(`Edge device "${id}" not found`);
  }

  await db.delete(edgeDevices).where(eq(edgeDevices.id, id));
}

export async function ingestTelemetry(
  companyId: string,
  deviceId: string,
  input: TelemetryInput,
): Promise<DeviceTelemetry> {
  const db = getDb();

  const [device] = await db
    .select()
    .from(edgeDevices)
    .where(and(eq(edgeDevices.id, deviceId), eq(edgeDevices.companyId, companyId)));

  if (!device) {
    throw notFound(`Edge device "${deviceId}" not found`);
  }

  const now = new Date();
  const existingMeta = (device.metadata ?? {}) as Record<string, unknown>;

  // Persist extra telemetry fields into metadata JSONB
  const updatedMeta: Record<string, unknown> = { ...existingMeta };
  if (input.networkBytesIn !== undefined) updatedMeta.networkBytesIn = input.networkBytesIn;
  if (input.networkBytesOut !== undefined) updatedMeta.networkBytesOut = input.networkBytesOut;
  if (input.uptimeSeconds !== undefined) updatedMeta.uptimeSeconds = input.uptimeSeconds;
  if (input.customMetrics !== undefined) updatedMeta.customMetrics = input.customMetrics;
  if (input.gpuMemoryPercent !== undefined) updatedMeta.gpuMemoryPercent = input.gpuMemoryPercent;

  const newStatus = determineStatus(now.toISOString(), input);

  await db
    .update(edgeDevices)
    .set({
      cpuUsage: input.cpuPercent ?? device.cpuUsage,
      gpuUsagePct: input.gpuPercent ?? device.gpuUsagePct,
      diskUsagePct: input.diskPercent ?? device.diskUsagePct,
      temperature: input.temperatureCelsius ?? device.temperature,
      status: newStatus,
      lastHeartbeatAt: now,
      updatedAt: now,
      metadata: updatedMeta,
    })
    .where(eq(edgeDevices.id, deviceId));

  const telemetry: DeviceTelemetry = {
    id: crypto.randomUUID(),
    deviceId,
    companyId,
    cpuPercent: input.cpuPercent,
    memoryPercent: input.memoryPercent,
    diskPercent: input.diskPercent,
    gpuPercent: input.gpuPercent,
    gpuMemoryPercent: input.gpuMemoryPercent,
    temperatureCelsius: input.temperatureCelsius,
    networkBytesIn: input.networkBytesIn,
    networkBytesOut: input.networkBytesOut,
    uptimeSeconds: input.uptimeSeconds,
    customMetrics: input.customMetrics,
    timestamp: input.timestamp ?? now.toISOString(),
    receivedAt: now.toISOString(),
  };

  return telemetry;
}

export async function getMeshTopology(companyId: string): Promise<MeshTopology> {
  const db = getDb();

  const rows = await db
    .select()
    .from(edgeDevices)
    .where(eq(edgeDevices.companyId, companyId))
    .orderBy(asc(edgeDevices.createdAt));

  const devices = rows.map(rowToDevice);

  const nodes: MeshNode[] = devices.map((d) => ({
    id: d.id,
    name: d.name,
    deviceType: d.deviceType,
    status: d.status,
    location: d.location,
    capabilities: d.capabilities,
  }));

  // Simple mesh: connect online devices in the same location
  const onlineDevices = devices.filter((d) => d.status === "online");
  const edges: MeshEdge[] = [];

  for (let i = 0; i < onlineDevices.length; i++) {
    for (let j = i + 1; j < onlineDevices.length; j++) {
      const a = onlineDevices[i];
      const b = onlineDevices[j];

      if (a.location && b.location && a.location === b.location) {
        edges.push({
          sourceId: a.id,
          targetId: b.id,
          edgeType: "sync",
        });
      }
    }
  }

  return {
    nodes,
    edges,
    generatedAt: new Date().toISOString(),
  };
}
