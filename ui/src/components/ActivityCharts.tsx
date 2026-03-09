import React from "react";

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function DonutChart({ segments, label }: { segments: DonutSegment[]; label: string }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-28 h-28 rounded-full border-[6px] border-[#374151] flex items-center justify-center">
          <span className="text-[20px] font-bold text-[#6b7280]">0</span>
        </div>
        <span className="text-[11px] text-[#6b7280]">{label}</span>
      </div>
    );
  }

  let cumulative = 0;
  const gradientParts = segments
    .filter((s) => s.value > 0)
    .map((seg) => {
      const start = (cumulative / total) * 360;
      cumulative += seg.value;
      const end = (cumulative / total) * 360;
      return `${seg.color} ${start}deg ${end}deg`;
    });

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{
          background: `conic-gradient(${gradientParts.join(", ")})`,
        }}
      >
        <div className="w-[76px] h-[76px] rounded-full bg-[#1f2937] flex items-center justify-center">
          <span className="text-[20px] font-bold text-[#f9fafb]">{total}</span>
        </div>
      </div>
      <span className="text-[11px] text-[#9ca3af] font-medium">{label}</span>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
        {segments
          .filter((s) => s.value > 0)
          .map((seg) => (
            <div key={seg.label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-[10px] text-[#9ca3af]">
                {seg.label} ({seg.value})
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function BarChart({
  bars,
  label,
}: {
  bars: { label: string; value: number; color: string }[];
  label: string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] text-[#9ca3af] font-medium">{label}</span>
      <div className="flex items-end gap-1.5 h-24">
        {bars.map((bar) => (
          <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] font-mono text-[#9ca3af]">
              {bar.value > 0 ? bar.value : ""}
            </span>
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{
                height: `${Math.max((bar.value / max) * 72, 2)}px`,
                backgroundColor: bar.color,
                minHeight: bar.value > 0 ? 8 : 2,
              }}
            />
            <span className="text-[9px] text-[#6b7280] truncate w-full text-center">
              {bar.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ActivityChartsProps {
  agentCounts: {
    total: number;
    idle: number;
    running: number;
    error: number;
    offline: number;
  };
  issueCounts: {
    total: number;
    open: number;
    in_progress: number;
    blocked?: number;
    done: number;
    cancelled?: number;
  };
  edgeDeviceCount: number;
  onlineDeviceCount: number;
}

export function ActivityCharts({
  agentCounts,
  issueCounts,
  edgeDeviceCount,
  onlineDeviceCount,
}: ActivityChartsProps) {
  const agentSegments: DonutSegment[] = [
    { label: "Running", value: agentCounts.running, color: "#20808D" },
    { label: "Idle", value: agentCounts.idle, color: "#06b6d4" },
    { label: "Error", value: agentCounts.error, color: "#ef4444" },
    { label: "Offline", value: agentCounts.offline, color: "#374151" },
  ];

  const issueBars = [
    { label: "Open", value: issueCounts.open, color: "#06b6d4" },
    { label: "Active", value: issueCounts.in_progress, color: "#20808D" },
    { label: "Blocked", value: issueCounts.blocked ?? 0, color: "#eab308" },
    { label: "Done", value: issueCounts.done, color: "#22c55e" },
    { label: "Cancelled", value: issueCounts.cancelled ?? 0, color: "#6b7280" },
  ];

  const deviceSegments: DonutSegment[] = [
    { label: "Online", value: onlineDeviceCount, color: "#22c55e" },
    { label: "Offline", value: edgeDeviceCount - onlineDeviceCount, color: "#6b7280" },
  ];

  return (
    <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4">
      <h3 className="text-[13px] font-semibold text-[#f9fafb] mb-4">Overview</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex justify-center">
          <DonutChart segments={agentSegments} label="Agents" />
        </div>
        <div>
          <BarChart bars={issueBars} label="Issues by Status" />
        </div>
        <div className="flex justify-center">
          <DonutChart segments={deviceSegments} label="Edge Devices" />
        </div>
      </div>
    </div>
  );
}
