import React from "react";
import { Bot, Network, Cpu } from "lucide-react";
import { useCompanyContext } from "../context/CompanyContext";
import { useAgents } from "../api/agents";
import { useEdgeDevices } from "../api/edge-devices";
import { StatusBadge } from "../components/StatusBadge";
import { SkeletonCard } from "../components/ui/skeleton";
import { cn } from "../lib/utils";
import type { Agent, EdgeDevice } from "../lib/types";

function AgentNode({ agent }: { agent: Agent }) {
  return (
    <div
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, width: 192 }}
      className="hover:border-[var(--border-hover)] transition-colors"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
          className="bg-[var(--primary)]/15 border border-[var(--primary)]/25"
        >
          <Bot size={12} className="text-[var(--primary)]" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{agent.name}</p>
          <p className="text-[9px] text-[var(--text-muted)] truncate">{agent.role}</p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StatusBadge type="agent" value={agent.status} />
        <span className="text-[9px] text-[var(--text-muted)]" style={{ marginLeft: "auto" }}>{agent.adapterType}</span>
      </div>
    </div>
  );
}

function DeviceNode({ device }: { device: EdgeDevice }) {
  return (
    <div
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, width: 192 }}
      className="hover:border-[var(--border-hover)] transition-colors"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
          className="bg-[var(--accent)]/15 border border-[var(--accent)]/25"
        >
          <Cpu size={12} className="text-[var(--accent)]" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{device.name}</p>
          <p className="text-[9px] text-[var(--text-muted)] truncate">{device.hostname}</p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StatusBadge type="device" value={device.status} />
        <span className="text-[9px] text-[var(--text-muted)]" style={{ marginLeft: "auto" }}>{device.deviceType}</span>
      </div>
    </div>
  );
}

export default function OrgChart() {
  const { companyId, company } = useCompanyContext();
  const { data: agents = [], isLoading: agentsLoading } = useAgents(companyId);
  const { data: devices = [], isLoading: devicesLoading } = useEdgeDevices(companyId);

  const isLoading = agentsLoading || devicesLoading;

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SkeletonCard />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="animate-fade-in">
      <div>
        <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Organization Chart</h2>
        <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
          {agents.length} agents · {devices.length} devices
        </p>
      </div>

      {/* Hub node at top */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{ borderWidth: 2, borderRadius: 16, padding: 16, width: 224, textAlign: "center" }}
          className="bg-[var(--primary)]/15 border-[var(--primary)]/40"
        >
          <Network size={20} className="text-[var(--primary)] mx-auto" style={{ marginBottom: 8 }} />
          <p className="text-[13px] font-bold text-[var(--text-primary)]">{company?.name ?? "Hub"}</p>
          <p className="text-[10px] text-[var(--text-secondary)]" style={{ marginTop: 2 }}>Central Hub</p>
        </div>

        {/* Connector line */}
        {(agents.length > 0 || devices.length > 0) && (
          <div style={{ width: 1, height: 32, backgroundColor: "var(--border)" }} />
        )}
      </div>

      {/* Agents section */}
      {agents.length > 0 && (
        <div>
          <h3 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider" style={{ marginBottom: 12, padding: "0 4px" }}>
            Agents ({agents.length})
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {agents.map((agent) => (
              <AgentNode key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      )}

      {/* Devices section */}
      {devices.length > 0 && (
        <div>
          <h3 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider" style={{ marginBottom: 12, padding: "0 4px" }}>
            Edge Devices ({devices.length})
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {devices.map((device) => (
              <DeviceNode key={device.id} device={device} />
            ))}
          </div>
        </div>
      )}

      {agents.length === 0 && devices.length === 0 && (
        <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <Network size={32} className="text-[var(--border)]" style={{ marginBottom: 12 }} />
          <p className="text-[13px] text-[var(--text-secondary)]">No agents or devices registered</p>
          <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: 4 }}>
            Register agents and edge devices to see the organization chart
          </p>
        </div>
      )}
    </div>
  );
}
