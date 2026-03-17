import React, { useState } from "react";
import { Input, Textarea } from "./ui/input";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { Agent, AdapterType } from "../lib/types";

interface AgentConfigFormProps {
  initial?: Partial<Agent>;
  onSubmit: (data: Partial<Agent>) => void;
  onCancel?: () => void;
  loading?: boolean;
}

const ADAPTER_TYPES: { value: AdapterType; label: string; description: string; group: string }[] = [
  // Cloud LLM providers — use for projects that need frontier models
  { value: "openai", label: "OpenAI", description: "GPT-4o, o1, o3-mini", group: "Cloud" },
  { value: "anthropic", label: "Anthropic", description: "Claude Opus, Sonnet, Haiku", group: "Cloud" },
  { value: "openrouter", label: "OpenRouter", description: "Multi-provider gateway (100+ models)", group: "Cloud" },
  { value: "litellm", label: "LiteLLM", description: "Unified proxy for any LLM provider", group: "Cloud" },
  // Local / Hub — free inference on Mac Studio GPU
  { value: "ollama_local", label: "Ollama (Hub)", description: "Local models — qwen3.5:35b, glm-4.7-flash (free)", group: "Local" },
  { value: "claude_code", label: "Claude Code", description: "Claude Code CLI as agent backend", group: "Local" },
  // Edge / Spoke agents
  { value: "seaclaw", label: "SeaClaw Edge", description: "C binary agent for Pi / Jetson / edge devices", group: "Edge" },
  { value: "agent_zero", label: "Agent Zero", description: "Autonomous coding agent (Python)", group: "Edge" },
  { value: "external_agent", label: "External Agent", description: "Any external autonomous agent endpoint", group: "Edge" },
  // Infrastructure
  { value: "telegram_bridge", label: "Telegram Bridge", description: "Human-in-the-loop via Telegram bot", group: "Infra" },
  { value: "process", label: "Process", description: "Spawn a local command as an agent", group: "Infra" },
  { value: "http", label: "HTTP", description: "Generic HTTP-callable agent endpoint", group: "Infra" },
];

const ADAPTER_CONFIG_FIELDS: Record<AdapterType, { key: string; label: string; placeholder: string; type?: string }[]> = {
  // Cloud providers
  openai: [
    { key: "model", label: "Model", placeholder: "gpt-4o" },
    { key: "apiKey", label: "API Key", placeholder: "sk-...", type: "password" },
    { key: "maxTokens", label: "Max Tokens", placeholder: "4096" },
    { key: "temperature", label: "Temperature", placeholder: "0.7" },
  ],
  anthropic: [
    { key: "model", label: "Model", placeholder: "claude-sonnet-4-20250514" },
    { key: "apiKey", label: "API Key", placeholder: "sk-ant-...", type: "password" },
    { key: "maxTokens", label: "Max Tokens", placeholder: "4096" },
  ],
  openrouter: [
    { key: "model", label: "Model", placeholder: "anthropic/claude-sonnet-4-20250514" },
    { key: "apiKey", label: "API Key", placeholder: "sk-or-...", type: "password" },
    { key: "maxTokens", label: "Max Tokens", placeholder: "4096" },
    { key: "temperature", label: "Temperature", placeholder: "0.7" },
  ],
  litellm: [
    { key: "model", label: "Model", placeholder: "gpt-4o" },
    { key: "baseUrl", label: "LiteLLM Proxy URL", placeholder: "http://localhost:4000" },
    { key: "apiKey", label: "API Key", placeholder: "sk-...", type: "password" },
  ],
  // Local / Hub
  ollama_local: [
    { key: "model", label: "Model", placeholder: "qwen3.5:35b" },
    { key: "baseUrl", label: "Ollama URL", placeholder: "http://localhost:11434" },
  ],
  claude_code: [
    { key: "model", label: "Model", placeholder: "claude-sonnet-4-20250514" },
    { key: "workingDir", label: "Working Directory", placeholder: "/path/to/repo" },
    { key: "autoBranch", label: "Auto-Branch", placeholder: "true" },
  ],
  // Edge / Spoke
  seaclaw: [
    { key: "baseUrl", label: "Device URL", placeholder: "http://100.x.y.z:8080" },
    { key: "deviceId", label: "Device ID", placeholder: "dev_abc123" },
  ],
  agent_zero: [
    { key: "baseUrl", label: "Agent Zero URL", placeholder: "http://localhost:50001" },
    { key: "apiKey", label: "API Key", placeholder: "your-api-key", type: "password" },
    { key: "messageFormat", label: "Message Format", placeholder: "agent-zero" },
  ],
  external_agent: [
    { key: "baseUrl", label: "Agent URL", placeholder: "http://187.77.185.88:50001" },
    { key: "apiKey", label: "API Key", placeholder: "your-api-key", type: "password" },
    { key: "protocol", label: "Protocol", placeholder: "https" },
    { key: "authType", label: "Auth Type", placeholder: "api-key" },
    { key: "messageFormat", label: "Message Format", placeholder: "agent-zero" },
  ],
  // Infrastructure
  telegram_bridge: [
    { key: "botToken", label: "Bot Token", placeholder: "123456:ABC-...", type: "password" },
    { key: "chatId", label: "Chat ID", placeholder: "-1001234567890" },
  ],
  process: [
    { key: "command", label: "Command", placeholder: "/usr/local/bin/my-agent" },
    { key: "args", label: "Arguments", placeholder: "--mode=agent" },
    { key: "workingDir", label: "Working Directory", placeholder: "/path/to/dir" },
  ],
  http: [
    { key: "endpoint", label: "Endpoint URL", placeholder: "https://my-agent.example.com/api" },
    { key: "apiKey", label: "API Key", placeholder: "...", type: "password" },
    { key: "method", label: "HTTP Method", placeholder: "POST" },
  ],
};

