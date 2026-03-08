import React, { useState, useCallback } from "react";
import { useEdgeMesh, useEdgeDevice } from "../api/edge-devices";
import { useCompanyContext } from "../context/CompanyContext";
import { DeviceNode } from "../components/DeviceNode";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { SkeletonCard } from "../components/ui/skeleton";
import { formatBytes, timeAgo, formatCents } from "../lib/utils";
import { cn } from "../lib/utils";
import type { EdgeDevice, DeviceStatus, MeshConnection } from "../lib/types";
import {
  Network,
  X,
  RefreshCw,
  Plus,
  Thermometer,
  Cpu,
  HardDrive,
  Wifi,
  Activity,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

// ─── SVG Mesh Visualization ───────────────────────────────────────────────────
interface MeshCanvasProps {
  devices: EdgeDevice[];
  connections: MeshConnection[];
  hubId: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}

function getPosition(index: number, total: number, radius: number, cx: number, cy: number) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function MeshCanvas({
  devices,
  connections,
  hubId,
  selectedId,
  onSelect,
}: MeshCanvasProps) {
  const spokes = devices.filter((d) => d.id !== hubId);
  const hub = devices.find((d) => d.id === hubId);
  const W = 700;
  const H = 480;
  const CX = W / 2;
  const CY = H / 2;
  const RADIUS = Math.min(170, (Math.min(W, H) / 2) - 70);

  const getDevicePos = useCallback(
    (id: string) => {
      if (id === hubId) return { x: CX, y: CY };
      const idx = spokes.findIndex((d) => d.id === id);
      if (idx === -1) return { x: CX, y: CY };
      return getPosition(idx, spokes.length, RADIUS, CX, CY);
    },
    [spokes, hubId, CX, CY, RADIUS]
  );

  const connectionStyle = (quality: MeshConnection["quality"]) => {
    if (quality === "healthy")
      return { stroke: "#20808D", strokeDasharray: "none", opacity: 0.5 };
    if (quality === "degraded")
      return { stroke: "#eab308", strokeDasharray: "6 4", opacity: 0.6 };
    return { stroke: "#374151", strokeDasharray: "3 5", opacity: 0.4 };
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      aria-label="Edge mesh network visualization"
    >
      {/* Background grid */}
      <defs>
        <pattern
          id="mesh-grid"
          x="0"
          y="0"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="#1f2937"
            strokeWidth="0.5"
          />
        </pattern>
        <radialGradient id="hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#20808D" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#20808D" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill="url(#mesh-grid)" />

      {/* Hub glow */}
      {hub && (
        <circle cx={CX} cy={CY} r={90} fill="url(#hub-glow)" />
      )}

      {/* Connections */}
      {spokes.map((spoke, idx) => {
        const from = getDevicePos(hubId);
        const to = getPosition(idx, spokes.length, RADIUS, CX, CY);

        // Find connection quality
        const conn = connections.find(
          (c) =>
            (c.fromId === hubId && c.toId === spoke.id) ||
            (c.toId === hubId && c.fromId === spoke.id)
        );
        const quality = conn?.quality ?? (spoke.status === "online" ? "healthy" : spoke.status === "degraded" ? "degraded" : "offline");
        const style = connectionStyle(quality);

        return (
          <g key={spoke.id}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={style.stroke}
              strokeWidth={quality === "healthy" ? 1.5 : 1}
              strokeDasharray={style.strokeDasharray === "none" ? undefined : style.strokeDasharray}
              opacity={style.opacity}
            />
            {/* Latency label for healthy connections */}
            {conn && conn.latencyMs > 0 && quality === "healthy" && (
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 6}
                textAnchor="middle"
                fill="#6b7280"
                fontSize="9"
                fontFamily="monospace"
              >
                {conn.latencyMs}ms
              </text>
            )}
          </g>
        );
      })}

      {/* Spoke device nodes (foreign objects for HTML rendering) */}
      {spokes.map((device, idx) => {
        const pos = getPosition(idx, spokes.length, RADIUS, CX, CY);
        const nodeW = 76;
        const nodeH = device.status !== "offline" ? 104 : 72;
        return (
          <foreignObject
            key={device.id}
            x={pos.x - nodeW / 2}
            y={pos.y - nodeH / 2}
            width={nodeW}
            height={nodeH}
            overflow="visible"
            className="cursor-pointer"
          >
            <div>
              <DeviceNode
                device={device}
                isSelected={selectedId === device.id}
                onClick={() => onSelect(device.id)}
              />
            </div>
          </foreignObject>
        );
      })}

      {/* Hub node (center, bigger) */}
      {hub && (
        <foreignObject
          x={CX - 48}
          y={CY - 72}
          width={96}
          height={144}
          overflow="visible"
        >
          <div>
            <DeviceNode
              device={hub}
              isHub
              isSelected={selectedId === hub.id}
              onClick={() => onSelect(hub.id)}
            />
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

// ─── Device Detail Panel ─────────────────────────────────────────────────────
function DeviceDetailPanel({
  deviceId,
  onClose,
}: {
  deviceId: string;
  onClose: () => void;
}) {
  const { companyId } = useCompanyContext();
  const { data: device } = useEdgeDevice(companyId, deviceId);

  if (!device) return null;

  const tele = device.telemetry;

  return (
    <div className="bg-[#1f2937] border-l border-[#374151] w-80 flex-shrink-0 flex flex-col animate-slide-in overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#374151]">
        <div>
          <h3 className="text-[13px] font-semibold text-[#f9fafb]">{device.name}</h3>
          <p className="text-[10px] text-[#6b7280] mt-0.5">{device.hostname}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-[#6b7280] hover:text-[#f9fafb] hover:bg-[#374151] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <StatusBadge type="device" value={device.status} />
          <span className="text-[10px] text-[#6b7280]">
            Last seen: {timeAgo(device.lastSeenAt)}
          </span>
        </div>

        {/* Telemetry */}
        <div className="flex flex-col gap-3">
          <h4 className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">
            Telemetry
          </h4>

          {[
            { label: "CPU", value: tele.cpuPercent, icon: <Cpu size={11} />, unit: "%" },
            { label: "Memory", value: tele.memoryPercent, icon: <HardDrive size={11} />, unit: "%" },
            { label: "Disk", value: tele.diskPercent, icon: <HardDrive size={11} />, unit: "%" },
          ].map(({ label, value, icon, unit }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-[#9ca3af]">
                  {icon}
                  {label}
                </div>
                <span className="text-[11px] font-mono text-[#f9fafb]">
                  {value.toFixed(1)}{unit}
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#374151] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, value)}%`,
                    backgroundColor:
                      value > 85 ? "#ef4444" : value > 65 ? "#eab308" : "#20808D",
                  }}
                />
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="bg-[#111827] rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-[#6b7280] mb-1">
                <Thermometer size={10} /> Temperature
              </div>
              <p
                className={cn(
                  "text-[16px] font-bold",
                  tele.temperatureCelsius > 80
                    ? "text-[#ef4444]"
                    : tele.temperatureCelsius > 65
                    ? "text-[#eab308]"
                    : "text-[#22c55e]"
                )}
              >
                {tele.temperatureCelsius.toFixed(1)}°C
              </p>
            </div>
            <div className="bg-[#111827] rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-[#6b7280] mb-1">
                <Activity size={10} /> Tasks
              </div>
              <p className="text-[16px] font-bold text-[#f9fafb]">
                {tele.tasksProcessed.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Network */}
          <div className="bg-[#111827] rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-[#6b7280] mb-2">
              <Wifi size={10} /> Network
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-[9px] text-[#6b7280]">↓ RX</p>
                <p className="text-[11px] font-mono text-[#f9fafb]">
                  {formatBytes(tele.networkRxBps)}/s
                </p>
              </div>
              <div>
                <p className="text-[9px] text-[#6b7280]">↑ TX</p>
                <p className="text-[11px] font-mono text-[#f9fafb]">
                  {formatBytes(tele.networkTxBps)}/s
                </p>
              </div>
            </div>
          </div>

          {/* Uptime */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#6b7280]">Uptime</span>
            <span className="text-[#9ca3af] font-mono">
              {Math.floor(tele.uptime / 86400)}d{" "}
              {Math.floor((tele.uptime % 86400) / 3600)}h{" "}
              {Math.floor((tele.uptime % 3600) / 60)}m
            </span>
          </div>
        </div>

        {/* Assigned Agent */}
        {device.assignedAgentName && (
          <div className="bg-[#20808D]/10 border border-[#20808D]/25 rounded-lg p-3">
            <p className="text-[10px] text-[#6b7280] mb-1">Assigned Agent</p>
            <p className="text-[12px] font-semibold text-[#06b6d4]">
              {device.assignedAgentName}
            </p>
          </div>
        )}

        {/* Location */}
        {device.location && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#6b7280]">Location</span>
            <span className="text-[#9ca3af]">{device.location}</span>
          </div>
        )}

        {/* IP */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#6b7280]">IP Address</span>
          <span className="text-[#9ca3af] font-mono">{device.ipAddress}</span>
        </div>

        {/* Registered */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#6b7280]">Registered</span>
          <span className="text-[#9ca3af]">{timeAgo(device.registeredAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main EdgeMesh Page ───────────────────────────────────────────────────────
export default function EdgeMesh() {
  const { companyId } = useCompanyContext();
  const { data: mesh, isLoading, isFetching } = useEdgeMesh(companyId);
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? undefined : id));
  };

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="h-96 bg-[#1f2937] border border-[#374151] rounded-xl skeleton-shimmer" />
      </div>
    );
  }

  if (!mesh) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-[#1f2937] border border-[#374151] flex items-center justify-center">
          <Network size={28} className="text-[#374151]" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#9ca3af]">No Edge Mesh Data</p>
          <p className="text-[12px] text-[#6b7280] mt-1">
            Register edge devices to visualize your mesh network.
          </p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={12} />}>
          Register Device
        </Button>
      </div>
    );
  }

  const statusSummary = [
    { label: "Online", count: mesh.onlineCount, color: "#22c55e" },
    { label: "Degraded", count: mesh.degradedCount, color: "#eab308" },
    { label: "Offline", count: mesh.offlineCount, color: "#6b7280" },
    { label: "Processing", count: mesh.totalTasksProcessing, color: "#20808D" },
  ];

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-[#374151] bg-[#111827] flex-wrap">
        <div className="flex items-center gap-4 flex-wrap flex-1">
          {statusSummary.map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[12px] text-[#9ca3af]">{label}:</span>
              <span className="text-[12px] font-bold text-[#f9fafb]">{count}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded",
            isFetching
              ? "text-[#20808D] bg-[#20808D]/10"
              : "text-[#6b7280]"
          )}>
            <RefreshCw size={9} className={isFetching ? "animate-spin" : ""} />
            {isFetching ? "Refreshing..." : "Auto-refresh 5s"}
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={11} />}
            onClick={() => qc.invalidateQueries({ queryKey: ["edge-mesh", companyId] })}
          >
            Refresh
          </Button>
          <Button variant="primary" size="sm" icon={<Plus size={11} />}>
            Register Device
          </Button>
        </div>
      </div>

      {/* Canvas + Detail Panel */}
      <div className="flex flex-1 min-h-0">
        {/* Mesh Canvas */}
        <div className="flex-1 bg-[#0a0f1a] overflow-hidden relative">
          {mesh.devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <Network size={40} className="text-[#1f2937]" />
              <p className="text-[13px] text-[#6b7280]">No devices in mesh</p>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4">
              <MeshCanvas
                devices={mesh.devices}
                connections={mesh.connections}
                hubId={mesh.hubDeviceId}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-[#111827]/90 backdrop-blur border border-[#374151] rounded-lg p-3 flex flex-col gap-2">
            <p className="text-[9px] font-semibold text-[#6b7280] uppercase tracking-wider">
              Connection Quality
            </p>
            {[
              { label: "Healthy", dash: "solid", color: "#20808D" },
              { label: "Degraded", dash: "dashed", color: "#eab308" },
              { label: "Offline", dash: "dotted", color: "#374151" },
            ].map(({ label, dash, color }) => (
              <div key={label} className="flex items-center gap-2">
                <svg width="28" height="8" viewBox="0 0 28 8">
                  <line
                    x1="0" y1="4" x2="28" y2="4"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeDasharray={
                      dash === "dashed" ? "5 3" : dash === "dotted" ? "2 4" : undefined
                    }
                  />
                </svg>
                <span className="text-[10px] text-[#9ca3af]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Device Detail Panel */}
        {selectedId && (
          <DeviceDetailPanel
            deviceId={selectedId}
            onClose={() => setSelectedId(undefined)}
          />
        )}
      </div>
    </div>
  );
}
