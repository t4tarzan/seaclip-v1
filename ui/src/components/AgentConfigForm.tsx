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

const ADAPTER_TYPES: { value: AdapterType; label: string; description: string }[] = [
  { value: "openai", label: "OpenAI", description: "GPT-4o, o1, o3-mini" },
  { value: "anthropic", label: "Anthropic", description: "Claude 3.5 Sonnet, Haiku" },
  { value: "gemini", label: "Google Gemini", description: "Gemini 2.0 Flash, Pro" },
  { value: "ollama", label: "Ollama (Local)", description: "Local models via Ollama" },
  { value: "external_agent", label: "External Agent", description: "Agent Zero, OpenClaw, or any autonomous agent" },
  { value: "custom", label: "Custom", description: "Custom adapter endpoint" },
];

const ADAPTER_CONFIG_FIELDS: Record<AdapterType, { key: string; label: string; placeholder: string; type?: string }[]> = {
  openai: [
    { key: "model", label: "Model", placeholder: "gpt-4o" },
    { key: "apiKey", label: "API Key", placeholder: "sk-...", type: "password" },
    { key: "maxTokens", label: "Max Tokens", placeholder: "4096" },
    { key: "temperature", label: "Temperature", placeholder: "0.7" },
  ],
  anthropic: [
    { key: "model", label: "Model", placeholder: "claude-3-5-sonnet-20241022" },
    { key: "apiKey", label: "API Key", placeholder: "sk-ant-...", type: "password" },
    { key: "maxTokens", label: "Max Tokens", placeholder: "4096" },
  ],
  gemini: [
    { key: "model", label: "Model", placeholder: "gemini-2.0-flash" },
    { key: "apiKey", label: "API Key", placeholder: "AIza...", type: "password" },
  ],
  ollama: [
    { key: "model", label: "Model", placeholder: "llama3.2" },
    { key: "baseUrl", label: "Base URL", placeholder: "http://localhost:11434" },
  ],
  external_agent: [
    { key: "baseUrl", label: "Agent URL", placeholder: "http://187.77.185.88:50001" },
    { key: "apiKey", label: "API Key", placeholder: "your-api-key", type: "password" },
    { key: "protocol", label: "Protocol", placeholder: "https" },
    { key: "authType", label: "Auth Type", placeholder: "api-key" },
    { key: "messageFormat", label: "Message Format", placeholder: "agent-zero" },
  ],
  custom: [
    { key: "endpoint", label: "Endpoint URL", placeholder: "https://..." },
    { key: "apiKey", label: "API Key", placeholder: "...", type: "password" },
    { key: "model", label: "Model", placeholder: "model-name" },
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
    initial.adapterType ?? "openai"
  );
  const [budgetCents, setBudgetCents] = useState(
    initial.budgetCents != null ? String(initial.budgetCents / 100) : "10"
  );
  const [configFields, setConfigFields] = useState<Record<string, string>>(() => {
    const config = initial.config ?? {};
    return Object.fromEntries(
      Object.entries(config).map(([k, v]) => [k, String(v)])
    );
  });

  const currentFields = ADAPTER_CONFIG_FIELDS[adapterType];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const config: Record<string, unknown> = {};
    currentFields.forEach(({ key }) => {
      if (configFields[key]) config[key] = configFields[key];
    });

    onSubmit({
      name,
      role,
      title,
      adapterType,
      budgetCents: Math.round(parseFloat(budgetCents || "0") * 100),
      config,
    });
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
            {ADAPTER_TYPES.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                <span className="font-medium">{a.label}</span>
                <span className="ml-2 text-[var(--text-muted)] text-[10px]">{a.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Adapter-specific config fields */}
      <div className="bg-[var(--bg-alt)] rounded-[var(--radius-md)] border border-[var(--border)] p-3 flex flex-col gap-3">
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
