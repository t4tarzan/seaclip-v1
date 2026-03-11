import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Server, Database, Globe, Brain, MonitorSmartphone, ExternalLink, Loader2 } from "lucide-react";

interface ServiceDef {
  name: string;
  port: number;
  url: string;
  healthUrl?: string;
  icon: React.ReactNode;
  description: string;
}

const SERVICES: ServiceDef[] = [
  { name: "SeaClip API", port: 3001, url: "http://localhost:3001", healthUrl: "http://localhost:3001/api/health", icon: <Server size={14} />, description: "Express 5 backend" },
  { name: "Dashboard UI", port: 3100, url: "http://localhost:3100", icon: <MonitorSmartphone size={14} />, description: "React 19 + Vite" },
  { name: "Marketing Site", port: 4321, url: "http://localhost:4321", icon: <Globe size={14} />, description: "Astro v5 (seaclip.tech)" },
  { name: "PostgreSQL", port: 5432, url: "localhost:5432", healthUrl: "http://localhost:3001/api/health", icon: <Database size={14} />, description: "Docker container" },
  { name: "Ollama", port: 11434, url: "http://localhost:11434", healthUrl: "http://localhost:11434/api/tags", icon: <Brain size={14} />, description: "Local LLM inference" },
];

function useServiceHealth(service: ServiceDef) {
  return useQuery({
    queryKey: ["service-health", service.name],
    queryFn: async () => {
      const url = service.healthUrl || service.url;
      try {
        await fetch(url, { signal: AbortSignal.timeout(3000), mode: "no-cors" });
        return { status: "online" as const };
      } catch {
        return { status: "offline" as const };
      }
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

function ServiceRow({ service }: { service: ServiceDef }) {
  const { data, isLoading } = useServiceHealth(service);
  const status = data?.status ?? "unknown";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px", borderRadius: 8,
    }}>
      {/* Status dot */}
      <div style={{ flexShrink: 0, width: 8, display: "flex", alignItems: "center" }}>
        {isLoading ? (
          <Loader2 size={10} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
        ) : (
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            backgroundColor: status === "online" ? "var(--success)" : "var(--error)",
          }} />
        )}
      </div>

      {/* Icon */}
      <span style={{ flexShrink: 0, color: "var(--text-secondary)", display: "flex" }}>{service.icon}</span>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>{service.name}</span>
          <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>:{service.port}</span>
        </div>
        <div style={{ fontSize: 9, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {service.description}
        </div>
      </div>
    </div>
  );
}

export function ServiceStatus() {
  return (
    <div style={{
      backgroundColor: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12, padding: 20, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Local Services</span>
        <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>auto-refresh 15s</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {SERVICES.map((svc) => <ServiceRow key={svc.name} service={svc} />)}
      </div>
      <div style={{
        marginTop: 12, paddingTop: 12,
        borderTop: "1px solid rgba(42, 58, 82, 0.5)",
        textAlign: "center" as const,
      }}>
        <span style={{ fontSize: 9, color: "var(--border-hover)" }}>
          Auto-start via{" "}
          <span style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>com.seaclip.services</span>
          {" "}LaunchAgent
        </span>
      </div>
    </div>
  );
}
