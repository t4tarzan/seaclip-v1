import React from "react";
import { cn } from "../lib/utils";
import type { EdgeDevice, DeviceType, DeviceStatus } from "../lib/types";
import {
  Cpu,
  Smartphone,
  Monitor,
  Camera,
  Server,
  Laptop,
  Wifi,
} from "lucide-react";

interface DeviceNodeProps {
  device: EdgeDevice;
  isHub?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}

const deviceIcons: Record<DeviceType, React.ElementType> = {
  raspberry_pi: Cpu,
  jetson: Server,
  phone: Smartphone,
  camera: Camera,
  mac: Laptop,
  linux: Monitor,
  windows: Monitor,
};

const statusColors: Record<DeviceStatus, { dot: string; ring: string; text: string; bg: string }> = {
  online: {
    dot: "bg-[var(--success)]",
    ring: "ring-[var(--success)]/20",
    text: "text-[var(--success)]",
    bg: "bg-[var(--success)]/10",
  },
  offline: {
    dot: "bg-[var(--text-muted)]",
    ring: "ring-[var(--text-muted)]/20",
    text: "text-[var(--text-muted)]",
    bg: "bg-[var(--text-muted)]/10",
  },
  degraded: {
    dot: "bg-[var(--warning)]",
    ring: "ring-[var(--warning)]/20",
    text: "text-[var(--warning)]",
    bg: "bg-[var(--warning)]/10",
  },
};

function MiniStatBar({ value, label, color = "var(--primary)" }: { value: number; label: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[8px] text-[var(--text-muted)]">{label}</span>
        <span className="text-[8px] font-mono text-[var(--text-secondary)]">{value}%</span>
      </div>
      <div className="h-1 w-full bg-[var(--border)] rounded-none overflow-hidden">
        <div
          className="h-full rounded-none transition-all duration-500"
          style={{
            width: `${Math.min(100, value)}%`,
            backgroundColor: value > 85 ? "var(--error)" : value > 65 ? "var(--warning)" : color,
          }}
        />
      </div>
    </div>
  );
}

export function DeviceNode({ device, isHub = false, isSelected = false, onClick }: DeviceNodeProps) {
  const Icon = deviceIcons[device.deviceType] ?? Server;
  const colors = statusColors[device.status];

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1.5 p-2.5 rounded-none",
        "border transition-all duration-200 cursor-pointer",
        "hover:scale-105 active:scale-100 focus:outline-none",
        isHub
          ? "w-24 bg-[var(--surface)] border-[var(--primary)]/40 shadow-lg shadow-[var(--primary)]/10"
          : "w-[76px] bg-[var(--bg-alt)] border-[var(--border)]",
        isSelected
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30 bg-[var(--accent)]/5"
          : cn("hover:border-[var(--border-hover)]", isHub && "hover:border-[var(--primary)]/60"),
        device.status === "offline" && "opacity-60"
      )}
      aria-label={`${device.name} (${device.status})`}
    >
      {/* Status indicator */}
      <div
        className={cn(
          "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[var(--bg)] z-10",
          colors.dot
        )}
      >
        {device.status === "online" && (
          <span
            className={cn(
              "absolute inset-0 rounded-full animate-ping opacity-75",
              colors.dot
            )}
          />
        )}
      </div>

      {/* Device icon */}
      <div
        className={cn(
          "rounded-none flex items-center justify-center",
          isHub ? "w-10 h-10" : "w-8 h-8",
          isHub ? "bg-[var(--primary)]/20 border border-[var(--primary)]/30" : colors.bg
        )}
      >
        <Icon
          size={isHub ? 20 : 16}
          className={isHub ? "text-[var(--primary)]" : colors.text}
        />
      </div>

      {/* Device name */}
      <span
        className={cn(
          "font-medium text-center leading-tight w-full truncate",
          isHub ? "text-[11px] text-[var(--text-primary)]" : "text-[9px] text-[var(--text-secondary)]"
        )}
      >
        {device.name}
      </span>

      {/* Mini stats */}
      {device.status !== "offline" && (
        <div className="w-full flex flex-col gap-0.5 mt-0.5">
          <MiniStatBar
            value={device.telemetry.cpuPercent}
            label="CPU"
            color={isHub ? "var(--primary)" : "var(--accent)"}
          />
          <MiniStatBar
            value={device.telemetry.memoryPercent}
            label="MEM"
            color={isHub ? "var(--primary)" : "var(--accent)"}
          />
          {device.telemetry.temperatureCelsius > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-[var(--text-muted)]">TEMP</span>
              <span
                className={cn(
                  "text-[8px] font-mono",
                  device.telemetry.temperatureCelsius > 80
                    ? "text-[var(--error)]"
                    : device.telemetry.temperatureCelsius > 65
                    ? "text-[var(--warning)]"
                    : "text-[var(--text-secondary)]"
                )}
              >
                {device.telemetry.temperatureCelsius.toFixed(0)}°C
              </span>
            </div>
          )}
        </div>
      )}

      {/* Hub badge */}
      {isHub && (
        <span className="absolute -bottom-2 bg-[var(--primary)] text-white text-[7px] font-bold px-1.5 py-0.5 rounded-none uppercase tracking-wider">
          HUB
        </span>
      )}
    </button>
  );
}
