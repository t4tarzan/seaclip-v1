import React from "react";
import { useNavigate } from "react-router-dom";
import { Bot, CircleDot, DollarSign, Network, Activity } from "lucide-react";
import { useCompanyContext } from "../context/CompanyContext";
import { useDashboard } from "../api/dashboard";
import { MetricCard } from "../components/MetricCard";
import { ActivityRow } from "../components/ActivityRow";
import { ActivityCharts } from "../components/ActivityCharts";
import { StatusBadge } from "../components/StatusBadge";
import { SkeletonCard } from "../components/ui/skeleton";
import { ServiceStatus } from "../components/ServiceStatus";
import { formatCents } from "../lib/utils";

const card: React.CSSProperties = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
  overflow: "hidden",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 16,
};

const cardTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-primary)",
};

const viewAllLink: React.CSSProperties = {
  fontSize: 10,
  color: "var(--primary)",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: "'JetBrains Mono', monospace",
};

function AgentStatusChart({
  counts,
}: {
  counts: { total: number; idle: number; running: number; error: number; offline: number };
}) {
  const { total, idle, running, error, offline } = counts;
  const bars = [
    { label: "Running", value: running, color: "var(--primary)", max: total },
    { label: "Idle", value: idle, color: "var(--accent)", max: total },
    { label: "Error", value: error, color: "var(--error)", max: total },
    { label: "Offline", value: offline, color: "var(--border)", max: total },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {bars.map((bar) => (
        <div key={bar.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 10, width: 48, flexShrink: 0,
            color: "var(--text-muted)",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {bar.label}
          </span>
          <div style={{
            flex: 1, height: 6, borderRadius: 3,
            backgroundColor: "var(--bg)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 3,
              transition: "width 700ms ease",
              width: bar.max > 0 ? `${(bar.value / bar.max) * 100}%` : "0%",
              backgroundColor: bar.color,
            }} />
          </div>
          <span style={{
            fontSize: 10, width: 16, textAlign: "right" as const, flexShrink: 0,
            color: "var(--text-primary)",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {bar.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { companyId } = useCompanyContext();
  const { data, isLoading } = useDashboard(companyId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const raw = data?.agentCounts ?? {} as Record<string, number>;
  const agentCounts = {
    total: raw.total ?? 0,
    idle: raw.idle ?? 0,
    running: raw.active ?? raw.running ?? 0,
    error: raw.error ?? 0,
    offline: raw.terminated ?? raw.offline ?? 0,
  };

  const activeIssues = (data?.issueCounts?.in_progress ?? 0) + (data?.issueCounts?.open ?? 0);
  const monthlySpendCents = Math.round((data?.costs?.last30DaysTotalUsd ?? 0) * 100);
  const edgeDevicesOnline = data?.onlineDeviceCount ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <MetricCard
          label="Total Agents"
          value={agentCounts.total}
          description={`${agentCounts.running} running · ${agentCounts.idle} idle · ${agentCounts.error} errors`}
          icon={<Bot size={18} />}
          accent="primary"
          onClick={() => navigate("/agents")}
        />
        <MetricCard
          label="Active Issues"
          value={activeIssues}
          description="In progress or review"
          icon={<CircleDot size={18} />}
          accent="warning"
          onClick={() => navigate("/issues")}
        />
        <MetricCard
          label="Monthly Spend"
          value={formatCents(monthlySpendCents)}
          description="Current billing period"
          icon={<DollarSign size={18} />}
          accent="success"
          onClick={() => navigate("/costs")}
        />
        <MetricCard
          label="Edge Devices"
          value={edgeDevicesOnline}
          description="Online in mesh"
          icon={<Network size={18} />}
          accent="info"
          onClick={() => navigate("/edge-mesh")}
        />
      </div>

      {/* Charts Overview */}
      <ActivityCharts
        agentCounts={agentCounts}
        issueCounts={{
          total: data?.issueCounts?.total ?? 0,
          open: data?.issueCounts?.open ?? 0,
          in_progress: data?.issueCounts?.in_progress ?? 0,
          blocked: data?.issueCounts?.blocked ?? 0,
          done: data?.issueCounts?.done ?? 0,
          cancelled: data?.issueCounts?.cancelled ?? 0,
        }}
        priorityCounts={data?.priorityCounts}
        successRate={data?.heartbeatSuccessRate}
        edgeDeviceCount={data?.edgeDeviceCount ?? 0}
        onlineDeviceCount={edgeDevicesOnline}
      />

      {/* 3-column row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <ServiceStatus />

        {/* Agent Status */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Agent Status</span>
            <button onClick={() => navigate("/agents")} style={viewAllLink}>View all →</button>
          </div>
          <AgentStatusChart counts={agentCounts} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
            {[
              { status: "running", count: agentCounts.running },
              { status: "idle", count: agentCounts.idle },
              { status: "error", count: agentCounts.error },
              { status: "offline", count: agentCounts.offline },
            ].map((s) => (
              <div key={s.status} style={{
                backgroundColor: "var(--bg-alt)",
                borderRadius: 8, padding: "10px 12px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{
                  fontSize: 16, fontWeight: 700,
                  color: "var(--text-primary)",
                  fontFamily: "'Instrument Serif', Georgia, serif",
                }}>
                  {s.count}
                </span>
                <StatusBadge type="agent" value={s.status as any} />
              </div>
            ))}
          </div>
        </div>

        {/* Edge Mesh */}
        <div style={card}>
          <div style={cardHeader}>
            <div>
              <div style={cardTitle}>Edge Mesh</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                {edgeDevicesOnline} online · {(data?.edgeDeviceCount ?? 0) - edgeDevicesOnline} offline
              </div>
            </div>
            <button onClick={() => navigate("/edge-mesh")} style={viewAllLink}>Open mesh →</button>
          </div>

          {(data?.edgeDeviceCount ?? 0) === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0", textAlign: "center" }}>
              <Network size={28} style={{ color: "var(--border)", marginBottom: 8 }} />
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>No edge devices registered</p>
              <p style={{ fontSize: 10, color: "var(--border-hover)", marginTop: 4 }}>Register your first device to see the mesh</p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8,
                backgroundColor: "var(--bg-alt)", borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--success)" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{edgeDevicesOnline}</span>
                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>online</span>
              </div>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8,
                backgroundColor: "var(--bg-alt)", borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--text-muted)" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  {(data?.edgeDeviceCount ?? 0) - edgeDevicesOnline}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>offline</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Recent Activity</span>
          <button onClick={() => navigate("/activity")} style={viewAllLink}>View all →</button>
        </div>
        {!data?.recentActivity || data.recentActivity.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0", textAlign: "center" }}>
            <Activity size={24} style={{ color: "var(--border)", marginBottom: 8 }} />
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>No activity yet</p>
            <p style={{ fontSize: 10, color: "var(--border-hover)", marginTop: 4 }}>Events will appear here as agents work</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.recentActivity.slice(0, 8).map((event) => (
              <ActivityRow key={event.id} event={event} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