export function AgentConfigForm({
  initial = {},
  onSubmit,
  onCancel,
  loading = false,
}: AgentConfigFormProps) {
  const [name, setName] = useState(initial.name ?? "");
  const [role, setRole] = useState(initial.role ?? "");
  const [title, setTitle] = useState(initial.title ?? "");
  const [adapterType, setAdapterType] = useState<AdapterType>(
    initial.adapterType ?? "ollama_local"
  );
  const [budgetCents, setBudgetCents] = useState(
    initial.budgetCents != null ? String(initial.budgetCents / 100) : "10"
  );
  const [configFields, setConfigFields] = useState<Record<string, string>>(() => {
    const config = (initial as any).adapterConfig ?? initial.config ?? {};
    return Object.fromEntries(
      Object.entries(config).map(([k, v]) => [k, String(v)])
    );
  });

  const currentFields = ADAPTER_CONFIG_FIELDS[adapterType];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const adapterConfig: Record<string, unknown> = {};
    currentFields.forEach(({ key }) => {
      if (configFields[key]) adapterConfig[key] = configFields[key];
    });

    onSubmit({
      name,
      role,
      title,
      adapterType,
      budgetCents: Math.round(parseFloat(budgetCents || "0") * 100),
      adapterConfig,
    } as any);
  };

  const updateConfigField = (key: string, value: string) => {
    setConfigFields((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Agent Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. code-reviewer"
          required
        />
        <Input
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. engineer"
          required
        />
      </div>

      <Input
        label="Title / Description"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Brief description of what this agent does"
      />

      <div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
          Adapter Type
        </label>
        <Select
          value={adapterType}
          onValueChange={(v) => setAdapterType(v as AdapterType)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select adapter" />
          </SelectTrigger>
          <SelectContent>
            {["Cloud", "Local", "Edge", "Infra"].map((group) => {
              const items = ADAPTER_TYPES.filter((a) => a.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <div style={{ padding: "6px 12px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{group === "Infra" ? "Infrastructure" : group === "Local" ? "Local / Hub" : group === "Edge" ? "Edge / Spoke" : "Cloud Providers"}</div>
                  {items.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      <span className="font-medium">{a.label}</span>
                      <span className="ml-2 text-[var(--text-muted)] text-[10px]">{a.description}</span>
                    </SelectItem>
                  ))}
                </div>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Adapter-specific config fields */}
      <div className="bg-[var(--bg-alt)] rounded-none border border-[var(--border)] p-3 flex flex-col gap-3">
        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {ADAPTER_TYPES.find((a) => a.value === adapterType)?.label} Config
        </p>
        {currentFields.map((field) => (
          <Input
            key={field.key}
            label={field.label}
            type={field.type ?? "text"}
            value={configFields[field.key] ?? ""}
            onChange={(e) => updateConfigField(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        ))}
      </div>

      <Input
        label="Monthly Budget ($)"
        type="number"
        min="0"
        step="0.01"
        value={budgetCents}
        onChange={(e) => setBudgetCents(e.target.value)}
        placeholder="10.00"
        hint="Maximum monthly spend for this agent in USD"
      />

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          loading={loading}
        >
          {initial.name ? "Save Changes" : "Create Agent"}
        </Button>
      </div>
    </form>
  );
}
