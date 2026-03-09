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
    <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-3 w-48 hover:border-[#4b5563] transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-[#20808D]/15 border border-[#20808D]/25 flex items-center justify-center">
          <Bot size={12} className="text-[#20808D]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#f9fafb] truncate">{agent.name}</p>
          <p className="text-[9px] text-[#6b7280] truncate">{agent.role}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge type="agent" value={agent.status} />
        <span className="text-[9px] text-[#6b7280] ml-auto">{agent.adapterType}</span>
      </div>
    </div>
  );
}

function DeviceNode({ device }: { device: EdgeDevice }) {
  return (
    <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-3 w-48 hover:border-[#4b5563] transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-[#06b6d4]/15 border border-[#06b6d4]/25 flex items-center justify-center">
          <Cpu size={12} className="text-[#06b6d4]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#f9fafb] truncate">{device.name}</p>
          <p className="text-[9px] text-[#6b7280] truncate">{device.hostname}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge type="device" value={device.status} />
        <span className="text-[9px] text-[#6b7280] ml-auto">{device.deviceType}</span>
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
      <div className="p-6 space-y-4">
        <SkeletonCard />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-[18px] font-bold text-[#f9fafb]">Organization Chart</h2>
        <p className="text-[12px] text-[#6b7280] mt-0.5">
          {agents.length} agents · {devices.length} devices
        </p>
      </div>

      {/* Hub node at top */}
      <div className="flex flex-col items-center">
        <div className="bg-[#20808D]/15 border-2 border-[#20808D]/40 rounded-2xl p-4 w-56 text-center">
          <Network size={20} className="text-[#20808D] mx-auto mb-2" />
          <p className="text-[13px] font-bold text-[#f9fafb]">{company?.name ?? "Hub"}</p>
          <p className="text-[10px] text-[#9ca3af] mt-0.5">Central Hub</p>
        </div>

        {/* Connector line */}
        {(agents.length > 0 || devices.length > 0) && (
          <div className="w-px h-8 bg-[#374151]" />
        )}
      </div>

      {/* Agents section */}
      {agents.length > 0 && (
        <div>
          <h3 className="text-[12px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3 px-1">
            Agents ({agents.length})
          </h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {agents.map((agent) => (
              <AgentNode key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      )}

      {/* Devices section */}
      {devices.length > 0 && (
        <div>
          <h3 className="text-[12px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3 px-1">
            Edge Devices ({devices.length})
          </h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {devices.map((device) => (
              <DeviceNode key={device.id} device={device} />
            ))}
          </div>
        </div>
      )}

      {agents.length === 0 && devices.length === 0 && (
        <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-8 flex flex-col items-center justify-center text-center">
          <Network size={32} className="text-[#374151] mb-3" />
          <p className="text-[13px] text-[#9ca3af]">No agents or devices registered</p>
          <p className="text-[11px] text-[#6b7280] mt-1">
            Register agents and edge devices to see the organization chart
          </p>
        </div>
      )}
    </div>
  );
}
