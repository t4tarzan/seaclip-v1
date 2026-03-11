import React, { useState } from "react";
import { useCompanyContext } from "../context/CompanyContext";
import { useCompany } from "../api/companies";
import { api } from "../api/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input, Textarea } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { SkeletonCard } from "../components/ui/skeleton";
import { formatCents, cn } from "../lib/utils";
import {
  Settings as SettingsIcon,
  Building2,
  DollarSign,
  Key,
  Server,
  Save,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Brain,
  Globe,
  Shield,
  Network,
  Terminal,
  GitBranch,
  Database,
  Bell,
  Cpu,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

/* ── Reusable Section Card ── */

function Section({
  title,
  description,
  icon: Icon,
  children,
  badge,
}: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        {Icon && (
          <div style={{ width: 32, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} className="bg-[var(--primary)]/15 border border-[var(--primary)]/25">
            <Icon size={15} className="text-[var(--primary)]" />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</h3>
            {badge}
          </div>
          {description && (
            <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>{description}</p>
          )}
        </div>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

/* ── API Key Field ── */

function ApiKeyField({ apiKey }: { apiKey: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="font-mono text-[12px] text-[var(--text-secondary)]">
        {visible ? apiKey : apiKey.slice(0, 8) + "\u2022".repeat(24) + apiKey.slice(-4)}
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={visible ? <EyeOff size={12} /> : <Eye size={12} />}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide" : "Show"}
      />
      <Button
        variant="ghost"
        size="sm"
        icon={copied ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
        onClick={handleCopy}
        aria-label="Copy"
      />
    </div>
  );
}

/* ── Service Health Row ── */

function ServiceRow({
  name,
  port,
  url,
  icon: Icon,
  description,
}: {
  name: string;
  port: number;
  url: string;
  icon: React.ElementType;
  description: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["settings-health", name],
    queryFn: async () => {
      try {
        await fetch(url, { signal: AbortSignal.timeout(3000), mode: "no-cors" });
        return "online" as const;
      } catch {
        return "offline" as const;
      }
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
      <div style={{ flexShrink: 0 }}>
        {isLoading ? (
          <Loader2 size={14} className="text-[var(--text-muted)] animate-spin" />
        ) : data === "online" ? (
          <CheckCircle2 size={14} className="text-[var(--success)]" />
        ) : (
          <XCircle size={14} className="text-[var(--error)]" />
        )}
      </div>
      <Icon size={15} className="text-[var(--text-muted)]" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="text-[12px] font-medium text-[var(--text-primary)]">{name}</span>
        <span className="text-[10px] font-mono text-[var(--text-muted)]" style={{ marginLeft: 8 }}>:{port}</span>
        <p className="text-[10px] text-[var(--text-muted)]">{description}</p>
      </div>
      {url.startsWith("http") && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
        >
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

/* ── Config Row (read-only display) ── */

function ConfigRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)" }} className="last:border-0">
      <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
      <span className={cn("text-[12px] text-[var(--text-primary)]", mono && "font-mono text-[11px]")}>
        {value}
      </span>
    </div>
  );
}

/* ── Toggle Row ── */

function ToggleRow({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)" }} className="last:border-0">
      <div>
        <p className="text-[12px] font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-[10px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          "rounded-full transition-colors",
          enabled ? "bg-[var(--primary)]" : "bg-[var(--border)]"
        )}
        style={{ width: 40, height: 22, position: "relative", flexShrink: 0 }}
      >
        <span
          className="bg-white rounded-full shadow-sm"
          style={{ width: 18, height: 18, top: 2, position: "absolute", transform: enabled ? "translateX(20px)" : "translateX(2px)", transition: "transform 0.2s" }}
        />
      </button>
    </div>
  );
}

/* ── Settings Tabs ── */

type Tab = "general" | "services" | "claude" | "environment" | "notifications";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "general", label: "General", icon: Building2 },
  { key: "services", label: "Services", icon: Server },
  { key: "claude", label: "Claude & AI", icon: Brain },
  { key: "environment", label: "Environment", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
];

/* ── Main Settings Page ── */

export default function Settings() {
  const { companyId } = useCompanyContext();
  const { data: company, isLoading } = useCompany(companyId);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Claude & AI settings (local state — would persist to server)
  const [claudeModel, setClaudeModel] = useState("claude-opus-4-6");
  const [ollamaModel, setOllamaModel] = useState("qwen3.5:35b");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoPR, setAutoPR] = useState(true);
  const [autoCommit, setAutoCommit] = useState(false);
  const [costLimit, setCostLimit] = useState("10.00");

  // Environment settings
  const [tailscaleEnabled, setTailscaleEnabled] = useState(true);
  const [localOnlyAgents, setLocalOnlyAgents] = useState(true);
  const [cloudAgentsAllowed, setCloudAgentsAllowed] = useState(true);

  // Notification settings
  const [notifyOnPR, setNotifyOnPR] = useState(true);
  const [notifyOnError, setNotifyOnError] = useState(true);
  const [notifyOnApproval, setNotifyOnApproval] = useState(true);
  const [notifyOnDeviceOffline, setNotifyOnDeviceOffline] = useState(true);

  React.useEffect(() => {
    if (company) {
      setName(company.name);
      setDescription(company.description);
      setBudget(String((company.monthlyBudgetCents ?? 0) / 100));
    }
  }, [company]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    try {
      await api.patch(`/companies/${companyId}`, {
        name,
        description,
        monthlyBudgetCents: Math.round(parseFloat(budget) * 100),
      });
      await qc.invalidateQueries({ queryKey: ["companies"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!company) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <p className="text-[var(--text-muted)]">Company not found</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SettingsIcon size={20} className="text-[var(--primary)]" />
        <div>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)]">Settings</h2>
          <p className="text-[12px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
            Manage workspace, services, and AI configuration
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "var(--bg-alt)", borderRadius: 12, padding: 6, overflowX: "auto" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "text-[12px] font-medium transition-all whitespace-nowrap",
                tab === t.key
                  ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
              )}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 6 }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }} className="lg:grid-cols-2">
        {/* ═══════════ General ═══════════ */}
        {tab === "general" && (
          <>
            <Section title="Company Information" description="Workspace identity" icon={Building2}>
              <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Input
                  label="Company Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Company"
                  required
                />
                <Textarea
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={saving}
                    icon={saved ? <Check size={12} /> : <Save size={12} />}
                  >
                    {saved ? "Saved!" : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Section>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Section title="Budget" description="Monthly spend limits" icon={DollarSign}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Input
                    label="Monthly Budget (USD)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="100.00"
                  />
                  <div style={{ backgroundColor: "var(--bg-alt)", borderRadius: 6, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className="text-[11px] text-[var(--text-muted)]">Current limit</span>
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {formatCents(company.monthlyBudgetCents ?? 0)}
                    </span>
                  </div>
                </div>
              </Section>

              <Section title="API Key" description="Authenticate with SeaClip API" icon={Key}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <ApiKeyField apiKey={company.apiKey ?? "sk-seaclip-not-configured"} />
                  <Badge variant="warning" dot>
                    Keep this key secret
                  </Badge>
                </div>
              </Section>
            </div>
          </>
        )}

        {/* ═══════════ Services ═══════════ */}
        {tab === "services" && (
          <>
            <Section title="Local Services" description="Live health status" icon={Server}>
              <div style={{ display: "flex", flexDirection: "column" }} className="divide-y divide-[var(--border)]/50">
                <ServiceRow name="SeaClip API" port={3001} url="http://localhost:3001" icon={Server} description="Express 5 backend — hub coordinator" />
                <ServiceRow name="Dashboard UI" port={3100} url="http://localhost:3100" icon={Globe} description="React 19 + Vite — this interface" />
                <ServiceRow name="Marketing Site" port={4321} url="http://localhost:4321" icon={Globe} description="Astro v5 — seaclip.tech" />
                <ServiceRow name="PostgreSQL" port={5432} url="http://localhost:3001/api/health" icon={Database} description="Docker container — seaclip-postgres" />
                <ServiceRow name="Ollama" port={11434} url="http://localhost:11434" icon={Brain} description="Local LLM inference — qwen3.5:35b" />
              </div>
            </Section>

            <Section title="Infrastructure" description="Runtime configuration" icon={Cpu}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <ConfigRow label="Database URL" value="postgresql://seaclip:***@localhost:5432/seaclip" mono />
                <ConfigRow label="Deployment Mode" value="local_trusted" />
                <ConfigRow label="Heartbeat Interval" value="30,000ms" />
                <ConfigRow label="Heartbeat Scheduler" value="Enabled" />
                <ConfigRow label="Serve UI" value="false (Vite dev)" />
                <ConfigRow label="CORS Origins" value="localhost:3000, localhost:5173" />
                <ConfigRow label="Node.js" value="v25.8.0 arm64" />
                <ConfigRow label="Platform" value="Mac Studio M3 Ultra, 96GB" />
                <ConfigRow label="Auto-Start" value="com.seaclip.services LaunchAgent" />
              </div>
            </Section>
          </>
        )}

        {/* ═══════════ Claude & AI ═══════════ */}
        {tab === "claude" && (
          <>
            <Section
              title="Claude Code Integration"
              description="Configure Claude as a coding agent"
              icon={Terminal}
              badge={<Badge variant="info" dot>Connected</Badge>}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="text-[11px] text-[var(--text-muted)]" style={{ marginBottom: 6, display: "block" }}>Cloud Model</label>
                  <select
                    value={claudeModel}
                    onChange={(e) => setClaudeModel(e.target.value)}
                    style={{ width: "100%", backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px" }}
                    className="text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="claude-opus-4-6">Claude Opus 4.6 (most capable)</option>
                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (balanced)</option>
                    <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fastest)</option>
                  </select>
                </div>
                <ToggleRow
                  label="Auto-create branches"
                  description="Claude creates feature branches for each task automatically"
                  enabled={autoPR}
                  onChange={setAutoPR}
                />
                <ToggleRow
                  label="Auto-commit changes"
                  description="Commit code changes without manual approval"
                  enabled={autoCommit}
                  onChange={setAutoCommit}
                />
                <ToggleRow
                  label="Auto-approve PRs under cost limit"
                  description={`Skip approval for PRs costing less than $${costLimit}`}
                  enabled={autoApprove}
                  onChange={setAutoApprove}
                />
                <Input
                  label="Cost limit for auto-approve (USD)"
                  type="number"
                  min="0"
                  step="0.50"
                  value={costLimit}
                  onChange={(e) => setCostLimit(e.target.value)}
                />
              </div>
            </Section>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Section
                title="Ollama (Local LLM)"
                description="On-device model inference"
                icon={Brain}
                badge={<Badge variant="success" dot>Running</Badge>}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Input
                    label="Ollama Base URL"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)]" style={{ marginBottom: 6, display: "block" }}>Default Model</label>
                    <select
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      style={{ width: "100%", backgroundColor: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px" }}
                      className="text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="qwen3.5:35b">qwen3.5:35b (24GB, reasoning)</option>
                      <option value="glm-4.7-flash">glm-4.7-flash (18GB, coding)</option>
                      <option value="llama3.1:8b">llama3.1:8b (5GB, fast)</option>
                      <option value="codellama:34b">codellama:34b (20GB, code)</option>
                    </select>
                  </div>
                  <div style={{ backgroundColor: "var(--bg-alt)", borderRadius: 6, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }} className="text-[11px]">
                      <span className="text-[var(--text-muted)]">Memory available</span>
                      <span className="text-[var(--text-primary)] font-mono">~42GB headroom</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }} className="text-[11px]">
                      <span className="text-[var(--text-muted)]">GPU</span>
                      <span className="text-[var(--text-primary)] font-mono">M3 Ultra, 96GB unified</span>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Git Workflow" description="PR and merge settings" icon={GitBranch}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <ConfigRow label="Default branch" value="main" />
                  <ConfigRow label="Branch prefix" value="feat/, fix/, chore/" />
                  <ConfigRow label="PR auto-merge" value="After approval" />
                  <ConfigRow label="Commit style" value="Conventional commits" />
                </div>
              </Section>
            </div>
          </>
        )}

        {/* ═══════════ Environment ═══════════ */}
        {tab === "environment" && (
          <>
            <Section title="Environment Isolation" description="Cloud vs local agent routing" icon={Shield}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <ToggleRow
                  label="Tailscale integration"
                  description="Use Tailnet as the trust boundary for local agents"
                  enabled={tailscaleEnabled}
                  onChange={setTailscaleEnabled}
                />
                <ToggleRow
                  label="Local-only agents stay local"
                  description="Agents tagged 'local' never make external HTTP calls"
                  enabled={localOnlyAgents}
                  onChange={setLocalOnlyAgents}
                />
                <ToggleRow
                  label="Allow cloud agents"
                  description="Agents tagged 'cloud' can reach external APIs (Claude, HTTP)"
                  enabled={cloudAgentsAllowed}
                  onChange={setCloudAgentsAllowed}
                />
              </div>
            </Section>

            <Section title="Adapters" description="Registered agent adapters" icon={Cpu}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { name: "Claude Code", type: "claude_code", env: "cloud", status: "active" },
                  { name: "Ollama Local", type: "ollama_local", env: "local", status: "active" },
                  { name: "SeaClaw Edge", type: "seaclaw", env: "local", status: "available" },
                  { name: "Process", type: "process", env: "local", status: "active" },
                  { name: "HTTP", type: "http", env: "cloud", status: "active" },
                  { name: "Telegram Bridge", type: "telegram_bridge", env: "cloud", status: "inactive" },
                  { name: "Agent Zero", type: "agent_zero", env: "cloud", status: "available" },
                ].map((adapter) => (
                  <div
                    key={adapter.type}
                    style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: "var(--bg-alt)", borderRadius: 6, padding: "12px 16px" }}
                  >
                    <div
                      className={cn(
                        "rounded-full",
                        adapter.status === "active"
                          ? "bg-[var(--success)]"
                          : adapter.status === "available"
                          ? "bg-[var(--text-muted)]"
                          : "bg-[var(--error)]"
                      )}
                      style={{ width: 8, height: 8, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="text-[12px] font-medium text-[var(--text-primary)]">{adapter.name}</span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]" style={{ marginLeft: 8 }}>{adapter.type}</span>
                    </div>
                    <Badge variant={adapter.env === "local" ? "success" : "info"}>
                      {adapter.env}
                    </Badge>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ═══════════ Notifications ═══════════ */}
        {tab === "notifications" && (
          <>
            <Section title="Event Notifications" description="What events trigger alerts" icon={Bell}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <ToggleRow
                  label="PR opened or merged"
                  description="Get notified when agents create or merge pull requests"
                  enabled={notifyOnPR}
                  onChange={setNotifyOnPR}
                />
                <ToggleRow
                  label="Agent errors"
                  description="Alert when an agent run fails or crashes"
                  enabled={notifyOnError}
                  onChange={setNotifyOnError}
                />
                <ToggleRow
                  label="Approval requests"
                  description="Alert when an agent needs human approval"
                  enabled={notifyOnApproval}
                  onChange={setNotifyOnApproval}
                />
                <ToggleRow
                  label="Device goes offline"
                  description="Alert when an edge device loses connection"
                  enabled={notifyOnDeviceOffline}
                  onChange={setNotifyOnDeviceOffline}
                />
              </div>
            </Section>

            <Section title="Channels" description="Where notifications are delivered" icon={Globe}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ backgroundColor: "var(--bg-alt)", borderRadius: 6, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Globe size={14} className="text-[var(--text-secondary)]" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-[var(--text-primary)]">Dashboard</p>
                      <p className="text-[10px] text-[var(--text-muted)]">In-app notification bell</p>
                    </div>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
                <div style={{ backgroundColor: "var(--bg-alt)", borderRadius: 6, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-secondary)">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-[var(--text-primary)]">Telegram</p>
                      <p className="text-[10px] text-[var(--text-muted)]">Bot token not configured</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">Configure</Button>
                </div>
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Danger Zone — always visible at bottom */}
      {tab === "general" && (
        <Section title="Danger Zone" description="Irreversible actions">
          <div style={{ border: "1px solid color-mix(in srgb, var(--error) 25%, transparent)", borderRadius: 6, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <p className="text-[12px] font-semibold text-[var(--text-primary)]">Delete Workspace</p>
              <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: 2 }}>
                Permanently delete this workspace and all its data.
              </p>
            </div>
            <Button variant="destructive" size="sm">Delete</Button>
          </div>
        </Section>
      )}
    </div>
  );
}
