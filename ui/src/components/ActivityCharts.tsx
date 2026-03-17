import React from "react";

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function DonutChart({ segments, label, size = 72 }: { segments: DonutSegment[]; label: string; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const innerSize = size * 0.65;

  if (total === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{
          width: size, height: size, borderRadius: "50%",
          border: "5px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-muted)" }}>0</span>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</span>
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `conic-gradient(${gradientParts.join(", ")})`,
      }}>
        <div style={{
          width: innerSize, height: innerSize, borderRadius: "50%",
          backgroundColor: "var(--surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{total}</span>
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}

function BarChart({ bars, label }: { bars: { label: string; value: number; color: string }[]; label: string }) {
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 56 }}>
        {bars.map((bar) => (
          <div key={bar.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 8, color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>
              {bar.value > 0 ? bar.value : ""}
            </span>
            <div style={{
              width: "100%", borderRadius: 0,
              transition: "height 500ms ease",
              height: Math.max((bar.value / max) * 40, 2),
              minHeight: bar.value > 0 ? 6 : 2,
              backgroundColor: bar.color,
            }} />
            <span style={{ fontSize: 8, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GaugeChart({ value, label }: { value: number; label: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = pct >= 80 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--error)";
  const radius = 32;
  const circumference = Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width="80" height="48" viewBox="0 0 80 48" style={{ overflow: "visible" }}>
        <path d="M 6 42 A 32 32 0 0 1 74 42" fill="none" stroke="var(--border)" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M 6 42 A 32 32 0 0 1 74 42"
          fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
        <text x="40" y="38" textAnchor="middle" style={{ fontSize: 14, fontWeight: 700 }} fill="var(--text-primary)">
          {pct}%
        </text>
      </svg>
      <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}

interface ActivityChartsProps {
  agentCounts: { total: number; idle: number; running: number; error: number; offline: number };
  issueCounts: { total: number; open: number; in_progress: number; blocked?: number; done: number; cancelled?: number };
  priorityCounts?: { urgent: number; high: number; medium: number; low: number; none: number };
  successRate?: number;
  edgeDeviceCount: number;
  onlineDeviceCount: number;
}

export function ActivityCharts({
  agentCounts, issueCounts, priorityCounts, successRate, edgeDeviceCount, onlineDeviceCount,
}: ActivityChartsProps) {
  const agentSegments: DonutSegment[] = [
    { label: "Running", value: agentCounts.running, color: "var(--primary)" },
    { label: "Idle", value: agentCounts.idle, color: "var(--accent)" },
    { label: "Error", value: agentCounts.error, color: "var(--error)" },
    { label: "Offline", value: agentCounts.offline, color: "var(--border)" },
  ];

  const issueBars = [
    { label: "Open", value: issueCounts.open, color: "var(--accent)" },
    { label: "Active", value: issueCounts.in_progress, color: "var(--primary)" },
    { label: "Blocked", value: issueCounts.blocked ?? 0, color: "var(--warning)" },
    { label: "Done", value: issueCounts.done, color: "var(--success)" },
    { label: "Cancel", value: issueCounts.cancelled ?? 0, color: "var(--text-muted)" },
  ];

  const deviceSegments: DonutSegment[] = [
    { label: "Online", value: onlineDeviceCount, color: "var(--success)" },
    { label: "Offline", value: edgeDeviceCount - onlineDeviceCount, color: "var(--text-muted)" },
  ];

  const prioritySegments: DonutSegment[] = priorityCounts
    ? [
        { label: "Urgent", value: priorityCounts.urgent, color: "var(--error)" },
        { label: "High", value: priorityCounts.high, color: "#f97316" },
        { label: "Medium", value: priorityCounts.medium, color: "var(--warning)" },
        { label: "Low", value: priorityCounts.low, color: "var(--success)" },
        { label: "None", value: priorityCounts.none, color: "var(--text-muted)" },
      ]
    : [];

  const charts: React.ReactNode[] = [
    <DonutChart key="agents" segments={agentSegments} label="Agents" />,
    <BarChart key="issues" bars={issueBars} label="Issues by Status" />,
    <DonutChart key="devices" segments={deviceSegments} label="Devices" />,
  ];
  if (priorityCounts) charts.push(<DonutChart key="priority" segments={prioritySegments} label="Priority" />);
  if (successRate !== undefined) charts.push(<GaugeChart key="heartbeat" value={successRate} label="Heartbeat" />);

  return (
    <div style={{
      backgroundColor: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 0, padding: 20, overflow: "hidden",
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Overview</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 16, flexWrap: "wrap" }}>
        {charts.map((chart, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "center", minWidth: 80 }}>
            {chart}
          </div>
        ))}
      </div>
    </div>
  );
}
