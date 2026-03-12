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
  Download,
  Copy,
  CheckCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

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
      return { stroke: "#38bdf8", strokeDasharray: "none", opacity: 0.5 };
    if (quality === "degraded")
      return { stroke: "#eab308", strokeDasharray: "6 4", opacity: 0.6 };
    return { stroke: "#374151", strokeDasharray: "3 5", opacity: 0.4 };
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "100%" }}
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
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
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

      {/* Spoke device nodes (foreign object for HTML rendering) */}
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

// ─── Register Device Dialog ──────────────────────────────────────────────────
function RegisterDeviceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { companyId } = useCompanyContext();
  const [copied, setCopied] = useState<string | null>(null);

  const hubUrl = window.location.origin.replace(/:\d+$/, ":3001");
  const downloadUrl = `${hubUrl}/spoke-agent.sh`;

  const downloadCommand = `curl -O ${downloadUrl}
chmod +x spoke-agent.sh`;

  const setupCommands = `export SEACLIP_HUB_URL="${hubUrl}"
export SEACLIP_COMPANY_ID="${companyId}"
export SEACLIP_DEVICE_TYPE="raspberry-pi"
./spoke-agent.sh`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Register Edge Device</DialogTitle>
          <DialogDescription>
            Follow these steps to connect your edge device to the SeaClip hub.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 8 }}>
          {/* Step 1: Download */}
          <div>
            <h4 className="text-[12px] font-semibold text-[var(--text-primary)] mb-3">
              Step 1: Download Spoke Agent
            </h4>
            <div
              style={{
                backgroundColor: "var(--bg-alt)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <pre
                className="text-[11px] font-mono text-[var(--text-secondary)] mb-3"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
              >
                {downloadCommand}
              </pre>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  variant="outline"
                  size="sm"
                  icon={copied === "download" ? <CheckCircle size={12} /> : <Copy size={12} />}
                  onClick={() => copyToClipboard(downloadCommand, "download")}
                >
                  {copied === "download" ? "Copied!" : "Copy Command"}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Download size={12} />}
                  onClick={() => window.open(downloadUrl, "_blank")}
                >
                  Download Script
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2: Run on Device */}
          <div>
            <h4 className="text-[12px] font-semibold text-[var(--text-primary)] mb-3">
              Step 2: Run on Your Device
            </h4>
            <div
              style={{
                backgroundColor: "var(--bg-alt)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <pre
                className="text-[11px] font-mono text-[var(--text-secondary)] mb-3"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
              >
                {setupCommands}
              </pre>
              <Button
                variant="outline"
                size="sm"
                icon={copied === "setup" ? <CheckCircle size={12} /> : <Copy size={12} />}
                onClick={() => copyToClipboard(setupCommands, "setup")}
              >
                {copied === "setup" ? "Copied!" : "Copy Commands"}
              </Button>
            </div>
          </div>

          {/* Step 3: Verify */}
          <div
            style={{
              backgroundColor: "var(--primary)/10",
              border: "1px solid var(--primary)/25",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <p className="text-[11px] text-[var(--text-secondary)]">
              <strong>✓ Your device will appear automatically</strong> in the Edge Mesh view once
              the script runs successfully. No manual registration needed!
            </p>
          </div>

          {/* Documentation Link */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <p className="text-[10px] text-[var(--text-muted)]">
              For detailed setup instructions, see the{" "}
              <a
                href="https://github.com/yourusername/seaclip/blob/main/doc/SPOKE-AGENT-SETUP.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:underline"
              >
                Spoke Agent Setup Guide
              </a>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
    <div
      style={{
        backgroundColor: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        width: 320,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
      className="animate-slide-in"
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottom: "1px solid var(--border)" }}>
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{device.name}</h3>
          <p className="text-[10px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>{device.hostname}</p>
        </div>
        <button
          onClick={onClose}
          style={{ padding: 4, borderRadius: 4 }}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <StatusBadge type="device" value={device.status} />
          <span className="text-[10px] text-[var(--text-muted)]">
            Last seen: {timeAgo(device.lastSeenAt)}
          </span>
        </div>

        {/* Telemetry */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Telemetry
          </h4>

          {[
            { label: "CPU", value: tele.cpuPercent, icon: <Cpu size={11} />, unit: "%" },
            { label: "Memory", value: tele.memoryPercent, icon: <HardDrive size={11} />, unit: "%" },
            { label: "Disk", value: tele.diskPercent, icon: <HardDrive size={11} />, unit: "%" },
          ].map(({ label, value, icon, unit }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }} className="text-[11px] text-[var(--text-secondary)]">
                  {icon}
                  {label}
                </div>
                <span className="text-[11px] font-mono text-[var(--text-primary)]">
                  {value.toFixed(1)}{unit}
                </span>
              </div>
              <div style={{ height: 6, width: "100%", backgroundColor: "var(--border)", borderRadius: 9999, overflow: "hidden" }}>
                <div
                  className="transition-all duration-500"
                  style={{
                    height: "100%",
                    borderRadius: 9999,
                    width: `${Math.min(100, value)}%`,
                    backgroundColor:
                      value > 85 ? "var(--error)" : value > 65 ? "var(--warning)" : "var(--primary)",
                  }}
                />
              </div>
            </div>
          ))}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 4 }}>
            <div style={{ backgroundColor: "var(--bg-alt)", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }} className="text-[10px] text-[var(--text-muted)]">
                <Thermometer size={10} /> Temperature
              </div>
              <p
                className={cn(
                  "text-[16px] font-bold",
                  tele.temperatureCelsius > 80
                    ? "text-[var(--error)]"
                    : tele.temperatureCelsius > 65
                    ? "text-[var(--warning)]"
                    : "text-[var(--success)]"
                )}
              >
                {tele.temperatureCelsius.toFixed(1)}°C
              </p>
            </div>
            <div style={{ backgroundColor: "var(--bg-alt)", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }} className="text-[10px] text-[var(--text-muted)]">
                <Activity size={10} /> Tasks
              </div>
              <p className="text-[16px] font-bold text-[var(--text-primary)]">
                {tele.tasksProcessed.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Network */}
          <div style={{ backgroundColor: "var(--bg-alt)", borderRadius: 8, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }} className="text-[10px] text-[var(--text-muted)]">
              <Wifi size={10} /> Network
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div>
                <p className="text-[9px] text-[var(--text-muted)]">↓ RX</p>
                <p className="text-[11px] font-mono text-[var(--text-primary)]">
                  {formatBytes(tele.networkRxBps)}/s
                </p>
              </div>
              <div>
                <p className="text-[9px] text-[var(--text-muted)]">↑ TX</p>
                <p className="text-[11px] font-mono text-[var(--text-primary)]">
                  {formatBytes(tele.networkTxBps)}/s
                </p>
              </div>
            </div>
          </div>

          {/* Uptime */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }} className="text-[11px]">
            <span className="text-[var(--text-muted)]">Uptime</span>
            <span className="text-[var(--text-secondary)] font-mono">
              {Math.floor(tele.uptime / 86400)}d{" "}
              {Math.floor((tele.uptime % 86400) / 3600)}h{" "}
              {Math.floor((tele.uptime % 3600) / 60)}m
            </span>
          </div>
        </div>

        {/* Assigned Agent */}
        {device.assignedAgentName && (
          <div
            style={{ borderRadius: 8, padding: 12 }}
            className="bg-[var(--primary)]/10 border border-[var(--primary)]/25"
          >
            <p className="text-[10px] text-[var(--text-muted)]" style={{ marginBottom: 4 }}>Assigned Agent</p>
            <p className="text-[12px] font-semibold text-[var(--accent)]">
              {device.assignedAgentName}
            </p>
          </div>
        )}

        {/* Location */}
        {device.location && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }} className="text-[11px]">
            <span className="text-[var(--text-muted)]">Location</span>
            <span className="text-[var(--text-secondary)]">{device.location}</span>
          </div>
        )}

        {/* IP */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }} className="text-[11px]">
          <span className="text-[var(--text-muted)]">IP Address</span>
          <span className="text-[var(--text-secondary)] font-mono">{device.ipAddress}</span>
        </div>

        {/* Registered */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }} className="text-[11px]">
          <span className="text-[var(--text-muted)]">Registered</span>
          <span className="text-[var(--text-secondary)]">{timeAgo(device.registeredAt)}</span>
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
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? undefined : id));
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div
          style={{
            height: 384,
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
          }}
          className="skeleton-shimmer"
        />
      </div>
    );
  }

  if (!mesh) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", textAlign: "center", gap: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Network size={28} className="text-[var(--border)]" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[var(--text-secondary)]">No Edge Mesh Data</p>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 4 }}>
            Register edge devices to visualize your mesh network.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={12} />}
          onClick={() => setShowRegisterDialog(true)}
        >
          Register Device
        </Button>
      </div>
    );
  }

  const statusSummary = [
    { label: "Online", count: mesh.onlineCount, color: "var(--success)" },
    { label: "Degraded", count: mesh.degradedCount, color: "var(--warning)" },
    { label: "Offline", count: mesh.offlineCount, color: "var(--text-muted)" },
    { label: "Processing", count: mesh.totalTasksProcessing, color: "var(--primary)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }} className="animate-fade-in">
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 24px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg-alt)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", flex: 1 }}>
          {statusSummary.map(({ label, count, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: color }} />
              <span className="text-[12px] text-[var(--text-secondary)]">{label}:</span>
              <span className="text-[12px] font-bold text-[var(--text-primary)]">{count}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{ padding: "4px 8px", borderRadius: 4 }}
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium",
              isFetching
                ? "text-[var(--primary)] bg-[var(--primary)]/10"
                : "text-[var(--text-muted)]"
            )}
          >
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
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={11} />}
            onClick={() => setShowRegisterDialog(true)}
          >
            Register Device
          </Button>
        </div>
      </div>

      {/* Canvas + Detail Panel */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Mesh Canvas */}
        <div style={{ flex: 1, backgroundColor: "var(--bg)", overflow: "hidden", position: "relative" }}>
          {mesh.devices.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: 12 }}>
              <Network size={40} className="text-[var(--surface)]" />
              <p className="text-[13px] text-[var(--text-muted)]">No devices in mesh</p>
            </div>
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
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
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
            className="bg-[var(--bg-alt)]/90 backdrop-blur"
          >
            <p className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Connection Quality
            </p>
            {[
              { label: "Healthy", dash: "solid", color: "#38bdf8" },
              { label: "Degraded", dash: "dashed", color: "#eab308" },
              { label: "Offline", dash: "dotted", color: "#374151" },
            ].map(({ label, dash, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                <span className="text-[10px] text-[var(--text-secondary)]">{label}</span>
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

      {/* Register Device Dialog */}
      <RegisterDeviceDialog
        open={showRegisterDialog}
        onOpenChange={setShowRegisterDialog}
      />
    </div>
  );
}
