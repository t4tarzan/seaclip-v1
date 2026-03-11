import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
  };
  accent?: "primary" | "success" | "warning" | "error" | "info";
  loading?: boolean;
  onClick?: () => void;
}

const accentMap = {
  primary: { fg: "var(--primary)", bg: "var(--primary-muted)" },
  success: { fg: "var(--success)", bg: "var(--success-muted)" },
  warning: { fg: "var(--warning)", bg: "var(--warning-muted)" },
  error: { fg: "var(--error)", bg: "var(--error-muted)" },
  info: { fg: "var(--accent)", bg: "var(--accent-muted)" },
};

export function MetricCard({
  label,
  value,
  description,
  icon,
  trend,
  accent = "primary",
  loading = false,
  onClick,
}: MetricCardProps) {
  const colors = accentMap[accent];

  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 200ms ease, box-shadow 200ms ease",
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Icon + Trend row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        {icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            border: `1px solid ${colors.fg}33`,
            backgroundColor: colors.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ width: 18, height: 18, color: colors.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {icon}
            </span>
          </div>
        )}
        {trend && (
          <div style={{
            display: "flex", alignItems: "center", gap: 3,
            fontSize: 10, fontWeight: 500,
            fontFamily: "'JetBrains Mono', monospace",
            color: trend.value > 0 ? "var(--success)" : trend.value < 0 ? "var(--error)" : "var(--text-muted)",
          }}>
            {trend.value > 0 ? <TrendingUp size={10} /> : trend.value < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>

      {loading ? (
        <div>
          <div style={{ height: 22, width: 56, borderRadius: 4, backgroundColor: "var(--surface-raised)", marginBottom: 8 }} />
          <div style={{ height: 12, width: 80, borderRadius: 4, backgroundColor: "var(--surface-raised)" }} />
        </div>
      ) : (
        <>
          <div style={{
            fontSize: 26, fontWeight: 700, lineHeight: 1,
            marginBottom: 6, letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            fontFamily: "'Instrument Serif', Georgia, serif",
          }}>
            {value}
          </div>
          <div style={{
            fontSize: 10, fontWeight: 600,
            textTransform: "uppercase" as const,
            letterSpacing: "0.08em",
            color: "var(--text-secondary)",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {label}
          </div>
          {description && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
              {description}
            </div>
          )}
        </>
      )}
    </div>
  );
}
